-- En qué banco cobra cada persona, y cuánto se le transfirió cada mes.
--
-- Audio de Bárbara (03/09/2026): *"la mayoría de las personas tienen incompleto
-- el tema de los datos bancarios (...) Nico me decía que por ahí el CBU no es lo
-- importante, sino que diga en qué banco cobra el sueldo, ya que de esa manera
-- yo entro al banco y la cuenta la voy a tener guardada (...) algunos cobran en
-- dos bancos, una parte en un banco y otra parte en otra. Te lo paso para ver si
-- lo podíamos hacer medio de manera automática la carga y no tener que hacer yo
-- uno por uno, legajo por legajo"*.
--
-- Dos cosas distintas salen del mismo Excel ("IMPORTES SUELDOS JULIO 2026"), y
-- por eso son dos tablas:
--
--   1. `chofer_bancos` — DÓNDE cobra la persona. Es un dato del legajo, no del
--      mes: cambia una vez cada tanto y sirve todos los meses.
--   2. `sueldos_nomina_*` — CUÁNTO se le transfirió ese mes y por qué banco
--      salió cada parte. Es del mes.
--
-- ── Por qué `chofer_bancos` y no el campo `choferes.banco` que ya existía ────
--
-- Porque cinco personas de la nómina de julio cobran partido: HAIT cobra en
-- Credicoop, Galicia y Francés; DIAZ en Galicia, Provincia y Francés; QUIROGA
-- CHAVEZ en Galicia, Francés y Santander; QUIROGA Paula en Credicoop, Francés y
-- Santander; MUZZIO en Credicoop y Francés. Con un campo de texto había que
-- elegir uno y perder los otros — justo el dato que Bárbara necesita para saber
-- a qué home banking entrar.
--
-- `choferes.banco`, `choferes.cbu` y `choferes.alias_cbu` NO se borran: quedan
-- como espejo de la cuenta principal, mantenido por trigger. Así las pantallas y
-- los exports que ya los leen siguen funcionando igual, y producción no se rompe
-- si esta migración se corre antes del deploy.
--
-- ── Por qué la nómina NO va a `sueldos_admin_*` ─────────────────────────────
--
-- Porque no son el mismo número. En julio la planilla de admin/taller le da a
-- HAIT $3.456.552 y el Excel de la nómina dice $2.088.513: una es el costo del
-- empleado y la otra es lo que se transfiere. Mezclarlas habría pisado el sueldo
-- base de las 13 personas de admin y taller y roto la planilla de Bárbara.
--
-- RLS: las tres tablas nacen cerradas (RLS on, cero policies). Todo pasa por
-- acciones del servidor con service role, igual que `sueldos_admin_*` y
-- `gasoil_enlace`. La nómina además es información confidencial de sueldos.

-- ── 1) Dónde cobra cada persona ──────────────────────────────────────────────

create table if not exists public.chofer_bancos (
  id            uuid primary key default gen_random_uuid(),
  chofer_id     uuid not null references public.choferes(id) on delete cascade,
  banco         text not null check (btrim(banco) <> ''),
  -- CVU y CBU van juntos, igual que en el legajo: son equivalentes.
  cbu           text,
  alias_cbu     text,
  -- La cuenta donde cobra el grueso. Es la que se espeja en `choferes.banco`.
  principal     boolean not null default false,
  orden         smallint not null default 0,
  observaciones text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references public.usuarios(id) on delete set null
);

comment on table public.chofer_bancos is
  'Cuentas bancarias del legajo: en qué banco (o bancos) cobra cada persona. Una fila por banco.';
comment on column public.chofer_bancos.principal is
  'La cuenta que se espeja en choferes.banco/cbu/alias_cbu. Una sola por persona.';

-- El mismo banco dos veces para la misma persona es siempre un error de carga.
-- La comparación es sin mayúsculas; los acentos los canoniza la app antes de
-- guardar (`canonizarBanco`), porque `unaccent` no está instalada en esta base.
create unique index if not exists chofer_bancos_unico
  on public.chofer_bancos (chofer_id, lower(btrim(banco)));

create unique index if not exists chofer_bancos_un_principal
  on public.chofer_bancos (chofer_id) where principal;

create index if not exists chofer_bancos_chofer_idx
  on public.chofer_bancos (chofer_id, orden);

drop trigger if exists chofer_bancos_set_updated_at on public.chofer_bancos;
create trigger chofer_bancos_set_updated_at
  before update on public.chofer_bancos
  for each row execute function public.tg_set_updated_at();

alter table public.chofer_bancos enable row level security;

-- ── 2) El espejo en `choferes` ───────────────────────────────────────────────

-- Mantiene `choferes.banco/cbu/alias_cbu` apuntando a la cuenta principal (o, si
-- ninguna está marcada, a la primera por orden). Sin esto habría que tocar las
-- pantallas viejas y los exports el mismo día que se aplica la migración.
create or replace function public.tg_chofer_bancos_espejo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chofer uuid := coalesce(new.chofer_id, old.chofer_id);
  v_banco  text;
  v_cbu    text;
  v_alias  text;
begin
  select b.banco, b.cbu, b.alias_cbu
    into v_banco, v_cbu, v_alias
    from public.chofer_bancos b
   where b.chofer_id = v_chofer
   order by b.principal desc, b.orden, b.created_at
   limit 1;

  update public.choferes
     set banco     = v_banco,
         cbu       = v_cbu,
         alias_cbu = v_alias
   where id = v_chofer
     -- Sin esto, cada guardado dispara el trigger de updated_at del legajo y la
     -- ficha figura "modificada" aunque no haya cambiado nada.
     and (banco is distinct from v_banco
       or cbu is distinct from v_cbu
       or alias_cbu is distinct from v_alias);

  return null;
end;
$$;

drop trigger if exists chofer_bancos_espejo on public.chofer_bancos;
create trigger chofer_bancos_espejo
  after insert or update or delete on public.chofer_bancos
  for each row execute function public.tg_chofer_bancos_espejo();

-- Backfill: los 55 legajos que ya tenían banco cargado arrancan con esa cuenta
-- como principal. `on conflict do nothing` lo hace repetible.
insert into public.chofer_bancos (chofer_id, banco, cbu, alias_cbu, principal, orden, observaciones)
select id, btrim(banco), cbu, alias_cbu, true, 0, 'Dato que ya estaba en el legajo'
  from public.choferes
 where banco is not null and btrim(banco) <> ''
on conflict do nothing;

-- ── 3) La nómina del mes ─────────────────────────────────────────────────────

-- Cabecera: qué meses se importaron y con qué totales venía el Excel. Guardar el
-- total del archivo (y no sólo la suma de las filas) es lo que permite mostrar
-- el descuadre en vez de esconderlo: si dos personas del Excel no tienen legajo,
-- la suma de lo cargado da menos y hay que poder decirlo.
create table if not exists public.sueldos_nomina_meses (
  mes             date primary key,
  archivo         text,
  total_sueldos   numeric,
  total_embargos  numeric,
  observaciones   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.usuarios(id) on delete set null
);

comment on table public.sueldos_nomina_meses is
  'Un renglón por mes de nómina importado: de qué archivo salió y qué totales declaraba, para control contra el Excel.';

drop trigger if exists sueldos_nomina_meses_set_updated_at on public.sueldos_nomina_meses;
create trigger sueldos_nomina_meses_set_updated_at
  before update on public.sueldos_nomina_meses
  for each row execute function public.tg_set_updated_at();

alter table public.sueldos_nomina_meses enable row level security;

-- Detalle: cada transferencia del mes. Una persona puede tener varias filas
-- (cobra partido en dos bancos, o tiene dos embargos), así que NO hay clave
-- única por persona y mes: la idempotencia del importador se resuelve borrando
-- el mes completo antes de volver a insertarlo.
create table if not exists public.sueldos_nomina_pagos (
  id          uuid primary key default gen_random_uuid(),
  chofer_id   uuid not null references public.choferes(id) on delete cascade,
  mes         date not null,
  -- 'sueldo' es lo que cobra la persona; 'embargo' es lo que se retiene y se
  -- deposita aparte. El Excel los suma por separado ("SUELDOS + EMBARGOS") y acá
  -- se respeta: sumarlos al sueldo diría que la persona cobró de más.
  concepto    text not null check (concepto in ('sueldo', 'embargo')),
  -- null cuando el Excel no dice por dónde salió (los embargos no lo dicen, y
  -- alguna persona figura en la nómina sin aparecer en ningún banco).
  banco       text,
  importe     numeric not null check (importe >= 0),
  orden       smallint not null default 0,
  created_at  timestamptz not null default now(),
  created_by  uuid references public.usuarios(id) on delete set null
);

comment on table public.sueldos_nomina_pagos is
  'Lo que se le transfirió a cada persona en el mes, abierto por banco. Confidencial: sólo se lee desde acciones del servidor con permiso de sueldos.';
comment on column public.sueldos_nomina_pagos.banco is
  'Banco por el que salió esa parte. Null si el Excel no lo indica (embargos).';

create index if not exists sueldos_nomina_pagos_mes_idx
  on public.sueldos_nomina_pagos (mes, chofer_id);
create index if not exists sueldos_nomina_pagos_chofer_idx
  on public.sueldos_nomina_pagos (chofer_id, mes desc);

alter table public.sueldos_nomina_pagos enable row level security;
