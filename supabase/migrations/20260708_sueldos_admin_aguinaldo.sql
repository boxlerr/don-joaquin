-- Sueldos mensuales: columna de aguinaldo (8vo feedback Bárbara, 08/07).
-- El Excel mensual de sueldos que va a mandar Nico trae, en junio y diciembre,
-- el aguinaldo como importe aparte. Se suma al total del mes (base + variables
-- + aguinaldo). Para el resto de los meses queda en 0.
alter table public.sueldos_admin_mes
  add column if not exists aguinaldo numeric not null default 0 check (aguinaldo >= 0);

comment on column public.sueldos_admin_mes.aguinaldo is
  'Aguinaldo (SAC) pagado en el mes; 0 si no corresponde. Se suma al total.';
