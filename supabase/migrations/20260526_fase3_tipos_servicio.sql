-- FASE 3 del plan post-feedback (26/05/2026): mantenimiento ampliado.
--
-- El enum `mantenimiento_tipo` actual es fijo (service_preventivo, reparacion,
-- cambio_aceite, cubiertas, otro). El feedback (puntos 1 y 7) pide:
--   - "Todo medible, nada en Excel."
--   - Soportar servicios completos para Volvo/Mercedes (filtro, aceite, frenos)
--   - Alertas tipo VTV por próximo servicio
--   - Bárbara va a mandar métricas adicionales — el catálogo TIENE que ser editable
--
-- Solución: tabla `tipos_servicio` (catálogo) + FK nullable en `mantenimientos`.
-- El enum se mantiene por compat hasta migrar el código que lo usa.


-- ────────────────────────────────────────────────────────────────────────────
-- 1) tipos_servicio — catálogo editable
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists public.tipos_servicio (
  id                    uuid primary key default gen_random_uuid(),
  codigo                text not null unique,
  nombre                text not null,
  descripcion           text,
  -- Para alertas tipo VTV: ¿el próximo turno se calcula por km, fecha, o ambos?
  requiere_km           boolean not null default true,
  requiere_fecha        boolean not null default true,
  intervalo_km          numeric,
  intervalo_dias        integer,
  -- Camiones tercerizados (Scania) solo cargan los servicios marcados acá.
  -- El resto se asume que lo lleva la concesionaria.
  aplica_a_tercerizado  boolean not null default false,
  estado                public.tipo_carga_estado not null default 'activo',
  orden                 integer not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint tipos_servicio_intervalo_km_ok check (intervalo_km is null or intervalo_km > 0),
  constraint tipos_servicio_intervalo_dias_ok check (intervalo_dias is null or intervalo_dias > 0)
);

create index if not exists tipos_servicio_estado_idx on public.tipos_servicio (estado);
create index if not exists tipos_servicio_orden_idx on public.tipos_servicio (orden);

alter table public.tipos_servicio enable row level security;

create policy select_active_user on public.tipos_servicio
  for select using (is_authenticated_active());
create policy insert_active_user on public.tipos_servicio
  for insert with check (is_authenticated_active());
create policy update_active_user on public.tipos_servicio
  for update using (is_authenticated_active()) with check (is_authenticated_active());
create policy delete_admin_only on public.tipos_servicio
  for delete using (is_admin());

drop trigger if exists tipos_servicio_set_updated_at on public.tipos_servicio;
create trigger tipos_servicio_set_updated_at
  before update on public.tipos_servicio
  for each row execute function public.tg_set_updated_at();


-- ────────────────────────────────────────────────────────────────────────────
-- 2) Seed inicial
--    - Los códigos de los 5 valores del enum (`service_preventivo`, `reparacion`,
--      `cambio_aceite`, `cubiertas`, `otro`) se conservan para que el backfill
--      mapee 1:1.
--    - Gomería es el único marcado `aplica_a_tercerizado` (Scania también la carga).
-- ────────────────────────────────────────────────────────────────────────────

insert into public.tipos_servicio
  (codigo, nombre, descripcion, requiere_km, requiere_fecha, intervalo_km, intervalo_dias, aplica_a_tercerizado, orden)
values
  ('gomeria',            'Gomería',              'Recambio o reparación de cubiertas (no es rotura no programada)',
                          false, true, null, null, true, 10),
  ('cambio_aceite',      'Cambio de aceite',     'Aceite de motor',
                          true, true, 20000, 365, false, 20),
  ('filtro_aceite',      'Filtro de aceite',     null,
                          true, true, 20000, 365, false, 30),
  ('filtro_aire',        'Filtro de aire',       null,
                          true, true, 40000, 730, false, 40),
  ('filtro_combustible', 'Filtro de combustible', null,
                          true, true, 30000, 730, false, 50),
  ('frenos',             'Frenos',               'Pastillas, discos, líquido',
                          true, true, 80000, null, false, 60),
  ('alineacion',         'Alineación y balanceo', null,
                          true, true, 30000, 365, false, 70),
  ('cubiertas',          'Cubiertas',            'Rotación o recambio programado de cubiertas',
                          true, true, 80000, null, true, 80),
  ('service_preventivo', 'Service preventivo',   'Service completo de mantenimiento programado',
                          true, true, null, 365, false, 90),
  ('reparacion',         'Reparación',           'Reparación no programada (avería)',
                          false, true, null, null, false, 95),
  ('otro',                'Otro',                'Otros servicios a especificar',
                          false, false, null, null, true, 99)
on conflict (codigo) do nothing;


-- ────────────────────────────────────────────────────────────────────────────
-- 3) FK en mantenimientos (nullable — el enum se mantiene durante la transición)
-- ────────────────────────────────────────────────────────────────────────────

alter table public.mantenimientos
  add column if not exists tipo_servicio_id uuid
    references public.tipos_servicio(id) on delete set null;

create index if not exists mantenimientos_tipo_servicio_idx
  on public.mantenimientos (tipo_servicio_id);


-- ────────────────────────────────────────────────────────────────────────────
-- 4) Backfill: mapear el enum existente a las filas seed
--    Los códigos del seed coinciden con los enum values, así que el join es trivial.
-- ────────────────────────────────────────────────────────────────────────────

update public.mantenimientos m
   set tipo_servicio_id = ts.id
  from public.tipos_servicio ts
 where ts.codigo = m.tipo::text
   and m.tipo_servicio_id is null;
