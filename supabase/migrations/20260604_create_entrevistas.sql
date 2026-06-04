-- Migración para crear la tabla de entrevistas (registro de reclutamiento / RRHH)
-- Creado: 04/06/2026
-- Objetivo: que Bárbara registre a cada persona que entrevista (nombre, fecha,
-- edad, de dónde es) con sus observaciones libres, el estado del preocupacional
-- y si finalmente ingresa al transporte. Sirve como base de datos buscable para
-- saber si alguien ya fue entrevistado en el pasado.

create table if not exists public.entrevistas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  fecha_entrevista date,
  edad integer,
  localidad text,                       -- "de dónde es"
  telefono text,
  observaciones text,                   -- notas libres de Bárbara (campo central)
  -- Preocupacional: 'no_aplica' | 'pendiente' (se le va a hacer) |
  --                 'apto' (se hizo y dio bien) | 'no_apto' (se hizo y dio mal)
  preocupacional text not null default 'no_aplica',
  -- Resultado: 'pendiente' | 'ingresa' (entra al transporte) | 'no_ingresa'
  resultado text not null default 'pendiente',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint entrevistas_edad_check
    check (edad is null or (edad >= 14 and edad <= 99)),
  constraint entrevistas_preocupacional_check
    check (preocupacional in ('no_aplica', 'pendiente', 'apto', 'no_apto')),
  constraint entrevistas_resultado_check
    check (resultado in ('pendiente', 'ingresa', 'no_ingresa'))
);

-- Índices para búsqueda y orden
create index if not exists entrevistas_nombre_idx on public.entrevistas (lower(nombre));
create index if not exists entrevistas_fecha_idx on public.entrevistas (fecha_entrevista desc);
create index if not exists entrevistas_resultado_idx on public.entrevistas (resultado);

-- Row Level Security (mismo esquema que el resto de las tablas)
alter table public.entrevistas enable row level security;

create policy select_active_user on public.entrevistas
  for select using (is_authenticated_active());

create policy insert_active_user on public.entrevistas
  for insert with check (is_authenticated_active());

create policy update_active_user on public.entrevistas
  for update using (is_authenticated_active()) with check (is_authenticated_active());

create policy delete_admin_only on public.entrevistas
  for delete using (is_admin());

-- Trigger para mantener actualizado updated_at
drop trigger if exists entrevistas_set_updated_at on public.entrevistas;
create trigger entrevistas_set_updated_at
  before update on public.entrevistas
  for each row execute function public.tg_set_updated_at();
