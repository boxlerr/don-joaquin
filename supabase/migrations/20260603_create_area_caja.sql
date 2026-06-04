-- Área Caja: separar de Finanzas para permitir reservarla de forma independiente.
-- /caja pasa a requerir area_codigo='caja' en lugar de 'finanzas'.
insert into public.areas (codigo, nombre, orden)
values ('caja', 'Caja', 55)
on conflict (codigo) do nothing;

-- Sembrar rol_areas para 'caja':
--   admin   → nivel admin   (siempre ve todo)
--   resto   → none          (queda reservada; solo se habilita por override individual)
insert into public.rol_areas (rol_id, area_codigo, nivel)
select
  r.id,
  'caja',
  case when r.codigo = 'admin' then 'admin'::area_nivel else 'none'::area_nivel end
from public.roles r
on conflict (rol_id, area_codigo) do nothing;
