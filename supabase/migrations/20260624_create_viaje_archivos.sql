-- Ítem 3: adjuntar remito y factura (PDF/foto) a un viaje. Aplicada vía MCP.
-- Mismo patrón que mantenimiento_archivos: tabla puente a documentos_archivos + bucket propio,
-- subida directa navegador → Storage con URL firmada (límite del bucket: 100 MB).

insert into storage.buckets (id, name, public, file_size_limit)
values ('documentos-viajes', 'documentos-viajes', true, 104857600)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit, public = excluded.public;

drop policy if exists "viajes_archivos_select" on storage.objects;
create policy "viajes_archivos_select" on storage.objects
  for select using (bucket_id = 'documentos-viajes' and auth.role() = 'authenticated');

drop policy if exists "viajes_archivos_insert" on storage.objects;
create policy "viajes_archivos_insert" on storage.objects
  for insert with check (bucket_id = 'documentos-viajes' and auth.role() = 'authenticated');

drop policy if exists "viajes_archivos_delete" on storage.objects;
create policy "viajes_archivos_delete" on storage.objects
  for delete using (bucket_id = 'documentos-viajes' and auth.role() = 'authenticated');

create table if not exists public.viaje_archivos (
  id          uuid primary key default gen_random_uuid(),
  viaje_id    uuid not null references public.viajes(id) on delete cascade,
  archivo_id  uuid not null references public.documentos_archivos(id) on delete cascade,
  tipo        text not null default 'otro' check (tipo in ('remito','factura','otro')),
  descripcion text,
  created_at  timestamptz not null default now(),
  created_by  uuid references public.usuarios(id)
);

create index if not exists viaje_archivos_viaje_id_idx on public.viaje_archivos (viaje_id);

alter table public.viaje_archivos enable row level security;

-- RLS coherente con el módulo de viajes (is_authenticated_active). En la Fase 2 de
-- RLS-por-área se convierte a can_read_area('viajes')/can_write_area('viajes').
drop policy if exists select_active_user on public.viaje_archivos;
create policy select_active_user on public.viaje_archivos for select using (is_authenticated_active());
drop policy if exists insert_active_user on public.viaje_archivos;
create policy insert_active_user on public.viaje_archivos for insert with check (is_authenticated_active());
drop policy if exists delete_admin_only on public.viaje_archivos;
create policy delete_admin_only on public.viaje_archivos for delete using (is_admin());
