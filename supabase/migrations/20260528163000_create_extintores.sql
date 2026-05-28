-- Migración para crear la tabla de extintores (matafuegos)
-- Creado: 28/05/2026

create table if not exists public.extintores (
  id uuid primary key default gen_random_uuid(),
  dominio text not null,
  n_extintor text not null,
  n_interno text,
  capacidad text,
  fecha_vencimiento date,
  categoria text not null, -- 'chasis', 'acoplado', 'otros'
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Índices para búsquedas y filtros rápidos
create index if not exists extintores_dominio_idx on public.extintores (dominio);
create index if not exists extintores_fecha_vencimiento_idx on public.extintores (fecha_vencimiento);
create index if not exists extintores_categoria_idx on public.extintores (categoria);

-- Habilitar Row Level Security (RLS)
alter table public.extintores enable row level security;

-- Políticas de Seguridad RLS
create policy select_active_user on public.extintores
  for select using (is_authenticated_active());

create policy insert_active_user on public.extintores
  for insert with check (is_authenticated_active());

create policy update_active_user on public.extintores
  for update using (is_authenticated_active()) with check (is_authenticated_active());

create policy delete_admin_only on public.extintores
  for delete using (is_admin());

-- Trigger para mantener actualizado updated_at
drop trigger if exists extintores_set_updated_at on public.extintores;
create trigger extintores_set_updated_at
  before update on public.extintores
  for each row execute function public.tg_set_updated_at();
