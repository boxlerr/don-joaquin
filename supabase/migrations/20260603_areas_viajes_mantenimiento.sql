-- Opción A del 3er feedback (permisos): separar "Viajes" de Logística y
-- "Mantenimiento" de Flota, para honrar textual la matriz de Bárbara:
--   Viajes        → solo Virginia + Nico Q  (Logística = Choferes/Siniestros queda "todos")
--   Mantenimiento → solo Jonatan            (Flota = Camiones/Extintores queda "todos")
insert into public.areas (codigo, nombre, orden) values
  ('viajes', 'Viajes', 15),
  ('mantenimiento', 'Mantenimiento', 35)
on conflict (codigo) do nothing;

-- rol_areas: admin ve todo; el resto queda en 'none' (se habilita por usuario via overrides).
insert into public.rol_areas (rol_id, area_codigo, nivel)
select r.id, a.codigo,
  case when r.codigo = 'admin' then 'admin'::area_nivel else 'none'::area_nivel end
from public.roles r
cross join (values ('viajes'), ('mantenimiento')) as a(codigo)
on conflict (rol_id, area_codigo) do nothing;
