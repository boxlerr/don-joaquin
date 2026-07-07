-- Pipeline de CVs en Entrevistas: etapa del candidato en el proceso de selección
-- + CVs adjuntos (multi-archivo, mismo patrón que el resto del sistema).

-- 1) Etapa del pipeline de reclutamiento.
alter table public.entrevistas add column if not exists etapa text not null default 'nuevo';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'entrevistas_etapa_check') then
    alter table public.entrevistas add constraint entrevistas_etapa_check
      check (etapa in ('nuevo', 'entrevista', 'preocupacional', 'ingresado', 'descartado'));
  end if;
end $$;

-- Backfill de la etapa a partir del estado actual (idempotente: solo toca los que
-- quedaron en el default).
update public.entrevistas set etapa = case
  when resultado = 'ingresa' then 'ingresado'
  when resultado = 'no_ingresa' then 'descartado'
  when preocupacional in ('pendiente', 'apto', 'no_apto') then 'preocupacional'
  when fecha_entrevista is not null then 'entrevista'
  else 'nuevo'
end
where etapa = 'nuevo';

create index if not exists entrevistas_etapa_idx on public.entrevistas (etapa);

-- 2) CVs adjuntos (tabla puente → documentos_archivos), igual que apercibimiento_archivos.
create table if not exists public.entrevista_archivos (
  id            uuid primary key default gen_random_uuid(),
  entrevista_id uuid not null references public.entrevistas(id) on delete cascade,
  archivo_id    uuid not null references public.documentos_archivos(id) on delete cascade,
  created_at    timestamptz not null default now(),
  created_by    uuid references public.usuarios(id) on delete set null
);
create index if not exists entrevista_archivos_ent_idx on public.entrevista_archivos (entrevista_id);
create unique index if not exists entrevista_archivos_uniq on public.entrevista_archivos (entrevista_id, archivo_id);

alter table public.entrevista_archivos enable row level security;
drop policy if exists select_active_user on public.entrevista_archivos;
create policy select_active_user on public.entrevista_archivos for select using (is_authenticated_active());
drop policy if exists insert_active_user on public.entrevista_archivos;
create policy insert_active_user on public.entrevista_archivos for insert with check (is_authenticated_active());
drop policy if exists delete_active_user on public.entrevista_archivos;
create policy delete_active_user on public.entrevista_archivos for delete using (is_authenticated_active());
