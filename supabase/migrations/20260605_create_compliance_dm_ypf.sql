-- Migración para guardar los Documentos de Medición (DM) de YPF
-- Creado: 05/06/2026
-- Contexto: el DM es el PDF quincenal que firma YPF para que Joaquín pueda
-- facturar. Hoy el importador procesa el PDF y crea los viajes, pero
-- descarta el archivo original. Necesitamos guardarlo para auditoría y
-- para que Bárbara pueda volver a ver el papel oficial.
--
-- MVP: una fila por DM con metadatos de la carátula (página 1) +
-- referencia al archivo en storage (documentos_archivos).

create table if not exists public.compliance_dm_ypf (
  id uuid primary key default gen_random_uuid(),
  -- Período que certifica el DM (típicamente 1ª o 2ª quincena de un mes)
  periodo_desde date not null,
  periodo_hasta date not null,
  -- Datos administrativos de la carátula (SAP / YPF)
  numero_solpe text,
  numero_pedido text,
  contrato_sap text,
  solicitante text,
  -- Total certificado en ARS según la carátula del DM
  total_certificado_ars numeric(14, 2),
  -- Fecha en que YPF firmó el documento
  fecha_certificacion date,
  -- Archivo PDF original en storage
  archivo_id uuid references public.documentos_archivos(id) on delete set null,
  -- Quién y cuándo lo importó al sistema
  importado_por uuid references auth.users(id),
  importado_en timestamptz not null default now(),
  -- Estado de procesamiento: 'importado' (cargado al sistema, viajes creados),
  -- 'conciliado' (los viajes vinculados cuadran contra el total del DM)
  estado text not null default 'importado',
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint compliance_dm_ypf_periodo_ok
    check (periodo_hasta >= periodo_desde),
  constraint compliance_dm_ypf_estado_check
    check (estado in ('importado', 'conciliado'))
);

-- Índices: lo más común es buscar por período (más recientes primero)
create index if not exists compliance_dm_ypf_periodo_idx
  on public.compliance_dm_ypf (periodo_desde desc);

-- Único: un mismo período no debería cargarse dos veces. Si pasa, hay que
-- borrar el viejo primero (o conciliar manualmente). El índice impide
-- duplicados accidentales del mismo PDF.
create unique index if not exists compliance_dm_ypf_periodo_unico
  on public.compliance_dm_ypf (periodo_desde, periodo_hasta);

-- Vinculación opcional viaje -> DM. Permite saber de qué DM viene cada
-- viaje cargado vía importador (no rompe los viajes legados sin DM).
alter table public.viajes
  add column if not exists dm_ypf_id uuid
  references public.compliance_dm_ypf(id) on delete set null;

create index if not exists viajes_dm_ypf_id_idx
  on public.viajes (dm_ypf_id) where dm_ypf_id is not null;

-- Row Level Security (mismo esquema que el resto de las tablas)
alter table public.compliance_dm_ypf enable row level security;

create policy select_active_user on public.compliance_dm_ypf
  for select using (is_authenticated_active());

create policy insert_active_user on public.compliance_dm_ypf
  for insert with check (is_authenticated_active());

create policy update_active_user on public.compliance_dm_ypf
  for update using (is_authenticated_active()) with check (is_authenticated_active());

create policy delete_admin_only on public.compliance_dm_ypf
  for delete using (is_admin());

-- Trigger de updated_at (usa la función genérica del proyecto si existe)
create or replace function public.tg_compliance_dm_ypf_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tg_compliance_dm_ypf_updated_at on public.compliance_dm_ypf;
create trigger tg_compliance_dm_ypf_updated_at
  before update on public.compliance_dm_ypf
  for each row execute function public.tg_compliance_dm_ypf_updated_at();
