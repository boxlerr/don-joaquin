-- Vía del viaje: Ruta 5 vs Ruta 22 (reunión Nico 02/07).
-- ---------------------------------------------------------------------------
-- Según la ruta cambian los km: por la Ruta 5 van derecho (más corta) y por la
-- Ruta 22 pasan por la base/zona (cargar combustible, arreglar roturas). Se
-- marca al cargar el viaje y el autocompletado de km del historial aprende la
-- distancia de cada vía por separado (la primera vez se tipea a mano).
-- NULL = sin marcar (viajes históricos o corredores donde no aplica).

alter table public.viajes
  add column if not exists ruta_via text
    check (ruta_via in ('ruta_5', 'ruta_22'));

comment on column public.viajes.ruta_via is
  'Vía por la que se hizo el viaje (ruta_5 = directa, ruta_22 = por la base). Define los km del par origen-destino; NULL = sin marcar.';
