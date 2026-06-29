-- Distingue dónde se cargó el combustible: estación PROPIA de Don Joaquín
-- (donde cargan "los chicos") vs EN RUTA (estaciones YPF en el camino, que YPF
-- factura aparte). Pedido en la reunión con Nico del 29/06.
-- Nullable: las cargas históricas quedan sin especificar; las nuevas eligen en el modal.

alter table cargas_combustible
  add column if not exists lugar_carga text
  check (lugar_carga is null or lugar_carga in ('propia', 'en_ruta'));

comment on column cargas_combustible.lugar_carga is
  'Dónde se cargó: propia (estación de Don Joaquín) | en_ruta (YPF en el camino). NULL = histórico sin especificar.';
