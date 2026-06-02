-- Permisos por usuario individual con vencimiento opcional.
-- Funcionan como "overrides que solo suman" sobre el permiso de rol:
-- si el override es igual o menor al nivel que ya otorga el rol, no tiene efecto.
-- Si vence_en no es null y ya pasó, la fila se ignora al calcular permisos.
create table if not exists public.usuario_areas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  area_codigo text not null references public.areas(codigo),
  nivel area_nivel not null,
  vence_en timestamptz,                         -- null=permanente; pasado=expirado
  otorgado_por uuid references public.usuarios(id) on delete set null,
  motivo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (usuario_id, area_codigo)              -- upsert on conflict
);

-- Índices para lookups frecuentes
create index if not exists usuario_areas_usuario_idx on public.usuario_areas (usuario_id);
create index if not exists usuario_areas_vence_idx on public.usuario_areas (vence_en)
  where vence_en is not null;

-- RLS: cualquier usuario activo puede leer (getCurrentUser lo necesita);
--      solo admins escriben y borran.
alter table public.usuario_areas enable row level security;

create policy "select_active_user" on public.usuario_areas
  for select using (is_authenticated_active());

create policy "insert_admin_only" on public.usuario_areas
  for insert with check (is_admin());

create policy "update_admin_only" on public.usuario_areas
  for update using (is_admin()) with check (is_admin());

create policy "delete_admin_only" on public.usuario_areas
  for delete using (is_admin());

-- Trigger updated_at
drop trigger if exists usuario_areas_set_updated_at on public.usuario_areas;
create trigger usuario_areas_set_updated_at
  before update on public.usuario_areas
  for each row execute function public.tg_set_updated_at();
