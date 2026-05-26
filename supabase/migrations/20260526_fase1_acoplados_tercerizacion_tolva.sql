-- FASE 1 del plan post-feedback (26/05/2026):
--   1) Tabla `acoplados` separada del `camiones` (un acoplado físico, con patente propia)
--   2) Tabla `camion_acoplados` con historial — un camión puede tener varios acoplados a la vez
--      y se conserva la línea temporal de qué acoplado tuvo cuándo
--   3) `camiones.km_actual` como snapshot nativo (la view sigue calculándolo, pero el campo
--      facilita imports masivos y reportes puntuales)
--   4) `camiones.tercerizacion_estado` — Scania (tercerizado), Iveco (en transición),
--      Volvo/Mercedes (interno). Sin este flag no se puede adaptar el form de mantenimiento.
--   5) `camiones.es_tolva` — el Excel de Bárbara marca tolvas por color de celda


-- ────────────────────────────────────────────────────────────────────────────
-- 1) Tercerización por unidad
-- ────────────────────────────────────────────────────────────────────────────

do $$ begin
  create type public.tercerizacion_estado as enum ('interno', 'en_transicion', 'tercerizado');
exception
  when duplicate_object then null;
end $$;

alter table public.camiones
  add column if not exists tercerizacion_estado public.tercerizacion_estado;

-- Backfill por marca según el feedback (punto 2 corregido del Notion)
update public.camiones
   set tercerizacion_estado = case
     when lower(marca) = 'scania'   then 'tercerizado'::public.tercerizacion_estado
     when lower(marca) = 'iveco'    then 'en_transicion'::public.tercerizacion_estado
     when lower(marca) = 'volvo'    then 'interno'::public.tercerizacion_estado
     when lower(marca) = 'mercedes' then 'interno'::public.tercerizacion_estado
     when lower(marca) like 'mercedes%' then 'interno'::public.tercerizacion_estado
     else 'interno'::public.tercerizacion_estado
   end
 where tercerizacion_estado is null;

alter table public.camiones
  alter column tercerizacion_estado set default 'interno',
  alter column tercerizacion_estado set not null;


-- ────────────────────────────────────────────────────────────────────────────
-- 2) Snapshot de km en camiones (la view sigue siendo la fuente de verdad para
--    el "km actual calculado", pero un campo nativo permite cargar el km de
--    arranque desde el Excel sin tener que insertar una carga falsa)
-- ────────────────────────────────────────────────────────────────────────────

alter table public.camiones
  add column if not exists km_actual numeric;

alter table public.camiones
  add constraint camiones_km_actual_positive
  check (km_actual is null or km_actual >= 0);


-- ────────────────────────────────────────────────────────────────────────────
-- 3) Tolvas marcadas por color en el Excel de Bárbara
-- ────────────────────────────────────────────────────────────────────────────

alter table public.camiones
  add column if not exists es_tolva boolean not null default false;


-- ────────────────────────────────────────────────────────────────────────────
-- 4) Acoplados — entidad física propia
-- ────────────────────────────────────────────────────────────────────────────

do $$ begin
  create type public.acoplado_tipo as enum (
    'semi_tolva',
    'batea',
    'sider',
    'semi_furgon',
    'cisterna',
    'jaula',
    'plancha',
    'otro'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.acoplado_estado as enum (
    'activo',
    'inactivo',
    'baja',
    'en_mantenimiento'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.acoplados (
  id              uuid primary key default gen_random_uuid(),
  patente         text not null unique,
  marca           text,
  modelo          text,
  ano             integer,
  capacidad_tn    numeric,
  tipo            public.acoplado_tipo,
  es_tolva        boolean not null default false,
  estado          public.acoplado_estado not null default 'activo',
  observaciones   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references public.usuarios(id) on delete set null,
  constraint acoplados_capacidad_tn_positive check (capacidad_tn is null or capacidad_tn > 0),
  constraint acoplados_ano_check check (ano is null or (ano >= 1950 and ano <= 2100))
);

create index if not exists acoplados_estado_idx on public.acoplados (estado);
create index if not exists acoplados_es_tolva_idx on public.acoplados (es_tolva) where es_tolva;

alter table public.acoplados enable row level security;

create policy select_active_user on public.acoplados
  for select using (is_authenticated_active());

create policy insert_active_user on public.acoplados
  for insert with check (is_authenticated_active());

create policy update_active_user on public.acoplados
  for update using (is_authenticated_active()) with check (is_authenticated_active());

create policy delete_admin_only on public.acoplados
  for delete using (is_admin());


-- ────────────────────────────────────────────────────────────────────────────
-- 5) camion_acoplados — vínculo histórico camión↔acoplado
--    Un camión puede tener N acoplados activos a la vez.
--    Un acoplado físicamente está en UN camión por vez → solo una asignación
--    abierta por acoplado (partial unique index sobre hasta IS NULL).
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists public.camion_acoplados (
  id            uuid primary key default gen_random_uuid(),
  camion_id     uuid not null references public.camiones(id) on delete cascade,
  acoplado_id   uuid not null references public.acoplados(id) on delete cascade,
  desde         date not null default current_date,
  hasta         date,
  observaciones text,
  created_at    timestamptz not null default now(),
  created_by    uuid references public.usuarios(id) on delete set null,
  constraint camion_acoplados_periodo_ok check (hasta is null or hasta >= desde)
);

create index if not exists camion_acoplados_camion_idx
  on public.camion_acoplados (camion_id);

create index if not exists camion_acoplados_acoplado_idx
  on public.camion_acoplados (acoplado_id);

-- Solo una asignación "abierta" por acoplado (no puede estar en dos camiones al mismo tiempo)
create unique index if not exists camion_acoplados_una_abierta_por_acoplado
  on public.camion_acoplados (acoplado_id)
  where hasta is null;

alter table public.camion_acoplados enable row level security;

create policy select_active_user on public.camion_acoplados
  for select using (is_authenticated_active());

create policy insert_active_user on public.camion_acoplados
  for insert with check (is_authenticated_active());

create policy update_active_user on public.camion_acoplados
  for update using (is_authenticated_active()) with check (is_authenticated_active());

create policy delete_admin_only on public.camion_acoplados
  for delete using (is_admin());


-- ────────────────────────────────────────────────────────────────────────────
-- 6) Trigger genérico de updated_at en las nuevas tablas
-- ────────────────────────────────────────────────────────────────────────────

create or replace function public.tg_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists acoplados_set_updated_at on public.acoplados;
create trigger acoplados_set_updated_at
  before update on public.acoplados
  for each row execute function public.tg_set_updated_at();
