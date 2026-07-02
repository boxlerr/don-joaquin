-- BTB por unidad (pedido §9 reunión Nico 29/06).
-- ---------------------------------------------------------------------------
-- La BTB es un documento de CADA unidad y va para todas las plataformas
-- ("la BTB va para todo el mundo", Nico). Se modela igual que la VTV: un
-- requisito de compliance a nivel unidad + un tipo_documento, para que el PDF
-- viva en el legajo del camión y v_compliance_estado lo expanda por unidad.
-- Idempotente. Las fechas de vencimiento por unidad se cargan después como docs.

insert into public.tipos_documento (codigo, nombre, aplica_a, obligatorio, dias_alerta_vencimiento)
select 'btb', 'BTB', 'camion', false, 30
where not exists (select 1 from public.tipos_documento where codigo = 'btb');

insert into public.compliance_requisitos
  (codigo, nombre, nivel, cliente_aplica, periodicidad, dias_alerta, tipo_documento_id, orden, activo)
select 'UNID_BTB', 'BTB', 'unidad', 'AMBOS', 'anual', 30,
       (select id from public.tipos_documento where codigo = 'btb'), 85, true
where not exists (select 1 from public.compliance_requisitos where codigo = 'UNID_BTB');
