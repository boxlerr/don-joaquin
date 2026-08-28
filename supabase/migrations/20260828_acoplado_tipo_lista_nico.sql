-- ────────────────────────────────────────────────────────────────────────────
-- Acoplados — la lista de tipos que pidió Nico (28/08/2026)
--
-- La lista original era un catálogo general de semirremolques —sider, semi
-- furgón, cisterna, jaula, plancha— que no tiene nada que ver con lo que ellos
-- manejan. Se nota en los datos: de los 64 acoplados cargados, NINGUNO tiene
-- tipo. Nadie eligió una opción de esa lista nunca.
--
-- La lista nueva es la de ellos: semi | acoplado | tolva | batea | otro.
--
-- ORDEN: esta migración va ANTES del deploy. El código nuevo escribe 'semi',
-- 'acoplado' y 'tolva', que el enum viejo rechaza; el código viejo, mientras
-- tanto, sólo lee (nadie tiene un tipo cargado para que se le rompa la vista).
-- ────────────────────────────────────────────────────────────────────────────

-- Freno de mano: si entre hoy y el día que esto corra alguien cargó un tipo que
-- no sabemos a dónde mandar, la migración aborta en vez de comerse el dato.
do $$
declare
  huerfanos integer;
begin
  select count(*) into huerfanos
    from public.acoplados
   where tipo is not null
     and tipo::text not in ('batea', 'otro', 'semi_tolva');
  if huerfanos > 0 then
    raise exception
      'Hay % acoplado(s) con un tipo que la lista nueva no contempla (sider/semi_furgon/cisterna/jaula/plancha). Revisar el mapeo antes de rehacer el enum.',
      huerfanos;
  end if;
end $$;

alter type public.acoplado_tipo rename to acoplado_tipo_viejo;

create type public.acoplado_tipo as enum (
  'semi',
  'acoplado',
  'tolva',
  'batea',
  'otro'
);

-- El `using` traduce lo poco que se salva: batea y otro son iguales, y el viejo
-- 'semi_tolva' es la tolva de ahora. Ninguna vista lee esta columna
-- (v_compliance_estado sólo toca id, patente y estado), así que el alter pasa
-- sin tener que recrear nada.
alter table public.acoplados
  alter column tipo drop default,
  alter column tipo type public.acoplado_tipo
  using (
    case tipo::text
      when 'batea'      then 'batea'
      when 'otro'       then 'otro'
      when 'semi_tolva' then 'tolva'
    end::public.acoplado_tipo
  );

drop type public.acoplado_tipo_viejo;
