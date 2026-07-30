-- Búsqueda sin acentos en Caja y Gastos.
--
-- OPCIONAL: sin esta migración el sistema funciona; lo único que queda sensible a
-- acentos es el buscador de estas dos pantallas. Todo el resto, Viajes incluido,
-- ya ignora los acentos sin tocar la base.
--
-- Por qué estas dos son distintas: buscan por texto libre (concepto y descripción)
-- sobre tablas grandes que paginan en el servidor y devuelven el total con count
-- exact. No se pueden traer las filas y filtrarlas en el servidor como se hace con
-- choferes, camiones, clientes y lugares, que son tablas chicas.
--
-- La idea: guardar en una columna generada el texto normalizado (sin acentos, en
-- minúsculas y con los espacios colapsados). Del lado de la app se normaliza lo que
-- escribe el usuario con normalizarTexto() y se busca contra esa columna.
--
-- OJO al aplicar: agregar una columna generada reescribe la tabla y toma un lock
-- exclusivo. Son todas tablas chicas salvo caja_movimientos y gastos, pero conviene
-- correrlo fuera del horario de carga.

-- ---------------------------------------------------------------------------
-- sin_acentos(): tiene que dar EXACTAMENTE lo mismo que normalizarTexto() en
-- src/lib/texto.ts. Si no coinciden, el usuario escribe algo que existe y la
-- pantalla le contesta que no hay nada.
--
-- Por eso no se usa la extensión unaccent: su tabla de reemplazos vive afuera del
-- repo, cambia entre versiones de Postgres y no se puede replicar en TypeScript.
-- Con translate() la tabla es una sola, está versionada y es la misma de los dos
-- lados. De paso la función es IMMUTABLE de verdad (unaccent es STABLE y había que
-- envolverla mintiendo), así que no hay riesgo de que las columnas ya calculadas
-- queden viejas si cambia el diccionario.
--
-- Las dos cadenas de abajo son la copia literal de CARACTERES_ORIGEN y
-- CARACTERES_DESTINO de src/lib/texto.ts (127 caracteres cada una, alineadas uno a
-- uno). Si tocás la tabla allá, el test de texto.test.ts falla y te imprime las
-- cadenas nuevas para pegar acá.
-- ---------------------------------------------------------------------------
create or replace function public.sin_acentos(txt text)
returns text
language sql
immutable
strict
parallel safe
as $$
  select btrim(
    regexp_replace(
      lower(
        translate(
          txt,
          e'ÀÁÂÃÄÅàáâãäåÇçÈÉÊËèéêëÌÍÎÏìíîïÑñÒÓÔÕÖØòóôõöøÙÚÛÜùúûüÝýÿĀāĒēĪīŌōŪūĆćČčĎďĐđĚěŁłŃńŘřŚśŠšŤťŮůŹźŻżŽž‐‑‒–—―­‘’‚“”„¿¡               　﻿',
          'AAAAAAaaaaaaCcEEEEeeeeIIIIiiiiNnOOOOOOooooooUUUUuuuuYyyAaEeIiOoUuCcCcDdDdEeLlNnRrSsSsTtUuZzZzZz-------''''''"""?!                 '
        )
      ),
      '\s+', ' ', 'g'
    )
  )
$$;

comment on function public.sin_acentos(text) is
  'Sin acentos, en minúsculas y con los espacios colapsados. Es el espejo en SQL de normalizarTexto() (src/lib/texto.ts): si cambia una, hay que cambiar la otra.';

-- Las funciones del proyecto no tienen EXECUTE para public (migración
-- 20260713_seguridad_funciones). Se lo damos explícito para que ningún INSERT en
-- estas tablas dependa de cuándo Postgres revisa el permiso de la expresión.
grant execute on function public.sin_acentos(text) to public;

-- Las columnas se dropean y se vuelven a crear a propósito: así una segunda
-- corrida deja SIEMPRE el valor que calcula la versión actual de sin_acentos(), y
-- no el que hubiera quedado materializado por una versión anterior.
do $cols$
declare
  t record;
  sch_trgm text;
begin
  -- El índice de trigramas es opcional: acelera el ILIKE '%...%', pero si pg_trgm
  -- no está disponible la búsqueda funciona igual (escaneo secuencial, que es lo
  -- que ya hacía antes de esta migración).
  select n.nspname into sch_trgm
    from pg_extension e join pg_namespace n on n.oid = e.extnamespace
   where e.extname = 'pg_trgm';

  for t in
    select * from (values
      ('caja_movimientos', 'concepto',    'concepto_norm'),
      ('gastos',           'descripcion', 'descripcion_norm')
    ) as v(tabla, origen, destino)
  loop
    execute format('alter table public.%I drop column if exists %I', t.tabla, t.destino);
    execute format(
      'alter table public.%I add column %I text generated always as (public.sin_acentos(%I)) stored',
      t.tabla, t.destino, t.origen
    );
    if sch_trgm is not null then
      execute format(
        'create index if not exists %I on public.%I using gin (%I %I.gin_trgm_ops)',
        'idx_' || t.tabla || '_' || t.destino || '_trgm', t.tabla, t.destino, sch_trgm
      );
    else
      raise notice 'pg_trgm no está instalada: se omite el índice de %.%', t.tabla, t.destino;
    end if;
  end loop;
end
$cols$;

-- PostgREST cachea el esquema: sin esto, las columnas nuevas tardan en verse y las
-- consultas fallan con 42703 aunque ya existan.
notify pgrst, 'reload schema';
