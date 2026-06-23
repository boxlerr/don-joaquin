-- Estado "cobrado" en viajes — conecta Caja con los fletes de los viajes.
--
-- Hasta ahora "facturar" sólo marcaba viajes.facturado = true, pero NO generaba
-- ningún ingreso en la caja (decisión de negocio: facturar ≠ cobrar). Por eso la
-- caja mostraba $0 aunque hubiera cientos de viajes facturados.
--
-- Se agrega un tercer estado explícito: facturado -> (pendiente de cobro) -> cobrado.
-- Al "Cobrar" un viaje, la app crea automáticamente el caja_movimientos (ingreso)
-- vinculado por viaje_id y marca el viaje como cobrado.
--
--   facturado=false                -> sin facturar
--   facturado=true,  cobrado=false -> facturado, pendiente de cobro
--   facturado=true,  cobrado=true  -> cobrado (tiene ingreso en caja)

alter table public.viajes
  add column if not exists cobrado boolean not null default false,
  add column if not exists fecha_cobro date;

-- Un viaje no puede estar cobrado sin estar facturado.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'viajes_cobrado_implica_facturado'
  ) then
    alter table public.viajes
      add constraint viajes_cobrado_implica_facturado
      check (cobrado = false or facturado = true);
  end if;
end $$;

-- Índice parcial para listar rápido los pendientes de cobro.
create index if not exists idx_viajes_pendiente_cobro
  on public.viajes (cobrado) where cobrado = false and facturado = true;

comment on column public.viajes.cobrado is
  'El flete del viaje fue cobrado y volcado a la caja (caja_movimientos con viaje_id). Implica facturado=true.';
comment on column public.viajes.fecha_cobro is
  'Fecha en que se registró el cobro del flete en la caja.';
