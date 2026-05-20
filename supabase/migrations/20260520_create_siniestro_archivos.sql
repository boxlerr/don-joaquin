-- Bucket público para adjuntos de siniestros
insert into storage.buckets (id, name, public)
values ('documentos-siniestros', 'documentos-siniestros', true)
on conflict (id) do nothing;

-- Storage policy: cualquier usuario autenticado puede leer
create policy "siniestros_select" on storage.objects
  for select using (bucket_id = 'documentos-siniestros' and auth.role() = 'authenticated');

-- Storage policy: autenticados pueden subir
create policy "siniestros_insert" on storage.objects
  for insert with check (bucket_id = 'documentos-siniestros' and auth.role() = 'authenticated');

-- Storage policy: autenticados pueden eliminar
create policy "siniestros_delete" on storage.objects
  for delete using (bucket_id = 'documentos-siniestros' and auth.role() = 'authenticated');

-- Tabla de archivos adjuntos a siniestros
create table public.siniestro_archivos (
  id          uuid primary key default gen_random_uuid(),
  siniestro_id uuid not null references public.siniestros(id) on delete cascade,
  archivo_id  uuid not null references public.documentos_archivos(id) on delete cascade,
  descripcion text,
  created_at  timestamptz not null default now(),
  created_by  uuid references public.usuarios(id)
);

create index siniestro_archivos_siniestro_id_idx on public.siniestro_archivos (siniestro_id);

alter table public.siniestro_archivos enable row level security;

create policy select_active_user on public.siniestro_archivos
  for select using (is_authenticated_active());

create policy insert_active_user on public.siniestro_archivos
  for insert with check (is_authenticated_active());

create policy delete_admin_only on public.siniestro_archivos
  for delete using (is_admin());
