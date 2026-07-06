-- Planilla diaria → modelo "asignación fija" (decisión 06/07/2026).
-- La asignación chofer↔camión vive en camiones.chofer_actual_id (misma fuente que
-- el legajo). Guardar la planilla de HOY reescribe esa asignación fija y deja un
-- snapshot del día en asignacion_diaria (historial + default de la carga de viajes).
--
-- Esta función hace TODO el trabajo en UNA transacción (atómica): si algo falla,
-- se revierte entero. Así un guardado a medias no puede dejar choferes "huérfanos"
-- (liberados pero sin reasignar). Aplica SOLO los cambios reales para no ensuciar
-- el historial de camiones (el trigger camiones_sync_chofer_historial abre/cierra
-- tramos en chofer_camion_historial cuando cambia chofer_actual_id).

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
begin
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

  -- 4) Snapshot del día (historial + default de la carga de viajes).
  delete from public.asignacion_diaria where fecha = p_fecha;
  insert into public.asignacion_diaria (fecha, chofer_id, camion_id, observaciones, created_by, updated_by)
  select
    p_fecha,
    (i->>'chofer_id')::uuid,
    nullif(i->>'camion_id', '')::uuid,
    nullif(btrim(coalesce(i->>'observaciones', '')), ''),
    p_user,
    p_user
  from jsonb_array_elements(p_items) i
  where nullif(i->>'camion_id', '') is not null;
end;
$$;

comment on function public.aplicar_planilla_estandar(jsonb, date, uuid) is
  'Guarda la planilla de un día en el modelo "asignación fija": reescribe camiones.chofer_actual_id (atómico) y deja snapshot en asignacion_diaria. Ver 20260706.';

-- Es SECURITY DEFINER y ESCRIBE (reescribe asignaciones + snapshot). NO debe poder
-- llamarse por REST desde anon/authenticated (saltaría la validación de permisos del
-- server action). Solo la app, vía service_role (admin client), la ejecuta.
revoke all on function public.aplicar_planilla_estandar(jsonb, date, uuid) from public;
revoke all on function public.aplicar_planilla_estandar(jsonb, date, uuid) from anon, authenticated;
grant execute on function public.aplicar_planilla_estandar(jsonb, date, uuid) to service_role;
