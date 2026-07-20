-- Impuestos: fecha de presentación + archivos adjuntos.
--
-- Pedido: poder subir el comprobante (opcional, algunos impuestos sólo tienen
-- fecha), editar la fecha en la tabla y que eso lo marque como entregado, más
-- el historial de períodos anteriores con sus fechas y archivos.
--
-- Decisiones:
--  - `fecha_presentacion` va aparte del vencimiento: así no se pierde el dato
--    de si se presentó tarde. Cargarla marca `presentado = true`.
--  - Los archivos usan la infra compartida de adjuntos (`src/lib/adjuntos-server`),
--    con su tabla puente igual que apercibimientos/siniestros/documentos.
--  - El historial NO necesita tabla nueva: cada fila ya es un período, así que
--    el historial de un impuesto son sus filas anteriores con el mismo nombre.

-- 1) Fecha en que se presentó (distinta del vencimiento).
alter table impuesto_vencimientos
  add column if not exists fecha_presentacion date;

comment on column impuesto_vencimientos.fecha_presentacion is
  'Cuándo se presentó. Cargarla marca presentado = true. Comparada contra fecha_vencimiento indica si se presentó tarde.';

-- 2) Tabla puente de adjuntos (mismo patrón que apercibimiento_archivos).
create table if not exists impuesto_archivos (
  id uuid primary key default gen_random_uuid(),
  impuesto_id uuid not null references impuesto_vencimientos(id) on delete cascade,
  archivo_id uuid not null references documentos_archivos(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references usuarios(id) on delete set null
);

create index if not exists idx_impuesto_archivos_impuesto on impuesto_archivos(impuesto_id);
create index if not exists idx_impuesto_archivos_archivo on impuesto_archivos(archivo_id);

-- Para poder listar el historial por nombre de impuesto sin escanear la tabla.
create index if not exists idx_impuesto_venc_nombre on impuesto_vencimientos(nombre);

-- 3) Bucket propio. Privado: el acceso siempre pasa por URL firmada generada
--    con el service role (ver adjuntos-server), así que no necesita policies.
insert into storage.buckets (id, name, public)
values ('documentos-impuestos', 'documentos-impuestos', false)
on conflict (id) do nothing;

-- 4) Coherencia: si ya había impuestos marcados como presentados sin fecha,
--    se les completa con la fecha en que se marcaron (o el vencimiento).
update impuesto_vencimientos
set fecha_presentacion = coalesce(presentado_at::date, fecha_vencimiento)
where presentado = true and fecha_presentacion is null;
