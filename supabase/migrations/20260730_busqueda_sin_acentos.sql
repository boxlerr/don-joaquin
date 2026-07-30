-- Búsqueda sin acentos en Caja y Gastos.
--
-- El resto del sistema filtra en el cliente y ya ignora acentos (src/lib/texto.ts).
-- Estas dos pantallas no pueden: paginan en el servidor y devuelven el total con
-- count exact, así que el filtro tiene que resolverse en la base.
--
-- La idea: guardar en una columna generada el texto normalizado (minúsculas y sin
-- acentos) e indexarla con trigramas, para que el ILIKE '%...%' siga siendo rápido.
-- Del lado de la app se normaliza lo que escribe el usuario con normalizarTexto()
-- y se busca contra esa columna.
--
-- OJO al aplicar: agregar una columna generada reescribe la tabla y toma un lock
-- exclusivo. En estas tablas es cuestión de segundos, pero conviene correrlo fuera
-- del horario de carga.

create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- unaccent() es STABLE (depende del diccionario) y una columna generada exige una
-- expresión IMMUTABLE. Se la envuelve con la forma de dos argumentos, que fija el
-- diccionario explícitamente: es el workaround estándar de Postgres.
-- Contra: si alguna vez se cambia el diccionario unaccent, hay que regenerar las
-- columnas y reindexar.
create or replace function public.sin_acentos(txt text)
returns text
language sql
immutable
strict
parallel safe
set search_path = extensions, public, pg_temp
as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, txt))
$$;

comment on function public.sin_acentos(text) is
  'Minúsculas y sin acentos, para búsquedas insensibles a tildes. Es el espejo en SQL de normalizarTexto() (src/lib/texto.ts).';

-- Caja: se busca por concepto.
alter table public.caja_movimientos
  add column if not exists concepto_norm text
  generated always as (public.sin_acentos(concepto)) stored;

create index if not exists idx_caja_movimientos_concepto_norm_trgm
  on public.caja_movimientos using gin (concepto_norm extensions.gin_trgm_ops);

-- Gastos: se busca por descripción.
alter table public.gastos
  add column if not exists descripcion_norm text
  generated always as (public.sin_acentos(descripcion)) stored;

create index if not exists idx_gastos_descripcion_norm_trgm
  on public.gastos using gin (descripcion_norm extensions.gin_trgm_ops);
