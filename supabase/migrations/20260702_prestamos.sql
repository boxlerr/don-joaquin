-- Préstamos bancarios: cuotas, avisos y carga por semana (audio Bárbara 02/07, 10).
-- ---------------------------------------------------------------------------
-- La mamá lleva en una planilla los préstamos de cada banco: fecha de la
-- cuota, importe, número de cuota (44 de 48) y tasa. Se pasa a la plataforma
-- para que avise los vencimientos ("mañana vence Galicia, cuota 44/48"),
-- sirva de ayuda-memoria y muestre cuánto hay que pagar por semana.
--
-- RLS: sin políticas permisivas — info financiera sensible, acceso SOLO vía
-- service role desde server actions gateadas por la subsección confidencial
-- `prestamos` (mismo patrón que impuestos y sueldos admin).

create table if not exists public.prestamos (
  id                 uuid primary key default gen_random_uuid(),
  banco              text not null,                    -- Galicia, Nación, Credicoop…
  detalle            text,                             -- referencia libre del préstamo
  tasa               numeric check (tasa >= 0),        -- % como lo anota la planilla
  importe_cuota      numeric not null default 0 check (importe_cuota >= 0),
  cuotas_total       integer not null check (cuotas_total > 0),
  primer_vencimiento date not null,
  estado             text not null default 'activo' check (estado in ('activo', 'cancelado')),
  observaciones      text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  created_by         uuid references public.usuarios(id) on delete set null
);

comment on table public.prestamos is
  'Préstamos bancarios (planilla de la mamá): banco, tasa, importe de cuota y cronograma.';

drop trigger if exists prestamos_set_updated_at on public.prestamos;
create trigger prestamos_set_updated_at
  before update on public.prestamos
  for each row execute function public.tg_set_updated_at();

alter table public.prestamos enable row level security;

create table if not exists public.prestamo_cuotas (
  id                uuid primary key default gen_random_uuid(),
  prestamo_id       uuid not null references public.prestamos(id) on delete cascade,
  nro               integer not null check (nro > 0),
  fecha_vencimiento date not null,
  importe           numeric not null default 0 check (importe >= 0),
  pagada            boolean not null default false,
  pagada_en         date,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint prestamo_cuotas_unica unique (prestamo_id, nro)
);

comment on table public.prestamo_cuotas is
  'Cronograma de cuotas de cada préstamo; cada fila alimenta las alertas de vencimiento y la carga semanal.';

create index if not exists prestamo_cuotas_venc_idx
  on public.prestamo_cuotas (fecha_vencimiento) where not pagada;

drop trigger if exists prestamo_cuotas_set_updated_at on public.prestamo_cuotas;
create trigger prestamo_cuotas_set_updated_at
  before update on public.prestamo_cuotas
  for each row execute function public.tg_set_updated_at();

alter table public.prestamo_cuotas enable row level security;

-- Subsección confidencial (la ven Bárbara + Nicolás; se destapa por rol si hace falta).
insert into public.secciones (codigo, area_codigo, nombre, orden, confidencial)
values ('prestamos', 'finanzas', 'Préstamos', 14, true)
on conflict (codigo) do update
  set area_codigo = excluded.area_codigo,
      nombre = excluded.nombre,
      orden = excluded.orden,
      confidencial = excluded.confidencial;
