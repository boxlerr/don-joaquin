-- Limpieza: "Seguro de vida" duplicado a nivel chofer.
-- ---------------------------------------------------------------------------
-- Existían DOS requisitos "Seguro de vida" (nivel chofer, AMBOS), ambos sin
-- documentos cargados:
--   - SEGURO_VIDA     (original) → sin tipo_documento (no iba al legajo).
--   - CH_SEGURO_VIDA  (seed 30/06 de Lucas) → linkeado al tipo_documento
--     'seguro_vida' (va al legajo, como pidió Nico).
-- Nos quedamos con el código ORIGINAL (SEGURO_VIDA) pero lo upgradeamos para
-- que use el legajo, y borramos el duplicado. Idempotente y sin pérdida de datos.

update public.compliance_requisitos
set tipo_documento_id = (select id from public.tipos_documento where codigo = 'seguro_vida')
where codigo = 'SEGURO_VIDA'
  and tipo_documento_id is null;

delete from public.compliance_requisitos
where codigo = 'CH_SEGURO_VIDA';
