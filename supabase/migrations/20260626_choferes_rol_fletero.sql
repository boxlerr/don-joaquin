-- Agrega 'fletero' como rol válido de chofer (tercerizados) y marca a los Fischer.
-- Los fleteros se gestionan dentro de la sección de Choferes pero se muestran/filtran aparte.

alter table choferes drop constraint if exists choferes_rol_check;
alter table choferes
  add constraint choferes_rol_check
  check (rol = any (array['chofer'::text, 'administrativo'::text, 'mantenimiento'::text, 'fletero'::text]));

-- Fleteros Fischer cargados manualmente el 26/06 (alta como chofer por falta del rol)
update choferes
  set rol = 'fletero', updated_at = now()
  where cuil in ('30-70908728-9', '20-22837073-9');
