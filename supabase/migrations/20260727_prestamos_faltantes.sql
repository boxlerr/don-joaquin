-- "Qué falta cargar" pasa de frase suelta a marcas que el sistema puede
-- verificar: al llenar el importe, la marca se apaga sola. La frase libre queda
-- sólo para lo que el sistema no puede mirar (ej. si es un pago único).
alter table public.prestamos
  add column if not exists faltantes text[] not null default '{}';

comment on column public.prestamos.faltantes is
  'Datos verificables que faltan: monto | importe | tasa. Se apagan solos al cargarse el campo.';

-- Backfill desde las frases que había, separando lo verificable de la nota.
update public.prestamos set faltantes = '{importe}', datos_faltantes = null
 where datos_faltantes = 'el importe de la cuota';

update public.prestamos set faltantes = '{importe,tasa}', datos_faltantes = null
 where datos_faltantes = 'el importe de la cuota y la tasa';

update public.prestamos
   set faltantes = '{monto}',
       datos_faltantes = 'la fecha de vencimiento (la que figura es estimada)'
 where datos_faltantes = 'el monto original del préstamo y la fecha de vencimiento de la cuota';

update public.prestamos
   set faltantes = '{importe,tasa}',
       datos_faltantes = 'la fecha de vencimiento y el número de cuota'
 where datos_faltantes = 'la fecha, el importe de la cuota, el número de cuota y la tasa';

update public.prestamos
   set faltantes = '{tasa}',
       datos_faltantes = 'si es un pago único o una cuota de un plan'
 where datos_faltantes = 'si es un pago único o una cuota de un plan (y la tasa)';

-- "si es un pago único o parte de un plan en cuotas" queda como está: no hay
-- nada verificable ahí.
