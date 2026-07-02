-- Nuevas subsecciones confidenciales + Impuestos confidencial (audios Bárbara 30/06).
-- ---------------------------------------------------------------------------
-- · dashboard_completo (finanzas): el dashboard general pierde la facturación;
--   la vista completa con facturación acumulada queda solo para dirección
--   (tema 6, opción B "dos dashboards").
-- · caja_saldo / caja_grande (caja): "operar ≠ ver" — con el área caja en
--   write se CARGAN movimientos, pero saldo/historial/retiros y la caja
--   grande son confidenciales (tema 3).
-- · sueldos_admin (rrhh): planilla de sueldos de administración + taller
--   medida como % de la facturación del mes (tema 2).
-- · impuestos pasa a confidencial (tema 8) — reversible desde /usuarios →
--   "Secciones confidenciales".
-- Espeja el catálogo de código (src/lib/secciones.ts).

insert into public.secciones (codigo, area_codigo, nombre, orden, confidencial)
values
  ('dashboard_completo', 'finanzas', 'Dashboard completo', 13, true),
  ('caja_saldo',         'caja',     'Saldo e historial',  10, true),
  ('caja_grande',        'caja',     'Caja grande',        11, true),
  ('sueldos_admin',      'rrhh',     'Sueldos admin y taller', 11, true)
on conflict (codigo) do update
  set area_codigo = excluded.area_codigo,
      nombre = excluded.nombre,
      orden = excluded.orden,
      confidencial = excluded.confidencial;

update public.secciones set confidencial = true where codigo = 'impuestos';
