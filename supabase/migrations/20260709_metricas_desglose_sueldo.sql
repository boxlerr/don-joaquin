-- Métricas: desglose del sueldo (páginas RETENCIONES del PDF) + columnas para
-- las planillas ANUALES (mes×flota sin choferes). Pedido Julián 09/07:
-- "quiero subir absolutamente todos los datos".

-- 1) Desglose por concepto del sueldo del chofer (planilla SUELDO SOBRE
--    FACTURACION, páginas de retenciones). Regla de la planilla:
--    retenciones + adelantos + devol_prestamo + embargo_judicial + aguinaldo
--    + sueldo_neto = sueldo_total (validada fila por fila al importar).
alter table public.metricas_chofer_mes
  add column if not exists retenciones      numeric check (retenciones >= 0),
  add column if not exists adelantos        numeric check (adelantos >= 0),
  add column if not exists devol_prestamo   numeric check (devol_prestamo >= 0),
  add column if not exists embargo_judicial numeric check (embargo_judicial >= 0),
  add column if not exists aguinaldo        numeric check (aguinaldo >= 0);

comment on column public.metricas_chofer_mes.retenciones is
  'Retenciones del mes (desglose de la planilla de sueldos).';
comment on column public.metricas_chofer_mes.aguinaldo is
  'Aguinaldo pagado en el mes (jun/dic).';

-- 2) Planillas anuales (2023 no tiene meses por chofer: solo estos agregados
--    mensuales por flota). Toneladas viene por grupo ESCAL 35 / ESCAL 37.
alter table public.metricas_mes
  add column if not exists km_vacios      numeric check (km_vacios >= 0),
  add column if not exists km_100         numeric check (km_100 >= 0),
  add column if not exists sueldo_total   numeric check (sueldo_total >= 0),
  add column if not exists sueldo_neto    numeric check (sueldo_neto >= 0),
  add column if not exists toneladas_prom numeric check (toneladas_prom >= 0),
  add column if not exists ton_escal35    numeric check (ton_escal35 >= 0),
  add column if not exists ton_escal37    numeric check (ton_escal37 >= 0);
