-- Gasoil de la vuelta: cuántos litros le corresponden a un viaje según lo que cargó.
--
-- Pedido de Nico por WhatsApp (31/08/2026): *"que los choferes puedan cargar las
-- toneladas para que les devuelva los litros que tiene que cargar"*, y al rato
-- pasó la tabla: *"te paso la tabla por la cual se debería multiplicar las
-- toneladas para que le devuelva al chofer la litros disponibles para la vuelta"*.
--
-- La cuenta es una multiplicación —`toneladas × L/TN`— pero los coeficientes NO
-- pueden vivir en el código: son valores de negocio que cambian con el precio
-- del gasoil y con los consumos reales. Van a la base y se editan desde la
-- pantalla, igual que los topes de la caja o los aumentos de clientes.
--
-- Dos tablas y no una, porque son dos cosas distintas:
--   * `gasoil_tarifas` es el cuadro de Nico: cuánto rinde cada tramo HOY.
--   * `gasoil_autorizaciones` es lo que efectivamente se le dijo a cada chofer.
--     Guarda el coeficiente y el resultado CONGELADOS: si mañana sube el L/TN,
--     lo que se autorizó ayer tiene que seguir diciendo lo mismo. Es el mismo
--     criterio con el que se guarda el mensaje de una alerta.
--
-- Los siete lugares del cuadro ya existen en `puntos_ruta` (verificado el
-- 01/09/2026 contra el respaldo del 27/08), así que el seed los busca por nombre
-- y no inventa ninguno: si mañana alguien renombra un punto, esta migración no
-- lo duplica — no encuentra nada y no inserta.
--
-- RLS: las dos nacen cerradas (RLS on, cero policies). Todo pasa por acciones
-- del servidor con service role; con la anon key no se lee ni se escribe nada.
-- Mismo criterio que caja, impuestos, préstamos y métricas.

-- ── 1) El cuadro de Nico ─────────────────────────────────────────────────────

create table if not exists gasoil_tarifas (
  id                   uuid primary key default gen_random_uuid(),
  origen_id            uuid not null references puntos_ruta(id) on delete restrict,
  destino_id           uuid not null references puntos_ruta(id) on delete restrict,
  -- Litros de gasoil por tonelada transportada. Tres decimales porque el cuadro
  -- viene con dos (22,76) y deja lugar a un ajuste fino sin migrar de nuevo.
  litros_por_tonelada  numeric(8,3) not null check (litros_por_tonelada > 0),
  observaciones        text,
  created_at           timestamptz not null default now(),
  created_by           uuid references usuarios(id) on delete set null,
  updated_at           timestamptz not null default now(),
  updated_by           uuid references usuarios(id) on delete set null
);

comment on table gasoil_tarifas is
  'Litros de gasoil por tonelada para cada tramo origen→destino. Cuadro que pasó Nico el 31/08/2026; se edita desde /combustible/litros.';

-- Un solo valor vigente por tramo: si hace falta corregirlo se edita, no se
-- apila otra fila. El historial de quién lo cambió y cuándo lo lleva `audit_log`.
create unique index if not exists gasoil_tarifas_tramo_key
  on gasoil_tarifas (origen_id, destino_id);

-- ── 2) Lo que se le autorizó a cada chofer ───────────────────────────────────

create table if not exists gasoil_autorizaciones (
  id                   uuid primary key default gen_random_uuid(),
  -- Nullable a propósito: un cálculo de referencia que no es para nadie en
  -- particular sigue valiendo la pena guardarlo.
  chofer_id            uuid references choferes(id) on delete set null,
  camion_id            uuid references camiones(id) on delete set null,
  origen_id            uuid not null references puntos_ruta(id) on delete restrict,
  destino_id           uuid not null references puntos_ruta(id) on delete restrict,
  toneladas            numeric(8,2) not null check (toneladas > 0),
  -- Congelados al momento de autorizar: si mañana cambia la tarifa, esto no.
  litros_por_tonelada  numeric(8,3) not null check (litros_por_tonelada > 0),
  litros               numeric(10,2) not null check (litros >= 0),
  observaciones        text,
  created_at           timestamptz not null default now(),
  created_by           uuid references usuarios(id) on delete set null
);

comment on table gasoil_autorizaciones is
  'Litros de gasoil autorizados a un chofer para la vuelta. El coeficiente y el total quedan congelados: lo que se autorizó no cambia si después cambia la tarifa.';

create index if not exists gasoil_autorizaciones_fecha_idx
  on gasoil_autorizaciones (created_at desc);
create index if not exists gasoil_autorizaciones_chofer_idx
  on gasoil_autorizaciones (chofer_id, created_at desc);

-- ── 3) El cuadro que pasó Nico, cargado ──────────────────────────────────────
-- Idempotente: `on conflict do nothing` para no pisar un valor ya corregido a
-- mano. Los nombres son los que existen HOY en puntos_ruta, verificados uno por
-- uno; el join interno hace que un nombre que no exista simplemente no inserte
-- esa fila, en vez de romper la migración entera.

insert into gasoil_tarifas (origen_id, destino_id, litros_por_tonelada, observaciones)
select o.id, d.id, v.ltn, 'Cuadro que pasó Nico por WhatsApp el 31/08/2026'
from (values
  ('IBICUY',      'Añelo',      22.76),
  ('IBICUY',      'SAND POINT', 24.93),
  ('IBICUY',      'LAJE9',      26.88),
  ('IBICUY',      'LAJE41',     26.88),
  ('SAN NICOLAS', 'Añelo',      21.67),
  ('SAN NICOLAS', 'SAND POINT', 23.50),
  ('SAN NICOLAS', 'LAJE9',      26.51),
  ('SAN NICOLAS', 'LAJE41',     26.51),
  ('SAN PEDRO',   'Añelo',      21.90),
  ('SAN PEDRO',   'SAND POINT', 23.74),
  ('SAN PEDRO',   'LAJE9',      26.51),
  ('SAN PEDRO',   'LAJE41',     26.51)
) as v(origen, destino, ltn)
join puntos_ruta o on o.nombre = v.origen
join puntos_ruta d on d.nombre = v.destino
on conflict (origen_id, destino_id) do nothing;

-- ── 4) RLS ───────────────────────────────────────────────────────────────────

alter table gasoil_tarifas enable row level security;
alter table gasoil_autorizaciones enable row level security;

-- ── 5) Verificación. Esperado: 12 tramos cargados. ───────────────────────────
select count(*) as tramos_cargados from gasoil_tarifas;
