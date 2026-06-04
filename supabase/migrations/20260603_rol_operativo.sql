-- Rol base "operativo" para la matriz de permisos de Bárbara (opción A):
-- da acceso a las áreas "para todos" (logística = Choferes/Siniestros,
-- flota = Camiones/Extintores, compliance). Las áreas restringidas (viajes,
-- mantenimiento, combustible, comercial, caja, finanzas) se habilitan por
-- usuario via overrides (usuario_areas).
insert into public.roles (codigo, nombre) values ('operativo', 'Operativo')
on conflict (codigo) do nothing;

insert into public.rol_areas (rol_id, area_codigo, nivel)
select r.id, a.codigo, 'write'::area_nivel
from public.roles r
cross join (values ('logistica'), ('flota'), ('compliance')) as a(codigo)
where r.codigo = 'operativo'
on conflict (rol_id, area_codigo) do nothing;
