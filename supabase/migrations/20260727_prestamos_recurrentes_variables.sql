-- Dos formas de préstamo que no entraban en el modelo de "N cuotas fijas".

-- 1) Pago mensual sin fin: el plan de ARCA se paga todos los meses, el 16, y no
--    termina. No tiene última cuota ni deuda total, así que se marca aparte y el
--    sistema le mantiene el calendario cargado (getPrestamosAction repone hasta
--    12 meses adelante cuando quedan pocos).
alter table public.prestamos
  add column if not exists es_recurrente boolean not null default false,
  add column if not exists dia_vencimiento smallint;

alter table public.prestamos
  drop constraint if exists prestamos_dia_vencimiento_check;
alter table public.prestamos
  add constraint prestamos_dia_vencimiento_check
  check (dia_vencimiento is null or dia_vencimiento between 1 and 31);

comment on column public.prestamos.es_recurrente is
  'Pago mensual sin fecha de fin (ARCA, servicios). No tiene deuda total: queda fuera de "falta pagar".';
comment on column public.prestamos.dia_vencimiento is
  'Día del mes en que vence, para los recurrentes (ej. 16). Los meses cortos caen al último día.';

update public.prestamos
   set es_recurrente = true,
       dia_vencimiento = 16
 where banco = 'AFIP'
   and referencia = 'Plan de pago';

-- 2) Cuota variable: en los préstamos a tasa variable la cuota cambia todos los
--    meses, así que el importe de la ficha es sólo el último conocido. El
--    importe real de cada mes ya vive en prestamo_cuotas.importe.
alter table public.prestamos
  add column if not exists cuota_variable boolean not null default false;

comment on column public.prestamos.cuota_variable is
  'La cuota cambia mes a mes (tasa variable). El importe de la ficha es el último conocido.';

-- Los 7 de Nación ya venían anotados en observaciones.
update public.prestamos
   set cuota_variable = true
 where observaciones ilike '%tasa variable%';
