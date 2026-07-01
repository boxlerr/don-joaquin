-- Nueva subsección "DM y liquidaciones" bajo el área Viajes.
-- ---------------------------------------------------------------------------
-- Los DM de YPF y las liquidaciones de Loma Negra se movieron de Compliance a
-- Viajes (`/viajes/liquidaciones`): son los documentos que cierran la hoja de
-- ruta (tonelaje + importe por viaje). Esta fila espeja el catálogo de
-- secciones (lib/secciones.ts) para que el editor de permisos por rol
-- (rol_secciones) pueda referenciarla. Hereda el nivel del área Viajes.

insert into public.secciones (codigo, area_codigo, nombre, orden, confidencial)
values ('viajes_liquidaciones', 'viajes', 'DM y liquidaciones', 14, false)
on conflict (codigo) do update
  set area_codigo = excluded.area_codigo,
      nombre = excluded.nombre,
      orden = excluded.orden,
      confidencial = excluded.confidencial;
