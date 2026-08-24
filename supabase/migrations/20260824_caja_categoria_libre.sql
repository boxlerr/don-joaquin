-- Caja: categoría escrita a mano.
--
-- `caja_movimientos.categoria` es un enum (`caja_categoria`) con nueve valores
-- fijos. Alcanza para la mayoría, pero deja afuera todo lo que no estaba
-- previsto: para cargar "Venta de chatarra" había que elegir "Otro" y escribir
-- el resto en el concepto, con lo cual el movimiento quedaba archivado en un
-- cajón que no dice nada — el mismo problema que "Otros avisos" en las
-- notificaciones.
--
-- Regla del proyecto (30/07, sobre bancos y libradores): un catálogo que nunca
-- va a estar completo no puede ser sólo una lista. Se escribe libre, la lista
-- son sugerencias, y lo que se escribe se guarda para la próxima.
--
--   * `categoria_libre` guarda el TEXTO tal cual se escribió. El enum sigue
--     siendo la verdad para agrupar y filtrar (queda en 'otro'), y el texto es
--     lo que se muestra.
--   * `caja_categorias_libres` es el catálogo de sugerencias. Tabla propia y no
--     un `select distinct` sobre los movimientos, a propósito: así una
--     sugerencia mal escrita se puede sacar de la lista con la X sin tocar
--     ningún movimiento ya cargado (el movimiento guarda texto, no una FK).
--
-- RLS: la tabla nace cerrada (RLS on, cero policies). Todo lo que la usa pasa
-- por acciones del servidor con service role; con la anon key no se lee ni se
-- escribe nada. Mismo criterio que impuestos, préstamos y métricas.

alter table caja_movimientos
  add column if not exists categoria_libre text;

comment on column caja_movimientos.categoria_libre is
  'Categoría escrita a mano cuando no es ninguna de las del enum. El texto va tal cual se cargó; `categoria` queda en ''otro''.';

create table if not exists caja_categorias_libres (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  -- Las de un ingreso no tienen por qué sugerirse en un egreso.
  flujo text not null check (flujo in ('ingreso', 'egreso')),
  created_at timestamptz not null default now(),
  created_by uuid references usuarios(id)
);

comment on table caja_categorias_libres is
  'Sugerencias de categoría de caja escritas a mano. Se llena solo al cargar un movimiento y se puede limpiar desde el desplegable: borrar de acá no toca los movimientos ya cargados.';

-- Sin mayúsculas ni espacios de más: "Venta de chatarra" y "venta de chatarra "
-- son la misma sugerencia, y una lista con las dos no le sirve a nadie.
--
-- A propósito NO usa `sin_acentos()` (la función de 20260730_busqueda_sin_acentos):
-- esa migración todavía no está aplicada en esta base — se verificó el 24/08/2026,
-- `caja_movimientos.concepto_norm` no existe—, así que un índice que dependa de
-- ella haría fallar TODA esta migración. `lower(btrim(...))` alcanza y no depende
-- de nada. La app hace la misma comparación con `ilike` antes de insertar.
create unique index if not exists caja_categorias_libres_nombre_key
  on caja_categorias_libres (flujo, lower(btrim(nombre)));

alter table caja_categorias_libres enable row level security;
