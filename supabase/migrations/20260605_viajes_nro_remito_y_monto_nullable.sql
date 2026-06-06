-- Hoja de Ruta completa: dos cambios en viajes para que el flujo real funcione.
--
-- 1) nro_remito como columna aparte (hoy se guardaba en observaciones por el
--    importador YPF, lo cual hace imposible filtrar/buscar por remito).
-- 2) monto_flete pasa a ser NULLABLE. Hoy un viaje sin facturar quedaba en
--    monto_flete=0 (default), lo cual NO permite distinguir entre:
--      a) viaje vacio con $0 confirmado
--      b) viaje pendiente de facturar (esperando que llegue el remito fisico)
--    Con NULL podemos mostrar el chip "Esperando remito" en la UI y filtrar
--    "viajes pendientes de facturar" para el equipo de logistica/admin.

alter table public.viajes
  add column if not exists nro_remito text;

create index if not exists viajes_nro_remito_idx
  on public.viajes (nro_remito) where nro_remito is not null;

alter table public.viajes
  alter column monto_flete drop not null;

-- Sacar el default 0 tambien, para que NULL signifique algo
alter table public.viajes
  alter column monto_flete drop default;

comment on column public.viajes.nro_remito is
  'Numero de remito fisico del viaje. NULL = todavia no llego el papel del chofer.';
comment on column public.viajes.monto_flete is
  'Valor del flete en moneda. NULL = pendiente de facturar (esperando remito). Distinto de 0, que es un valor confirmado.';
