-- Migración: archivar la Liquidación de Fletes de Loma Negra + guardar más datos del Excel
-- Creado: 23/06/2026
-- Contexto: el importador de la "Liq. de Fletes" de Loma (viajes/import-loma) procesa
-- el Excel y crea los viajes, pero hoy descarta el archivo original y varios datos del
-- propio Excel. Espejamos el patrón de compliance_dm_ypf para:
--   1) Guardar cada liquidación importada (con su Excel descargable) en Compliance → Loma.
--   2) Vincular cada viaje con la liquidación de la que salió (viajes.liq_loma_id).
--   3) Conservar los acoplados (Placa Remolque 1/2/3) que antes se tiraban.
--
-- Notas:
--   - viajes.fecha_salida / fecha_llegada YA existen → ahí van inicio/fin del transporte.
--   - puntos_ruta.localidad / provincia YA existen → ahí va la dirección de Loma.

-- ────────────────────────────────────────────────────────────────────────────
-- 1) Tabla de liquidaciones de Loma (una fila por Excel importado)
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists public.compliance_liq_loma (
  id uuid primary key default gen_random_uuid(),
  -- Período que cubre la liquidación (derivado del min/max de fechas de los fletes)
  periodo_desde date,
  periodo_hasta date,
  -- Total facturado en ARS = suma de los importes de los fletes importados
  total_importe_ars numeric(14, 2),
  -- Cuántos fletes se cargaron desde esta liquidación
  fletes_count integer not null default 0,
  -- Excel original en storage (documentos_archivos)
  archivo_id uuid references public.documentos_archivos(id) on delete set null,
  -- Quién y cuándo lo importó
  importado_por uuid references auth.users(id),
  importado_en timestamptz not null default now(),
  estado text not null default 'importado',
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint compliance_liq_loma_periodo_ok
    check (periodo_hasta is null or periodo_desde is null or periodo_hasta >= periodo_desde),
  constraint compliance_liq_loma_estado_check
    check (estado in ('importado', 'conciliado'))
);

create index if not exists compliance_liq_loma_periodo_idx
  on public.compliance_liq_loma (periodo_desde desc);

-- ────────────────────────────────────────────────────────────────────────────
-- 2) Vinculación viaje -> liquidación + acoplados crudos del Excel
-- ────────────────────────────────────────────────────────────────────────────

alter table public.viajes
  add column if not exists liq_loma_id uuid
  references public.compliance_liq_loma(id) on delete set null;

create index if not exists viajes_liq_loma_id_idx
  on public.viajes (liq_loma_id) where liq_loma_id is not null;

-- Patentes de los acoplados tal cual vienen en la liquidación (Placa Remolque 1/2/3).
-- Texto, no FK: los acoplados de Loma pueden no existir en la tabla `acoplados`.
alter table public.viajes
  add column if not exists acoplados text[];

-- ────────────────────────────────────────────────────────────────────────────
-- 3) RLS (mismo esquema que compliance_dm_ypf)
-- ────────────────────────────────────────────────────────────────────────────

alter table public.compliance_liq_loma enable row level security;

create policy select_active_user on public.compliance_liq_loma
  for select using (is_authenticated_active());

create policy insert_active_user on public.compliance_liq_loma
  for insert with check (is_authenticated_active());

create policy update_active_user on public.compliance_liq_loma
  for update using (is_authenticated_active()) with check (is_authenticated_active());

create policy delete_admin_only on public.compliance_liq_loma
  for delete using (is_admin());

-- ────────────────────────────────────────────────────────────────────────────
-- 4) Trigger de updated_at
-- ────────────────────────────────────────────────────────────────────────────

create or replace function public.tg_compliance_liq_loma_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tg_compliance_liq_loma_updated_at on public.compliance_liq_loma;
create trigger tg_compliance_liq_loma_updated_at
  before update on public.compliance_liq_loma
  for each row execute function public.tg_compliance_liq_loma_updated_at();
