-- Sección "Impuestos" (Finanzas): calendario de vencimientos impositivos que el
-- estudio contable (Secondi) le pasa a Pablo. Son siempre los mismos impuestos;
-- cambia la fecha de vencimiento cada mes. Checklist: marcar "presentado".
-- Pedido en la reunión con Nico/Pablo del 29/06.

create table if not exists impuesto_vencimientos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  organismo text,
  periodo text,                       -- ej "2026-06"
  fecha_vencimiento date not null,
  presentado boolean not null default false,
  presentado_at timestamptz,
  presentado_por uuid references usuarios(id),
  observaciones text,
  created_by uuid references usuarios(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_impuesto_venc_fecha on impuesto_vencimientos (fecha_vencimiento);
create index if not exists idx_impuesto_venc_pendiente on impuesto_vencimientos (presentado, fecha_vencimiento);

-- RLS: solo service role (las server actions usan admin client y validan permiso
-- de área "finanzas"). Sin políticas permisivas → cerrado a anon/authenticated.
alter table impuesto_vencimientos enable row level security;

comment on table impuesto_vencimientos is
  'Vencimientos impositivos (Finanzas). Checklist de presentación + alertas de vencimiento.';

-- Seed: calendario de junio 2026 (PDF Estudio Secondi, CUIT 30-70908728-9).
insert into impuesto_vencimientos (nombre, organismo, periodo, fecha_vencimiento) values
  ('Agente de Perc. Neuquén',        'Neuquén',              '2026-06', '2026-06-08'),
  ('Agente de Perc. Corrientes',     'Corrientes',           '2026-06', '2026-06-08'),
  ('Agente de Ret. Corrientes',      'Corrientes',           '2026-06', '2026-06-08'),
  ('SICORE pago 2da. Q 05-2026',     'AFIP',                 '2026-06', '2026-06-11'),
  ('Agente Ret. ARBA 2da. Q 05-2026','ARBA',                 '2026-06', '2026-06-11'),
  ('Agente Perc. ARBA 05-2026',      'ARBA',                 '2026-06', '2026-06-11'),
  ('Ingresos Brutos - CM03',         'Convenio Multilateral','2026-06', '2026-06-19'),
  ('IVA',                            'AFIP',                 '2026-06', '2026-06-24'),
  ('Libro IVA Digital',             'AFIP',                 '2026-06', '2026-06-24'),
  ('SICORE pago 1er. Q 06-2026',     'AFIP',                 '2026-06', '2026-06-24'),
  ('Agente Ret. ARBA 1er. Q 06-2026','ARBA',                 '2026-06', '2026-06-26');
