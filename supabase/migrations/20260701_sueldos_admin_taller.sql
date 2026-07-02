-- Sueldos de administración + taller sobre facturación (audios Bárbara 30/06, tema 2).
-- ---------------------------------------------------------------------------
-- Mes a mes Bárbara arma en Excel la planilla de sueldos del personal
-- administrativo y de taller y la mide como % de la facturación del mes.
-- Quiere que se actualice sola: ella carga aumentos (histórico), computa
-- horas extras (cantidad × valor) y algún plus manual.
--
-- Empleados = filas de `choferes` con rol 'administrativo' | 'mantenimiento'
-- (mismo roster que ya usa el legajo; NO es la liquidación de choferes).
--
-- RLS: sin políticas permisivas — datos de sueldos, acceso SOLO vía service
-- role desde server actions gateados por la subsección confidencial
-- `sueldos_admin` (mismo patrón que 20260629_impuestos.sql).

-- 1) Historial de sueldo base (los "aumentos por mes" que carga Bárbara).
create table if not exists public.sueldos_admin_aumentos (
  id             uuid primary key default gen_random_uuid(),
  chofer_id      uuid not null references public.choferes(id) on delete cascade,
  vigente_desde  date not null,                  -- primer día del mes desde el que rige
  sueldo_base    numeric not null check (sueldo_base >= 0),
  observaciones  text,
  created_at     timestamptz not null default now(),
  created_by     uuid references public.usuarios(id) on delete set null,
  constraint sueldos_admin_aumentos_unico unique (chofer_id, vigente_desde)
);

comment on table public.sueldos_admin_aumentos is
  'Historial de sueldo base del personal admin+taller: cada fila es el sueldo vigente desde ese mes (aumentos).';

create index if not exists sueldos_admin_aumentos_chofer_idx
  on public.sueldos_admin_aumentos (chofer_id, vigente_desde desc);

alter table public.sueldos_admin_aumentos enable row level security;

-- 2) Datos variables del mes por empleado (horas extras, plus).
create table if not exists public.sueldos_admin_mes (
  id             uuid primary key default gen_random_uuid(),
  chofer_id      uuid not null references public.choferes(id) on delete cascade,
  mes            date not null,                  -- primer día del mes
  horas_extras   numeric not null default 0 check (horas_extras >= 0),
  valor_hora     numeric check (valor_hora >= 0), -- null → usa el parámetro global
  plus           numeric not null default 0,
  observaciones  text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid references public.usuarios(id) on delete set null,
  constraint sueldos_admin_mes_unico unique (chofer_id, mes)
);

comment on table public.sueldos_admin_mes is
  'Variables del mes por empleado admin+taller: horas extras (cant × valor), plus manual.';
comment on column public.sueldos_admin_mes.valor_hora is
  'Valor de la hora extra para este empleado/mes; null usa el parámetro sueldos_admin_valor_hora.';

create index if not exists sueldos_admin_mes_mes_idx
  on public.sueldos_admin_mes (mes, chofer_id);

drop trigger if exists sueldos_admin_mes_set_updated_at on public.sueldos_admin_mes;
create trigger sueldos_admin_mes_set_updated_at
  before update on public.sueldos_admin_mes
  for each row execute function public.tg_set_updated_at();

alter table public.sueldos_admin_mes enable row level security;

-- 3) Config del mes: facturación manual opcional (si Bárbara no quiere usar
--    la calculada desde los viajes del sistema).
create table if not exists public.sueldos_admin_meses (
  mes                 date primary key,          -- primer día del mes
  facturacion_manual  numeric check (facturacion_manual >= 0),
  observaciones       text,
  updated_at          timestamptz not null default now(),
  updated_by          uuid references public.usuarios(id) on delete set null
);

comment on table public.sueldos_admin_meses is
  'Config mensual de la planilla admin+taller: facturación manual (pisa la calculada de viajes) para el % sobre facturación.';

drop trigger if exists sueldos_admin_meses_set_updated_at on public.sueldos_admin_meses;
create trigger sueldos_admin_meses_set_updated_at
  before update on public.sueldos_admin_meses
  for each row execute function public.tg_set_updated_at();

alter table public.sueldos_admin_meses enable row level security;

-- 4) Parámetro: valor por defecto de la hora extra (editable, se pisa por fila).
insert into public.parametros_sistema (clave, valor, tipo_dato, categoria, descripcion, editable)
values (
  'sueldos_admin_valor_hora',
  '0',
  'number',
  'sueldos',
  'Valor por defecto de la hora extra del personal de administración y taller (se puede pisar por empleado y mes).',
  true
)
on conflict (clave) do nothing;
