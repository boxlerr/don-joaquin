-- Planilla diaria → registrar QUÉ cambió en cada guardado (21/07/2026).
--
-- Hasta ahora el snapshot del día (`asignacion_diaria`) guardaba solo el estado
-- final: al navegar el historial se veía qué camión manejaba cada chofer ese día,
-- pero no si ese camión era un cambio ni de cuál venía.
--
-- Se agregan dos columnas al snapshot:
--   - camion_anterior_id : el camión que el chofer tenía ANTES de ese guardado
--                          (null = no tenía camión asignado).
--   - cambio             : true si camion_anterior_id difiere del camión guardado.
--
-- El "anterior" sale de la asignación fija real (camiones.chofer_actual_id) en el
-- momento de guardar, así que también captura los cambios hechos desde el legajo,
-- no solo los hechos en la planilla.

alter table public.asignacion_diaria
  add column if not exists camion_anterior_id uuid
    references public.camiones(id) on delete set null;

alter table public.asignacion_diaria
  add column if not exists cambio boolean not null default false;

comment on column public.asignacion_diaria.camion_anterior_id is
  'Camión que tenía el chofer antes de este guardado (null = ninguno). Ver 20260721.';
comment on column public.asignacion_diaria.cambio is
  'true si el camión guardado difiere del anterior. Ver 20260721.';

-- El calendario del historial marca los días que tuvieron cambios.
create index if not exists asignacion_diaria_fecha_cambio_idx
  on public.asignacion_diaria (fecha)
  where cambio;

-- `camion_id` pasa a ser opcional. Antes, un chofer al que se le sacaba la unidad
-- simplemente no dejaba fila, así que "AD916TF → sin camión" no se podía registrar
-- (y volver a guardar el día borraba el cambio que ya estaba asentado). Ahora todos
-- los choferes de la planilla dejan fila y el cambio queda igual que los demás.
alter table public.asignacion_diaria alter column camion_id drop not null;

-- El calendario necesita saber qué días tienen planilla y cuáles tuvieron cambios.
-- Sin esta vista habría que traer la tabla entera (PostgREST corta en 1000 filas:
-- con ~60 choferes por día se truncaba a partir del día 17 y el historial mentía).
create or replace view public.v_planilla_diaria_fechas
with (security_invoker = true) as
select fecha, bool_or(cambio) as hubo_cambios
from public.asignacion_diaria
group by fecha;

-- Solo la app (service_role) la consulta; nada de exponerla a anon/authenticated.
revoke all on public.v_planilla_diaria_fechas from public;
revoke all on public.v_planilla_diaria_fechas from anon, authenticated;
grant select on public.v_planilla_diaria_fechas to service_role;


-- ────────────────────────────────────────────────────────────────────────────
-- Backfill de los snapshots ya guardados
-- ────────────────────────────────────────────────────────────────────────────
-- Para las fechas que ya existen no tenemos el estado fijo del momento, así que
-- lo reconstruimos comparando con la fecha guardada inmediatamente anterior.
-- Criterio conservador: solo marcamos `cambio` cuando ese chofer TENÍA una fila
-- en la planilla anterior y el camión es distinto (no inventamos cambios donde
-- simplemente no había dato).
--
-- El trigger de updated_at queda desactivado durante el backfill: si no, todas las
-- planillas viejas pasarían a decir "guardado hoy" en el cartel del historial.

alter table public.asignacion_diaria disable trigger asignacion_diaria_set_updated_at;

update public.asignacion_diaria ad
   set camion_anterior_id = coalesce(prev.camion_id, ad.camion_id),
       cambio = prev.camion_id is not null and prev.camion_id <> ad.camion_id
  from (
    select a.id,
           (
             select p.camion_id
               from public.asignacion_diaria p
              where p.chofer_id = a.chofer_id
                and p.fecha = (
                  select max(q.fecha)
                    from public.asignacion_diaria q
                   where q.fecha < a.fecha
                )
           ) as camion_id
      from public.asignacion_diaria a
  ) prev
 where prev.id = ad.id
   and ad.camion_anterior_id is null;

alter table public.asignacion_diaria enable trigger asignacion_diaria_set_updated_at;


-- ────────────────────────────────────────────────────────────────────────────
-- RPC: mismo comportamiento de antes + registro del cambio
-- ────────────────────────────────────────────────────────────────────────────
-- Único agregado respecto de 20260706: el paso 0, que fotografía el camión previo
-- de cada chofer ANTES de tocar nada, y el snapshot final que lo guarda.
--
-- Si la planilla de esa fecha ya se había guardado, el "anterior" del día se
-- preserva (se toma el camion_anterior_id ya registrado): así volver a guardar la
-- planilla no borra el cambio que ya había quedado asentado ese día.

create or replace function public.aplicar_planilla_estandar(
  p_items jsonb,
  p_fecha date,
  p_user uuid
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_changing uuid[];      -- choferes cuyo camión deseado != su camión fijo actual
  v_desired_cam uuid[];   -- camiones deseados (para liberar "robos" de terceros)
  v_prev jsonb;           -- chofer_id::text -> camion_id::text ('' = sin camión)
begin
  -- 0) Foto del camión previo de cada chofer, ANTES de mover nada.
  select coalesce(jsonb_object_agg(s.chofer_id::text, coalesce(s.prev::text, '')), '{}'::jsonb)
    into v_prev
  from (
    select it.chofer_id,
           case
             -- Ya hay planilla guardada esa fecha: conservamos el origen del día.
             when ad.id is not null then ad.camion_anterior_id
             -- Primer guardado del día: el anterior es la asignación fija vigente.
             else (
               select c.id from public.camiones c
                where c.chofer_actual_id = it.chofer_id
                limit 1
             )
           end as prev
      from (
        select distinct (i->>'chofer_id')::uuid as chofer_id
          from jsonb_array_elements(p_items) i
      ) it
      left join public.asignacion_diaria ad
             on ad.fecha = p_fecha
            and ad.chofer_id = it.chofer_id
  ) s;

  -- Choferes con cambio real + camiones deseados involucrados.
  with items as (
    select (i->>'chofer_id')::uuid as chofer_id,
           nullif(i->>'camion_id', '')::uuid as camion_id
    from jsonb_array_elements(p_items) i
  ),
  actual as (
    -- Camión fijo actual por chofer (last-write-wins da igual: en el paso 1
    -- liberamos TODOS los camiones del chofer que cambia, no solo este).
    select chofer_actual_id as chofer_id, id as camion_id
    from public.camiones
    where chofer_actual_id is not null
  )
  select
    array_agg(distinct it.chofer_id) filter (where it.chofer_id is not null),
    array_agg(distinct it.camion_id) filter (where it.camion_id is not null)
    into v_changing, v_desired_cam
  from items it
  left join actual a on a.chofer_id = it.chofer_id
  where it.camion_id is distinct from a.camion_id;  -- cambio real

  if v_changing is not null then
    -- 1) Liberar TODOS los camiones de cada chofer que cambia (cubre el caso raro
    --    de un chofer con más de un camión: queda con cero antes de reasignar).
    update public.camiones
       set chofer_actual_id = null
     where chofer_actual_id = any(v_changing);

    -- 2) Liberar los camiones deseados que aún tenga un tercero (el "robo": ese
    --    chofer queda sin camión). Ya sin dueño, el paso 3 los asigna limpio.
    if v_desired_cam is not null then
      update public.camiones
         set chofer_actual_id = null
       where id = any(v_desired_cam)
         and chofer_actual_id is not null;
    end if;

    -- 3) Asignar el camión deseado a cada chofer que cambia (los sin camión no
    --    matchean porque su camion_id es null).
    update public.camiones c
       set chofer_actual_id = x.chofer_id
      from (
        select (i->>'chofer_id')::uuid as chofer_id,
               nullif(i->>'camion_id', '')::uuid as camion_id
        from jsonb_array_elements(p_items) i
      ) x
     where x.camion_id = c.id
       and x.chofer_id = any(v_changing);
  end if;

  -- 4) Snapshot del día (historial + default de la carga de viajes), ahora con
  --    de qué camión venía cada chofer. Se guardan TODOS los choferes de la planilla,
  --    incluidos los que quedan sin unidad (camion_id null), para no perder el cambio.
  delete from public.asignacion_diaria where fecha = p_fecha;
  insert into public.asignacion_diaria (
    fecha, chofer_id, camion_id, observaciones,
    camion_anterior_id, cambio, created_by, updated_by
  )
  select
    p_fecha,
    x.chofer_id,
    x.camion_id,
    x.observaciones,
    x.prev,
    x.prev is distinct from x.camion_id,
    p_user,
    p_user
  from (
    select
      (i->>'chofer_id')::uuid as chofer_id,
      nullif(i->>'camion_id', '')::uuid as camion_id,
      nullif(btrim(coalesce(i->>'observaciones', '')), '') as observaciones,
      nullif(v_prev->>(i->>'chofer_id'), '')::uuid as prev
    from jsonb_array_elements(p_items) i
  ) x;
end;
$$;

comment on function public.aplicar_planilla_estandar(jsonb, date, uuid) is
  'Guarda la planilla de un día en el modelo "asignación fija": reescribe camiones.chofer_actual_id (atómico) y deja snapshot en asignacion_diaria con el camión anterior de cada chofer. Ver 20260706 + 20260721.';

-- Es SECURITY DEFINER y ESCRIBE (reescribe asignaciones + snapshot). NO debe poder
-- llamarse por REST desde anon/authenticated (saltaría la validación de permisos del
-- server action). Solo la app, vía service_role (admin client), la ejecuta.
revoke all on function public.aplicar_planilla_estandar(jsonb, date, uuid) from public;
revoke all on function public.aplicar_planilla_estandar(jsonb, date, uuid) from anon, authenticated;
grant execute on function public.aplicar_planilla_estandar(jsonb, date, uuid) to service_role;
