-- Viajes VACÍO (retornos/posicionamientos sin carga).
--
-- El importador de hoja de ruta crea un viaje por cada fila del Excel, incluidas
-- las filas con remito "VACIO". Esos tramos vacíos no se facturan nunca, pero
-- quedaban como facturado=false y se contaban en "Sin facturar" (inflaban el
-- contador a 500 cuando los viajes reales pendientes de facturar eran 16).
--
-- `es_vacio` los marca explícitamente para:
--   - excluirlos del contador/listado de "Sin facturar"
--   - mostrarlos en su propio contador "Viajes vacíos"
--   - mantenerlos visibles en el listado (Bárbara los quiere por diseño)
--
-- Backfill de los ya importados por la marca que dejó el importador en
-- observaciones ("VIAJE VACÍO").

alter table public.viajes
  add column if not exists es_vacio boolean not null default false;

create index if not exists idx_viajes_es_vacio
  on public.viajes (es_vacio) where es_vacio = true;

comment on column public.viajes.es_vacio is
  'Viaje sin carga (retorno/posicionamiento). Remito VACIO en la hoja de ruta. No factura: se excluye del conteo de Sin facturar.';

update public.viajes
  set es_vacio = true
  where observaciones ilike '%VIAJE VACÍO%' and es_vacio = false;
