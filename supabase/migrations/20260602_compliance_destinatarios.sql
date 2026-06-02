-- Organismos previos en compliance (SICOP, Secondi, etc.)
-- Son entidades distintas de los clientes finales (YPF, Loma Negra).
-- Se modelan como una dimensión separada para no contaminar el enum compliance_cliente_aplica.

-- Catálogo de organismos
create table if not exists public.compliance_destinatarios (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,        -- 'SICOP', 'SECONDI'
  nombre text not null,
  descripcion text,
  orden int not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS
alter table public.compliance_destinatarios enable row level security;
create policy "select_active_user" on public.compliance_destinatarios
  for select using (is_authenticated_active());
create policy "insert_active_user" on public.compliance_destinatarios
  for insert with check (is_authenticated_active());
create policy "update_active_user" on public.compliance_destinatarios
  for update using (is_authenticated_active()) with check (is_authenticated_active());
create policy "delete_admin_only" on public.compliance_destinatarios
  for delete using (is_admin());

drop trigger if exists compliance_destinatarios_set_updated_at on public.compliance_destinatarios;
create trigger compliance_destinatarios_set_updated_at
  before update on public.compliance_destinatarios
  for each row execute function public.tg_set_updated_at();

-- Seeds iniciales
insert into public.compliance_destinatarios (codigo, nombre, descripcion, orden) values
  ('SICOP', 'SICOP', 'Organismo de control — turnos gestionados por Noelia', 1),
  ('SECONDI', 'Secondi', 'Estudio contable — trámites previos habilitantes', 2)
on conflict (codigo) do nothing;

-- Extensión de compliance_requisitos para vincular a organismos
alter table public.compliance_requisitos
  add column if not exists tipo_destinatario text not null default 'cliente'
    check (tipo_destinatario in ('cliente', 'organismo'));

alter table public.compliance_requisitos
  add column if not exists destinatario_id uuid
    references public.compliance_destinatarios(id) on delete set null;

-- Constraint de coherencia: cliente → sin destinatario_id; organismo → con destinatario_id
alter table public.compliance_requisitos
  drop constraint if exists compliance_requisitos_destinatario_chk;
alter table public.compliance_requisitos
  add constraint compliance_requisitos_destinatario_chk check (
    (tipo_destinatario = 'cliente'   and destinatario_id is null) or
    (tipo_destinatario = 'organismo' and destinatario_id is not null)
  );

-- Índice para filtrar por organismo
create index if not exists compliance_requisitos_destinatario_idx
  on public.compliance_requisitos (destinatario_id)
  where destinatario_id is not null;

-- Relajar fecha_vencimiento NOT NULL en compliance_documentos para organismos
-- (los organismos a veces no tienen fecha de vencimiento definida)
alter table public.compliance_documentos
  alter column fecha_vencimiento drop not null;
