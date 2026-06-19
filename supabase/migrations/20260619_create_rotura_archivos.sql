-- Adjuntar documentos a una rotura (factura del taller, foto del daño, etc.).
--
-- Pedido (19/06): al registrar una rotura se debe poder adjuntar el comprobante
-- (factura o lo que sea), más de uno, y luego verlos / descargarlos. Mismo
-- patrón que `siniestro_archivos`: tabla puente a `documentos_archivos` + bucket
-- propio. La subida es directa navegador → Storage con URL firmada
-- (createSignedUploadUrl), por lo que el límite real es el del bucket (100 MB),
-- igual que el legajo del chofer.

-- Bucket público para adjuntos de roturas, hasta 100 MB.
insert into storage.buckets (id, name, public, file_size_limit)
values ('documentos-roturas', 'documentos-roturas', true, 104857600)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      public = excluded.public;

-- Storage policies: cualquier usuario autenticado puede leer / subir / borrar.
drop policy if exists "roturas_select" on storage.objects;
create policy "roturas_select" on storage.objects
  for select using (bucket_id = 'documentos-roturas' and auth.role() = 'authenticated');

drop policy if exists "roturas_insert" on storage.objects;
create policy "roturas_insert" on storage.objects
  for insert with check (bucket_id = 'documentos-roturas' and auth.role() = 'authenticated');

drop policy if exists "roturas_delete" on storage.objects;
create policy "roturas_delete" on storage.objects
  for delete using (bucket_id = 'documentos-roturas' and auth.role() = 'authenticated');

-- Tabla puente de archivos adjuntos a roturas.
create table if not exists public.rotura_archivos (
  id          uuid primary key default gen_random_uuid(),
  rotura_id   uuid not null references public.roturas_gomas(id) on delete cascade,
  archivo_id  uuid not null references public.documentos_archivos(id) on delete cascade,
  descripcion text,
  created_at  timestamptz not null default now(),
  created_by  uuid references public.usuarios(id)
);

create index if not exists rotura_archivos_rotura_id_idx on public.rotura_archivos (rotura_id);

alter table public.rotura_archivos enable row level security;

drop policy if exists select_active_user on public.rotura_archivos;
create policy select_active_user on public.rotura_archivos
  for select using (is_authenticated_active());

drop policy if exists insert_active_user on public.rotura_archivos;
create policy insert_active_user on public.rotura_archivos
  for insert with check (is_authenticated_active());

drop policy if exists delete_admin_only on public.rotura_archivos;
create policy delete_admin_only on public.rotura_archivos
  for delete using (is_admin());
