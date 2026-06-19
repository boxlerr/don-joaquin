-- Adjuntar documentos a un servicio / mantenimiento (factura del taller,
-- remito de la concesionaria, foto, etc.).
--
-- Mismo patrón que `rotura_archivos` / `siniestro_archivos`: tabla puente a
-- `documentos_archivos` + bucket propio. La subida es directa navegador →
-- Storage con URL firmada (createSignedUploadUrl), por lo que el límite real es
-- el del bucket (100 MB), igual que el legajo del chofer.

-- Bucket público para adjuntos de mantenimientos, hasta 100 MB.
insert into storage.buckets (id, name, public, file_size_limit)
values ('documentos-mantenimiento', 'documentos-mantenimiento', true, 104857600)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      public = excluded.public;

-- Storage policies: cualquier usuario autenticado puede leer / subir / borrar.
drop policy if exists "mantenimiento_select" on storage.objects;
create policy "mantenimiento_select" on storage.objects
  for select using (bucket_id = 'documentos-mantenimiento' and auth.role() = 'authenticated');

drop policy if exists "mantenimiento_insert" on storage.objects;
create policy "mantenimiento_insert" on storage.objects
  for insert with check (bucket_id = 'documentos-mantenimiento' and auth.role() = 'authenticated');

drop policy if exists "mantenimiento_delete" on storage.objects;
create policy "mantenimiento_delete" on storage.objects
  for delete using (bucket_id = 'documentos-mantenimiento' and auth.role() = 'authenticated');

-- Tabla puente de archivos adjuntos a mantenimientos.
create table if not exists public.mantenimiento_archivos (
  id              uuid primary key default gen_random_uuid(),
  mantenimiento_id uuid not null references public.mantenimientos(id) on delete cascade,
  archivo_id      uuid not null references public.documentos_archivos(id) on delete cascade,
  descripcion     text,
  created_at      timestamptz not null default now(),
  created_by      uuid references public.usuarios(id)
);

create index if not exists mantenimiento_archivos_mantenimiento_id_idx
  on public.mantenimiento_archivos (mantenimiento_id);

alter table public.mantenimiento_archivos enable row level security;

drop policy if exists select_active_user on public.mantenimiento_archivos;
create policy select_active_user on public.mantenimiento_archivos
  for select using (is_authenticated_active());

drop policy if exists insert_active_user on public.mantenimiento_archivos;
create policy insert_active_user on public.mantenimiento_archivos
  for insert with check (is_authenticated_active());

drop policy if exists delete_admin_only on public.mantenimiento_archivos;
create policy delete_admin_only on public.mantenimiento_archivos
  for delete using (is_admin());
