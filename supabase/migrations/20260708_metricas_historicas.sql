-- Métricas históricas mensuales (8vo feedback Bárbara, 08/07).
-- ---------------------------------------------------------------------------
-- Las "planillas del padre" (6 PDFs por mes que arma Claudia desde las hojas
-- de ruta: sueldo s/facturación, facturación por km, costo vs km, km vacíos,
-- km al 100% y toneladas) se consolidan acá: UNA fila por chofer×mes×flota con
-- todas las métricas, más una tabla por mes para datos a nivel mes (estudio de
-- costo, históricos anuales sin detalle por chofer) y los aumentos de tarifa
-- de clientes (para leer las comparaciones de facturación con contexto).
--
-- Confidencial (sección `metricas`): sin políticas RLS permisivas — acceso
-- SOLO vía service role desde server actions (mismo patrón que sueldos_admin).

-- 1) Detalle por chofer y mes (consolidado de las 6 planillas).
create table if not exists public.metricas_chofer_mes (
  id             uuid primary key default gen_random_uuid(),
  mes            date not null,                 -- primer día del mes
  flota          text not null check (flota in ('escalables', 'tolvas')),
  chofer_nombre  text not null,                 -- como figura en la planilla (ej. "CEJAS N")
  chofer_id      uuid references public.choferes(id) on delete set null, -- linkeo best-effort
  escal_tipo     int check (escal_tipo in (35, 37)), -- grupo de toneladas (solo escalables)
  km_totales     numeric check (km_totales >= 0),
  km_vacios      numeric check (km_vacios >= 0),
  km_100         numeric check (km_100 >= 0),   -- km al 100% de carga
  facturacion    numeric check (facturacion >= 0),
  sueldo_total   numeric check (sueldo_total >= 0),
  sueldo_neto    numeric check (sueldo_neto >= 0),
  toneladas_prom numeric check (toneladas_prom >= 0),
  ingreso_parcial boolean not null default false, -- entró/salió a mitad de mes (cursiva en la planilla)
  observaciones  text,
  created_at     timestamptz not null default now(),
  created_by     uuid references public.usuarios(id) on delete set null,
  constraint metricas_chofer_mes_unico unique (mes, flota, chofer_nombre)
);

comment on table public.metricas_chofer_mes is
  'Métricas mensuales por chofer consolidadas de las 6 planillas de gestión (PDFs del Drive de Bárbara).';

create index if not exists metricas_chofer_mes_mes_idx on public.metricas_chofer_mes (mes, flota);
create index if not exists metricas_chofer_mes_chofer_idx on public.metricas_chofer_mes (chofer_id, mes desc);

alter table public.metricas_chofer_mes enable row level security;

-- 2) Datos a nivel mes: estudio de costo por km (planilla COSTO VS KM) y
--    meses históricos sin detalle por chofer (ej. anuales 2023).
create table if not exists public.metricas_mes (
  id               uuid primary key default gen_random_uuid(),
  mes              date not null,
  flota            text check (flota in ('escalables', 'tolvas')), -- null = general
  km               numeric check (km >= 0),
  facturacion      numeric check (facturacion >= 0),
  costo_km_estudio numeric check (costo_km_estudio >= 0), -- "ESTUDIO DE COSTO" $/km
  fuente           text not null default 'planillas',     -- 'planillas' | 'anual_historico'
  observaciones    text,
  created_at       timestamptz not null default now(),
  created_by       uuid references public.usuarios(id) on delete set null
);

comment on table public.metricas_mes is
  'Métricas a nivel mes: estudio de costo $/km y meses históricos sin detalle por chofer.';

create unique index if not exists metricas_mes_unico
  on public.metricas_mes (mes, coalesce(flota, '-'));

alter table public.metricas_mes enable row level security;

-- 3) Aumentos de tarifa de clientes (audio Bárbara 08/07 15:01): para leer un
--    salto de facturación sabiendo si fue tarifa o producción.
create table if not exists public.clientes_aumentos (
  id             uuid primary key default gen_random_uuid(),
  cliente_id     uuid references public.clientes(id) on delete set null,
  cliente_nombre text not null,                -- redundante a propósito (histórico estable)
  vigente_desde  date not null,
  porcentaje     numeric not null check (porcentaje > -100 and porcentaje < 1000),
  observaciones  text,
  created_at     timestamptz not null default now(),
  created_by     uuid references public.usuarios(id) on delete set null
);

comment on table public.clientes_aumentos is
  'Aumentos de tarifa por cliente (fecha + %): contexto para las comparaciones de facturación.';

create index if not exists clientes_aumentos_fecha_idx on public.clientes_aumentos (vigente_desde desc);

alter table public.clientes_aumentos enable row level security;

-- 4) Espejo de la sección confidencial en la tabla `secciones`.
insert into public.secciones (codigo, area_codigo, nombre, orden, confidencial)
values ('metricas', 'finanzas', 'Métricas históricas', 14, true)
on conflict (codigo) do nothing;

-- 5) Planilla COSTO VS KM: fact/km y prom km de meses sin planillas completas.
alter table public.metricas_mes
  add column if not exists fact_km numeric check (fact_km >= 0),
  add column if not exists prom_km numeric check (prom_km >= 0);
