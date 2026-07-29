-- Blindaje de vacaciones. El 22/07/2026 un script descartable (SQL crudo por
-- service role, sin pasar por la app) reescribió los días otorgados de 59
-- empleados con la fórmula "saldo de la planilla + días ya tomados": preservó
-- el saldo y destruyó los otorgados. A Trejo le dejó 16 donde van 28. De esa
-- corrida no quedó NADA: 129 de 135 filas tienen updated_by NULL y en audit_log
-- no hay una sola entrada. Acá va lo que impide que vuelva a pasar.
--
-- El orden de los bloques importa: columnas → backfills → constraints →
-- triggers → RLS. Si los triggers se crearan antes de los backfills, los
-- propios backfills explotarían contra la guarda de updated_at.

-- ── 0) audit_log.entidad_id: uuid → text ──────────────────────────────────────
-- Hallazgo al escribir esta migración, y explica por qué la trazabilidad de los
-- saldos por año no existía aunque el código la registrara: la columna era uuid,
-- y el id de un saldo es `<chofer_id>:<anio>`. Cada uno de esos inserts fallaba
-- con "invalid input syntax for type uuid" y `logAudit` se traga el error a
-- propósito (la auditoría no debe romper la operación de negocio), así que se
-- perdían en silencio. Por eso en audit_log no hay una sola fila de
-- chofer_vacaciones_anio: no era que no se registrara, era que no entraba.
--
-- uuid → text no pierde nada (todo uuid es un texto válido), ningún FK apunta a
-- esta columna y los filtros por id siguen funcionando igual. Los índices que la
-- usen los reconstruye el propio ALTER.
alter table public.audit_log
  alter column entidad_id type text using entidad_id::text;

comment on column public.audit_log.entidad_id is
  'Id del recurso afectado. Es TEXT y no uuid porque algunas entidades son compuestas: el saldo de vacaciones de un año se identifica como <chofer_id>:<anio>.';

-- ── 1) Columnas ───────────────────────────────────────────────────────────────

alter table public.chofer_vacaciones_anios
  add column if not exists origen text not null default 'antiguedad';

alter table public.chofer_ausencias
  add column if not exists origen text not null default 'humano';

comment on column public.chofer_vacaciones_anios.origen is
  'De dónde salió el número: humano (lo cargó o corrigió una persona en la pantalla), planilla (importador), antiguedad (alta del año y recálculo por LCT art. 150), conciliacion (la carga del 22/07/2026). humano = ningún proceso automático lo puede pisar.';

comment on column public.chofer_ausencias.origen is
  'De dónde salió el período: humano o planilla. Sin bloqueo: hoy ningún proceso automático hace UPDATE de períodos.';

-- ── 2) Backfills ──────────────────────────────────────────────────────────────

-- Procedencia de los saldos ya cargados. `updated_by` MANDA sobre el texto de
-- la observación: Alveira tiene usuario del 29/07 y observación de la
-- conciliación del 21/07, y entre las dos señales gana la persona.
update public.chofer_vacaciones_anios set origen = case
  when updated_by is not null then 'humano'
  when observaciones ilike 'Editado manualmente%' then 'humano'
  when observaciones ilike 'Importado de planilla%' then 'planilla'
  when observaciones ilike 'Conciliado con planilla%' then 'conciliacion'
  else 'antiguedad' end;

update public.chofer_ausencias set origen = 'planilla'
 where observaciones ilike 'Importado de planilla%';

-- La procedencia pasa a vivir en `origen` y `observaciones` queda sólo para el
-- "por qué" que escribe una persona. Pero antes de tirar un texto hay que
-- guardarlo: el criterio de la casa es tener las pruebas, no la prolijidad.
insert into public.audit_log (accion, entidad_tipo, entidad_id, usuario_id, valores_anteriores, metadata)
select 'vacaciones_observacion_migrada', 'chofer_vacaciones_anio', chofer_id::text || ':' || anio::text, null,
       jsonb_build_object('observaciones', observaciones),
       jsonb_build_object('chofer_id', chofer_id, 'anio', anio, 'origen', origen)
  from public.chofer_vacaciones_anios
 where observaciones is not null;

-- Sólo se borran los textos de MÁQUINA; cualquier cosa que haya escrito una
-- persona no matchea y queda intacta. Se pierde el "; incluye N días de
-- arrastre ≤2024" y está bien: la auditoría probó que ese arrastre es FICTICIO
-- (lo inventó el script como residuo contra la LCT, no salió de ninguna columna
-- de la planilla). Igual quedó archivado arriba.
update public.chofer_vacaciones_anios set observaciones = null
 where observaciones ilike 'Editado manualmente%'
    or observaciones ilike 'Conciliado con planilla%'
    or observaciones ilike 'Importado de planilla%'
    or observaciones ilike 'Alta autom%'
    or observaciones ilike 'Alta por antig%'
    or observaciones ilike 'D_as por antig%';

-- ── 3) Constraints ────────────────────────────────────────────────────────────

alter table public.chofer_vacaciones_anios drop constraint if exists chofer_vacaciones_anios_origen_check;
alter table public.chofer_vacaciones_anios add constraint chofer_vacaciones_anios_origen_check
  check (origen in ('humano', 'planilla', 'antiguedad', 'conciliacion'));

alter table public.chofer_ausencias drop constraint if exists chofer_ausencias_origen_check;
alter table public.chofer_ausencias add constraint chofer_ausencias_origen_check
  check (origen in ('humano', 'planilla'));

-- Índice parcial: la pregunta que se hace todo el tiempo es "de este año, ¿cuáles
-- tocó una persona?" (el filtro que corren el importador y el recálculo masivo).
create index if not exists idx_chofer_vacaciones_anios_origen
  on public.chofer_vacaciones_anios (anio) where origen = 'humano';

-- A propósito NO va un check "origen='humano' ⇒ updated_by not null": hay filas
-- viejas con observación 'Editado manualmente' que nunca guardaron el usuario, y
-- el check haría fallar la migración entera por datos históricos.

-- ── 4) Trigger de protección ──────────────────────────────────────────────────
-- "Lo que modificó un usuario NO SE TOCA". Esto es lo único que sigue en pie
-- cuando alguien escribe por fuera de la app (script, consola SQL, service role).

create or replace function public.vacaciones_anios_protege_humano()
returns trigger
language plpgsql
as $$
begin
  -- (a) Un proceso automático se delata bajando el origen de la fila. Vale
  --     aunque no cambien los días: si no, se podría degradar el origen en un
  --     UPDATE y pisar los días en el siguiente.
  if old.origen = 'humano' and new.origen is distinct from 'humano' then
    raise exception 'chofer_vacaciones_anios: los % días del % los cargó una persona; ningún proceso automático puede pisarlos (origen nuevo: %).',
      old.dias_correspondientes, old.anio, new.origen using errcode = 'check_violation';
  end if;

  -- (b) Toda escritura que mueva los días tiene que declararse. El SQL del
  --     22/07 hacía `do update set dias_correspondientes, observaciones` y no
  --     tocaba updated_at: por eso no se pudo saber ni cuándo pasó. Esta guarda
  --     es la que lo habría frenado.
  if new.dias_correspondientes is distinct from old.dias_correspondientes
     and new.updated_at is not distinct from old.updated_at then
    raise exception 'chofer_vacaciones_anios: para cambiar los días hay que actualizar updated_at y updated_by. Usá las server actions de vacaciones, no SQL suelto.'
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

-- OJO: este trigger NO setea updated_at. Si lo hiciera, la guarda (b) dejaría de
-- servir (el propio trigger le taparía el agujero al SQL crudo). Los cuatro
-- writers de la app ya mandan updated_at explícito, y el alta automática del año
-- es un INSERT con ignoreDuplicates, así que nunca dispara un BEFORE UPDATE.
drop trigger if exists trg_vacaciones_anios_protege_humano on public.chofer_vacaciones_anios;
create trigger trg_vacaciones_anios_protege_humano
  before update on public.chofer_vacaciones_anios
  for each row execute function public.vacaciones_anios_protege_humano();

-- ── 5) Trigger de auditoría ───────────────────────────────────────────────────
-- Segunda capa, dentro de la MISMA transacción que el UPDATE. La server action
-- sabe la INTENCIÓN (reimputé un período vs. corregí fechas) pero no cubre las
-- escrituras que no pasan por la app; el trigger cubre todo pero no sabe por qué.
-- Las dos conviven y el panel de /auditoría las separa con un filtro.

create or replace function public.tg_audit_vacaciones()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_fila jsonb;
  v_entidad text;
  v_id text;
  v_chofer uuid;
  v_usuario uuid;
begin
  -- NEW no existe en un DELETE y OLD no existe en un INSERT: tocarlos directo
  -- revienta el trigger ("record new is not assigned yet") y con él la
  -- operación entera. Se trabaja sobre jsonb, que sí admite estar en null.
  if tg_op <> 'DELETE' then v_new := to_jsonb(new); end if;
  if tg_op <> 'INSERT' then v_old := to_jsonb(old); end if;
  v_fila := coalesce(v_new, v_old);

  if tg_table_name = 'chofer_vacaciones_anios' then
    v_entidad := 'chofer_vacaciones_anio';
    v_chofer := (v_fila ->> 'chofer_id')::uuid;
    v_id := (v_fila ->> 'chofer_id') || ':' || (v_fila ->> 'anio');
    v_usuario := nullif(v_fila ->> 'updated_by', '')::uuid;
  else
    -- Las ausencias comunes (licencias, permisos de Logística) no son asunto de
    -- vacaciones: sin este corte el log se llena de ruido y deja de leerse.
    if coalesce((v_fila ->> 'es_vacaciones')::boolean, false) is not true then
      return null; -- AFTER trigger: el valor de retorno se ignora
    end if;
    v_entidad := 'chofer_ausencia';
    v_chofer := (v_fila ->> 'chofer_id')::uuid;
    v_id := v_fila ->> 'id';
    v_usuario := nullif(coalesce(v_fila ->> 'created_by', v_fila ->> 'autorizado_por'), '')::uuid;
  end if;

  -- usuario_id null = nadie firmó, o sea una escritura por fuera de la app. Esa
  -- ausencia ES la alarma: así se vería hoy la corrida del 22/07 si existiera
  -- este trigger.
  insert into public.audit_log (accion, entidad_tipo, entidad_id, usuario_id, valores_anteriores, valores_nuevos, metadata)
  values (
    'vacaciones_db_' || lower(tg_op),
    v_entidad,
    v_id,
    v_usuario,
    v_old,
    v_new,
    jsonb_build_object('fuente', 'trigger_db', 'chofer_id', v_chofer, 'tabla', tg_table_name)
  );

  return null; -- AFTER trigger: el valor de retorno se ignora
end $$;

-- security definer porque audit_log tiene INSERT revocado a authenticated desde
-- la remediación del 24/06: sin esto, un UPDATE hecho con la sesión de un
-- usuario fallaría al intentar registrarse.

drop trigger if exists trg_audit_vacaciones_anios on public.chofer_vacaciones_anios;
create trigger trg_audit_vacaciones_anios
  after insert or update or delete on public.chofer_vacaciones_anios
  for each row execute function public.tg_audit_vacaciones();

drop trigger if exists trg_audit_vacaciones_ausencias on public.chofer_ausencias;
create trigger trg_audit_vacaciones_ausencias
  after insert or update or delete on public.chofer_ausencias
  for each row execute function public.tg_audit_vacaciones();

-- ── 6) RLS ────────────────────────────────────────────────────────────────────
-- Los 8 writes de chofer_vacaciones_anios están en archivos server con
-- createAdminClient (service role, que ignora RLS): lib.ts, vacaciones/actions.ts,
-- import-planilla/actions.ts y [slug]/actions.ts. Con RLS activo y sin policy de
-- INSERT/UPDATE, cualquier escritura con la anon key queda denegada por defecto
-- (no hace falta revoke). Un saldo de vacaciones no se toca desde el navegador.
drop policy if exists insert_active_user on public.chofer_vacaciones_anios;
drop policy if exists update_active_user on public.chofer_vacaciones_anios;

-- Las policies de chofer_ausencias NO se tocan: hay que relevar antes si
-- Logística/Viajes escribe ausencias desde el cliente, y un revoke ahí rompería
-- en SILENCIO (RLS devuelve 0 filas, no un error visible).
