-- Sueldos admin/taller: columnas variables FIELES al Excel de Bárbara.
-- El Excel usa: comisión logística, combustible, plus YPF, sábados (montos fijos
-- por mes), no "horas extras × valor hora". Reemplazamos el modelo de variables.
-- La tabla sueldos_admin_mes está vacía (solo se cargaron aumentos), así que se
-- pueden cambiar las columnas sin migrar datos.

alter table public.sueldos_admin_mes
  add column if not exists comision_logistica numeric not null default 0,
  add column if not exists combustible        numeric not null default 0,
  add column if not exists plus_ypf            numeric not null default 0,
  add column if not exists sabados             numeric not null default 0;

alter table public.sueldos_admin_mes drop column if exists horas_extras;
alter table public.sueldos_admin_mes drop column if exists valor_hora;
alter table public.sueldos_admin_mes drop column if exists plus;

comment on column public.sueldos_admin_mes.comision_logistica is 'Comisión logística del mes (Excel Bárbara).';
comment on column public.sueldos_admin_mes.combustible is 'Combustible para venir a la base (Excel Bárbara).';
comment on column public.sueldos_admin_mes.plus_ypf is 'Plus YPF del mes (Excel Bárbara).';
comment on column public.sueldos_admin_mes.sabados is 'Horas extras de sábados del mes (Excel Bárbara).';
