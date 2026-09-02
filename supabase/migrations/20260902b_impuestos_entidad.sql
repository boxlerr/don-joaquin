-- ────────────────────────────────────────────────────────────────────────────
-- Impuestos: de quién es cada vencimiento (pedido de Nicolás, 02/09/2026)
--
-- El estudio contable (Secondi) manda un calendario POR CONTRIBUYENTE. Hasta
-- hoy la tabla tenía uno solo metido adentro sin decirlo: las 26 filas cargadas
-- son todas de Joaquín Hnos. El pedido de Nicolás es subir también el suyo
-- —Joaquín Nicolás, CUIT 20-26402739-0— y ahí la mezcla deja de ser inocente:
--
--   · Los dos calendarios traen "IVA", "Ingresos Brutos - CM03" y "Libro IVA
--     Digital", con fechas DISTINTAS (18 y 24 de septiembre de 2026). En una
--     sola lista son filas repetidas que nadie sabe a quién reclamarle.
--   · El aviso no va al mismo lado: el de la empresa lo ve todo el equipo, el
--     de Nicolás lo ven Nicolás, Nico Quiroga y Paula. Sin saber de quién es la
--     fila, la alerta no tiene forma de elegir destinatario.
--
-- Por eso la entidad es una TABLA y no un texto libre en la fila: el CUIT es la
-- clave con la que el importador reconoce el PDF sin preguntar nada, y
-- `columna_alerta` es lo que decide a qué casillero de
-- /configuracion/notificaciones va el aviso. Un contribuyente nuevo (otra
-- sociedad, otro socio) se da de alta desde la pantalla y no toca código.
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists public.impuesto_entidades (
  codigo         text primary key,
  nombre         text not null,
  -- Normalizado como `20-26402739-0`. Es la llave del importador: el PDF trae el
  -- CUIT y con eso solo ya sabe de quién es el calendario.
  cuit           text not null unique,
  -- Columna de la matriz de notificaciones (lib/alertas-routing.ts). Es lo único
  -- que separa "le llega a todos" de "le llega a tres".
  columna_alerta text not null default 'impuestos',
  orden          int  not null default 0,
  created_at     timestamptz not null default now()
);

comment on table public.impuesto_entidades is
  'Contribuyentes cuyos vencimientos se agendan. El CUIT identifica el PDF del estudio; columna_alerta decide a quién le llega el aviso.';

alter table public.impuesto_entidades enable row level security; -- sólo service role, como impuesto_vencimientos

insert into public.impuesto_entidades (codigo, nombre, cuit, columna_alerta, orden) values
  ('joaquin_hnos',    'Joaquín Hnos',    '30-70908728-9', 'impuestos',            10),
  ('joaquin_nicolas', 'Joaquín Nicolás', '20-26402739-0', 'impuestos_personales', 20)
on conflict (codigo) do nothing;

-- Las filas que ya estaban son todas de la empresa (calendarios de junio a
-- septiembre de 2026 cargados a mano por Pablo). Se completan y recién después
-- la columna se pone NOT NULL, para que una fila nueva no pueda nacer huérfana.
alter table public.impuesto_vencimientos
  add column if not exists entidad_codigo text references public.impuesto_entidades(codigo);

update public.impuesto_vencimientos
set entidad_codigo = 'joaquin_hnos'
where entidad_codigo is null;

alter table public.impuesto_vencimientos
  alter column entidad_codigo set default 'joaquin_hnos',
  alter column entidad_codigo set not null;

comment on column public.impuesto_vencimientos.entidad_codigo is
  'De qué contribuyente es el vencimiento. Decide a quién le llega la alerta (impuesto_entidades.columna_alerta).';

create index if not exists idx_impuesto_venc_entidad
  on public.impuesto_vencimientos (entidad_codigo, fecha_vencimiento);

-- El importador reimporta el mismo PDF sin miedo: el mismo impuesto, el mismo
-- día y el mismo contribuyente es la MISMA fila. Sin esto, subir dos veces el
-- calendario de septiembre deja el aviso duplicado en la casilla de todos.
create unique index if not exists uq_impuesto_venc_entidad_nombre_fecha
  on public.impuesto_vencimientos (entidad_codigo, nombre, fecha_vencimiento);

-- ── Quién puede recibir el calendario personal ──────────────────────────────
-- Subsección propia y confidencial: los vencimientos de una persona física no
-- se heredan del área Finanzas como los de la empresa. Cerrada por defecto —hay
-- que otorgarla desde /usuarios—, salvo para los administradores, que la tienen
-- siempre (ver lib/permisos-usuarios-core.ts).
insert into public.secciones (codigo, area_codigo, nombre, orden, confidencial)
values ('impuestos_personales', 'finanzas', 'Impuestos personales', 13, true)
on conflict (codigo) do update set confidencial = true;
