-- Marca de zona del viaje para liquidar sueldos (reunión Nico 29/06): los viajes
-- "al sur del río Colorado" y los de "zona petrolera/pozo" pagan distinto. Nico
-- los marca en la hoja de ruta. NULL = viaje normal.

alter table viajes
  add column if not exists zona text
  check (zona is null or zona in ('sur', 'pozo'));

create index if not exists idx_viajes_zona on viajes (zona) where zona is not null;

comment on column viajes.zona is
  'Zona especial para sueldos: sur (sur del río Colorado) | pozo (zona petrolera) | NULL (normal).';
