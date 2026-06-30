-- Permisos por SUBSECCIÓN: un nivel más fino que las áreas.
-- Una subsección hereda el nivel de su área; el admin puede pisarlo por rol
-- (rol_secciones) para abrir/cerrar páginas puntuales sin tocar el resto del área.
-- Ej.: "Choferes sí, Sueldos no". Las marcadas `confidencial` arrancan cerradas
-- para no-admins aunque tengan el área (hay que otorgarlas explícitamente).
--
-- Aditiva: con rol_secciones vacía, todo hereda del área = comportamiento idéntico
-- al actual. Lo único que cambia es que "Sueldos" deja de ser admin-only hardcodeado
-- y pasa a ser configurable (arranca confidencial => solo admin, igual que hoy).

-- 1) Catálogo de subsecciones (espeja src/lib/secciones.ts) -------------------
create table if not exists public.secciones (
  codigo text primary key,
  area_codigo text not null references public.areas(codigo),
  nombre text not null,
  orden int not null default 0,
  confidencial boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists secciones_area_idx on public.secciones (area_codigo);

-- 2) Overrides de subsección por rol -----------------------------------------
create table if not exists public.rol_secciones (
  id uuid primary key default gen_random_uuid(),
  rol_id uuid not null references public.roles(id) on delete cascade,
  seccion_codigo text not null references public.secciones(codigo) on delete cascade,
  nivel area_nivel not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (rol_id, seccion_codigo)             -- upsert on conflict
);

create index if not exists rol_secciones_rol_idx on public.rol_secciones (rol_id);

-- 3) RLS: leer lo necesita getCurrentUser (cualquier usuario activo); escribir, solo admins
alter table public.secciones enable row level security;
alter table public.rol_secciones enable row level security;

drop policy if exists "select_active_user" on public.secciones;
create policy "select_active_user" on public.secciones
  for select using (is_authenticated_active());

drop policy if exists "select_active_user" on public.rol_secciones;
create policy "select_active_user" on public.rol_secciones
  for select using (is_authenticated_active());
drop policy if exists "insert_admin_only" on public.rol_secciones;
create policy "insert_admin_only" on public.rol_secciones
  for insert with check (is_admin());
drop policy if exists "update_admin_only" on public.rol_secciones;
create policy "update_admin_only" on public.rol_secciones
  for update using (is_admin()) with check (is_admin());
drop policy if exists "delete_admin_only" on public.rol_secciones;
create policy "delete_admin_only" on public.rol_secciones
  for delete using (is_admin());

-- Trigger updated_at
drop trigger if exists rol_secciones_set_updated_at on public.rol_secciones;
create trigger rol_secciones_set_updated_at
  before update on public.rol_secciones
  for each row execute function public.tg_set_updated_at();

-- 4) Seed del catálogo (idempotente) -----------------------------------------
insert into public.secciones (codigo, area_codigo, nombre, orden, confidencial) values
  ('choferes',                'logistica',     'Legajos',            10, false),
  ('choferes_ranking',        'logistica',     'Ranking',            11, false),
  ('choferes_rotacion',       'logistica',     'Rotación',           12, false),
  ('choferes_vacaciones',     'logistica',     'Vacaciones',         13, false),
  ('siniestros',              'logistica',     'Siniestros',         14, false),
  ('reportes',                'logistica',     'Reportes',           15, false),
  ('sueldos',                 'logistica',     'Sueldos',            16, true),
  ('viajes_listado',          'viajes',        'Listado y mensual',  10, false),
  ('viajes_hoja_ruta',        'viajes',        'Hoja de ruta',       11, false),
  ('viajes_carga_rapida',     'viajes',        'Carga rápida',       12, false),
  ('viajes_planilla',         'viajes',        'Planilla diaria',    13, false),
  ('camiones',                'flota',         'Camiones',           10, false),
  ('extintores',              'flota',         'Extintores',         11, false),
  ('mantenimiento_servicios', 'mantenimiento', 'Servicios',          10, false),
  ('mantenimiento_costos',    'mantenimiento', 'Costos rep. y rep.', 11, false),
  ('clientes',                'comercial',     'Clientes',           10, false),
  ('tarifas',                 'comercial',     'Tarifas',            11, false),
  ('gastos',                  'finanzas',      'Gastos',             10, false),
  ('cheques',                 'finanzas',      'Cheques',            11, false),
  ('impuestos',               'finanzas',      'Impuestos',          12, false),
  ('compliance_loma',         'compliance',    'Loma Negra',         10, false),
  ('compliance_ypf',          'compliance',    'YPF',                11, false),
  ('compliance_sicop',        'compliance',    'SICOP',              12, false),
  ('compliance_secondi',      'compliance',    'Secondi',            13, false),
  ('usuarios',                'sistema',       'Usuarios y permisos', 10, false),
  ('auditoria',               'sistema',       'Auditoría',          11, false),
  ('configuracion',           'sistema',       'Configuración',      12, false)
on conflict (codigo) do update
  set area_codigo = excluded.area_codigo,
      nombre      = excluded.nombre,
      orden       = excluded.orden,
      confidencial = excluded.confidencial;

-- 5) Helper para RLS futura: rango efectivo del usuario actual en una subsección.
--    Espeja la lógica de src/lib/auth.ts: admin=3; override de rol; confidencial=>0; si no, hereda el área.
--    INERTE por sí sola (recién segrega si se engancha en policies).
create or replace function public.current_seccion_rank(p_seccion text)
returns int language sql stable security definer
set search_path = public, pg_temp as $$
  with me as (
    select u.id, u.estado, r.codigo as rol_codigo, u.rol_id
    from public.usuarios u
    join public.roles r on r.id = u.rol_id
    where u.id = auth.uid()
  ),
  sec as (
    select area_codigo, confidencial from public.secciones where codigo = p_seccion
  )
  select case
    when not exists (select 1 from me) then 0
    when (select estado from me) <> 'activo' then 0
    when (select rol_codigo from me) = 'admin' then 3
    when exists (
      select 1 from public.rol_secciones
      where rol_id = (select rol_id from me) and seccion_codigo = p_seccion
    ) then (
      select public.nivel_rank(nivel::text) from public.rol_secciones
      where rol_id = (select rol_id from me) and seccion_codigo = p_seccion
    )
    when coalesce((select confidencial from sec), false) then 0
    else public.current_area_rank((select area_codigo from sec))
  end;
$$;
