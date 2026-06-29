-- Nº de remito/ticket de la carga de combustible. Lo trae el reporte de YPF en ruta
-- (columna REMITO) y sirve como clave para deduplicar al re-importar el Excel.
-- Pedido en la reunión con Nico del 29/06 (importación de YPF en ruta).

alter table cargas_combustible
  add column if not exists remito text;

create index if not exists idx_cargas_combustible_remito
  on cargas_combustible (remito)
  where remito is not null;

comment on column cargas_combustible.remito is
  'Nº de remito/ticket (YPF en ruta). Clave de deduplicación al importar.';
