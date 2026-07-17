-- Permisos por usuario individual A NIVEL SUBSECCIÓN, con vencimiento opcional.
-- Análogo a `usuario_areas`, pero fino: permite otorgar UNA sección confidencial
-- (Préstamos, Cheques, Impuestos…) a UN usuario puntual SIN abrírsela a todo su
-- rol (lo que sí haría `rol_secciones`). Caso de uso: Paula (mamá) es un
-- Administrativo más, pero ve Cheques + Préstamos y el resto de los
-- administrativos no (audios Bárbara 17/07).
--
-- Como `usuario_areas`: solo SUMA sobre el permiso ya resuelto (nunca resta), y
-- si `vence_en` ya pasó, la fila se ignora al calcular permisos.
create table if not exists public.usuario_secciones (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  seccion_codigo text not null references public.secciones(codigo) on delete cascade,
  nivel area_nivel not null,
  vence_en timestamptz,                          -- null=permanente; pasado=expirado
  otorgado_por uuid references public.usuarios(id) on delete set null,
  motivo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (usuario_id, seccion_codigo)            -- upsert on conflict
);

create index if not exists usuario_secciones_usuario_idx on public.usuario_secciones (usuario_id);
create index if not exists usuario_secciones_vence_idx on public.usuario_secciones (vence_en)
  where vence_en is not null;

-- RLS: cualquier usuario activo puede leer (getCurrentUser lo necesita);
--      solo admins escriben y borran.
alter table public.usuario_secciones enable row level security;

drop policy if exists "select_active_user" on public.usuario_secciones;
create policy "select_active_user" on public.usuario_secciones
  for select using (is_authenticated_active());

drop policy if exists "insert_admin_only" on public.usuario_secciones;
create policy "insert_admin_only" on public.usuario_secciones
  for insert with check (is_admin());

drop policy if exists "update_admin_only" on public.usuario_secciones;
create policy "update_admin_only" on public.usuario_secciones
  for update using (is_admin()) with check (is_admin());

drop policy if exists "delete_admin_only" on public.usuario_secciones;
create policy "delete_admin_only" on public.usuario_secciones
  for delete using (is_admin());

-- Trigger updated_at
drop trigger if exists usuario_secciones_set_updated_at on public.usuario_secciones;
create trigger usuario_secciones_set_updated_at
  before update on public.usuario_secciones
  for each row execute function public.tg_set_updated_at();
