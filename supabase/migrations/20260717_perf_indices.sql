-- Índices de performance (auditoría de perf 17/07). Cubren el orden y los filtros
-- por defecto de las consultas calientes que hoy hacían sort/scan de tabla completa.
-- Idempotentes; tablas chicas → creación instantánea.

-- viajes: orden por defecto (fecha desc, codigo), filtro por chofer, y el LIKE del
-- correlativo (V-YYYY-NNNN) que se escanea en cada alta.
create index if not exists idx_viajes_fecha_codigo on public.viajes (fecha_viaje desc, codigo);
create index if not exists idx_viajes_chofer_fecha on public.viajes (chofer_id, fecha_viaje desc);
create index if not exists idx_viajes_codigo on public.viajes (codigo);

-- cargas_combustible: el índice existente arranca por camion_id; faltaban los
-- filtros por fecha sola y por chofer.
create index if not exists idx_cargas_combustible_fecha on public.cargas_combustible (fecha desc);
create index if not exists idx_cargas_combustible_chofer on public.cargas_combustible (chofer_id);

-- Listados que ordenan por created_at / fecha sin más índice.
create index if not exists idx_cheques_created on public.cheques (created_at desc);
create index if not exists idx_siniestros_fecha on public.siniestros (fecha desc);
