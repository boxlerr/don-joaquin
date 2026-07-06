-- Multi-archivo en documentos: pasar las entidades que hoy tienen UN solo archivo
-- (columna archivo_id) a tablas puente `<entidad>_archivos` — mismo patrón que
-- siniestro_archivos / viaje_archivos / mantenimiento_archivos. Así se pueden
-- adjuntar VARIOS archivos (ej: el acta + el video del apercibimiento).
--
-- La columna archivo_id vieja se conserva (deprecada) para no romper nada; los
-- datos existentes se copian a la tabla puente en el backfill de abajo.

-- Helper: crea una tabla puente estándar (id, <entidad>_id, archivo_id, created_at, created_by)
-- con FKs en cascada, índice por entidad y RLS igual que siniestro_archivos.

-- 1) apercibimientos ────────────────────────────────────────────────────────
create table if not exists public.apercibimiento_archivos (
  id             uuid primary key default gen_random_uuid(),
  apercibimiento_id uuid not null references public.chofer_apercibimientos(id) on delete cascade,
  archivo_id     uuid not null references public.documentos_archivos(id) on delete cascade,
  created_at     timestamptz not null default now(),
  created_by     uuid references public.usuarios(id) on delete set null
);
create index if not exists apercibimiento_archivos_ent_idx on public.apercibimiento_archivos (apercibimiento_id);
create unique index if not exists apercibimiento_archivos_uniq on public.apercibimiento_archivos (apercibimiento_id, archivo_id);

-- 2) documentos del chofer ───────────────────────────────────────────────────
create table if not exists public.chofer_documento_archivos (
  id             uuid primary key default gen_random_uuid(),
  chofer_documento_id uuid not null references public.chofer_documentos(id) on delete cascade,
  archivo_id     uuid not null references public.documentos_archivos(id) on delete cascade,
  created_at     timestamptz not null default now(),
  created_by     uuid references public.usuarios(id) on delete set null
);
create index if not exists chofer_documento_archivos_ent_idx on public.chofer_documento_archivos (chofer_documento_id);
create unique index if not exists chofer_documento_archivos_uniq on public.chofer_documento_archivos (chofer_documento_id, archivo_id);

-- 3) documentos del camión ───────────────────────────────────────────────────
create table if not exists public.camion_documento_archivos (
  id             uuid primary key default gen_random_uuid(),
  camion_documento_id uuid not null references public.camion_documentos(id) on delete cascade,
  archivo_id     uuid not null references public.documentos_archivos(id) on delete cascade,
  created_at     timestamptz not null default now(),
  created_by     uuid references public.usuarios(id) on delete set null
);
create index if not exists camion_documento_archivos_ent_idx on public.camion_documento_archivos (camion_documento_id);
create unique index if not exists camion_documento_archivos_uniq on public.camion_documento_archivos (camion_documento_id, archivo_id);

-- 4) documentos de compliance ────────────────────────────────────────────────
create table if not exists public.compliance_documento_archivos (
  id             uuid primary key default gen_random_uuid(),
  compliance_documento_id uuid not null references public.compliance_documentos(id) on delete cascade,
  archivo_id     uuid not null references public.documentos_archivos(id) on delete cascade,
  created_at     timestamptz not null default now(),
  created_by     uuid references public.usuarios(id) on delete set null
);
create index if not exists compliance_documento_archivos_ent_idx on public.compliance_documento_archivos (compliance_documento_id);
create unique index if not exists compliance_documento_archivos_uniq on public.compliance_documento_archivos (compliance_documento_id, archivo_id);

-- RLS igual que siniestro_archivos: leer/insertar = usuario activo, borrar = admin.
do $$
declare t text;
begin
  foreach t in array array[
    'apercibimiento_archivos','chofer_documento_archivos','camion_documento_archivos','compliance_documento_archivos'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists select_active_user on public.%I', t);
    execute format('create policy select_active_user on public.%I for select using (is_authenticated_active())', t);
    execute format('drop policy if exists insert_active_user on public.%I', t);
    execute format('create policy insert_active_user on public.%I for insert with check (is_authenticated_active())', t);
    execute format('drop policy if exists update_active_user on public.%I', t);
    execute format('create policy update_active_user on public.%I for update using (is_authenticated_active()) with check (is_authenticated_active())', t);
    execute format('drop policy if exists delete_admin_only on public.%I', t);
    execute format('create policy delete_admin_only on public.%I for delete using (is_admin())', t);
  end loop;
end $$;

-- Backfill: copiar el archivo único existente a la tabla puente (idempotente).
insert into public.apercibimiento_archivos (apercibimiento_id, archivo_id, created_by)
select a.id, a.archivo_id, a.created_by
from public.chofer_apercibimientos a
where a.archivo_id is not null
  and not exists (select 1 from public.apercibimiento_archivos x where x.apercibimiento_id = a.id and x.archivo_id = a.archivo_id);

insert into public.chofer_documento_archivos (chofer_documento_id, archivo_id)
select d.id, d.archivo_id
from public.chofer_documentos d
where d.archivo_id is not null
  and not exists (select 1 from public.chofer_documento_archivos x where x.chofer_documento_id = d.id and x.archivo_id = d.archivo_id);

insert into public.camion_documento_archivos (camion_documento_id, archivo_id)
select d.id, d.archivo_id
from public.camion_documentos d
where d.archivo_id is not null
  and not exists (select 1 from public.camion_documento_archivos x where x.camion_documento_id = d.id and x.archivo_id = d.archivo_id);

insert into public.compliance_documento_archivos (compliance_documento_id, archivo_id)
select d.id, d.archivo_id
from public.compliance_documentos d
where d.archivo_id is not null
  and not exists (select 1 from public.compliance_documento_archivos x where x.compliance_documento_id = d.id and x.archivo_id = d.archivo_id);
