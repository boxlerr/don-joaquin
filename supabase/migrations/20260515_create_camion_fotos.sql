-- Bucket público para fotos de camiones (mismo criterio que avatares-choferes)
insert into storage.buckets (id, name, public)
values ('fotos-camiones', 'fotos-camiones', true)
on conflict (id) do nothing;

-- Tabla camion_fotos: relación N a 1 con camion + referencia a documentos_archivos
create table public.camion_fotos (
  id uuid primary key default gen_random_uuid(),
  camion_id uuid not null references public.camiones(id) on delete cascade,
  archivo_id uuid not null references public.documentos_archivos(id) on delete cascade,
  descripcion text,
  es_principal boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references public.usuarios(id)
);

create index camion_fotos_camion_id_idx on public.camion_fotos (camion_id);
create unique index camion_fotos_una_principal
  on public.camion_fotos (camion_id) where es_principal;

alter table public.camion_fotos enable row level security;

create policy select_active_user on public.camion_fotos
  for select using (is_authenticated_active());

create policy insert_active_user on public.camion_fotos
  for insert with check (is_authenticated_active());

create policy update_active_user on public.camion_fotos
  for update using (is_authenticated_active()) with check (is_authenticated_active());

create policy delete_admin_only on public.camion_fotos
  for delete using (is_admin());
