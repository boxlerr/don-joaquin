-- El CHECK original limitaba la capacidad a 35 o 37.5 TN únicamente, lo cual
-- bloqueaba la edición de camiones con otras capacidades reales. La validación
-- de capacidad > 0 se mantiene en el frontend.
alter table public.camiones
  drop constraint if exists camiones_capacidad_tn_check;

alter table public.camiones
  add constraint camiones_capacidad_tn_positive check (capacidad_tn > 0);
