-- Acoplados en Compliance — PASO C: qué papeles se le piden al acoplado.
--
-- Corre DESPUÉS de 20260826a (el enum), en otra corrida.
--
-- Los tres son papeles de la tolva, no del tractor:
--   · la VTV, porque el acoplado tiene su propia patente y su propia oblea;
--   · las válvulas de seguridad y el disco de ruptura, que están montados sobre
--     la cisterna (Bárbara, 26/08/2026: "las válvulas de seguridad están en las
--     tolvas, son acoplados").
--
-- Van SIN `tipo_documento_id`: el papel se guarda en `compliance_documentos`
-- contra `acoplado_id`, con sus adjuntos en la tabla puente que ya existe.
--
-- Se le piden a TODOS los acoplados activos, no sólo a las cisternas. Hoy no
-- hay forma de saber cuáles llevan válvulas —los 64 tienen `es_tolva` en false
-- y `tipo` en null— y bloquear la carga sería peor que mostrar de más: el que
-- no aplique queda en "sin cargar", que es exactamente lo que pasa hoy con los
-- 62 chasis a los que se les pide un certificado que no tienen.

insert into public.compliance_requisitos
  (codigo, nombre, descripcion, cliente_aplica, nivel, periodicidad, dias_alerta, activo, orden, tipo_documento_id)
select v.codigo, v.nombre, v.descripcion,
       v.cliente_aplica::public.compliance_cliente_aplica,
       'acoplado'::public.compliance_nivel,
       v.periodicidad::public.compliance_periodicidad,
       v.dias_alerta, true, v.orden, null
from (values
  ('ACOP_VTV',           'VTV del acoplado',                     'La oblea del acoplado: tiene patente propia y vence aparte de la del chasis.', 'AMBOS',      'anual', 30, 71),
  ('ACOP_VALVULAS',      'Certificado de válvulas de seguridad',  'Las válvulas están montadas sobre la cisterna, no sobre el tractor.',          'LOMA_NEGRA', 'anual', 30, 72),
  ('ACOP_DISCO_RUPTURA', 'Certificado de disco de ruptura',       'El disco es parte del tanque del acoplado.',                                   'LOMA_NEGRA', 'anual', 30, 73)
) as v(codigo, nombre, descripcion, cliente_aplica, periodicidad, dias_alerta, orden)
where not exists (
  select 1 from public.compliance_requisitos r where r.codigo = v.codigo
);

-- Los dos que estaban pidiéndose sobre el CHASIS se desactivan: el papel no es
-- del tractor. No se borran —los documentos ya cargados cuelgan de ellos y el
-- paso D los muda— y la vista filtra por `activo`, así que desaparecen solos
-- del checklist. Mismo tratamiento que recibió UNID_BTB el 21/07.
update public.compliance_requisitos
   set activo = false
 where codigo in ('CERT_VALVULAS', 'CERT_DISCO_RUPTURA')
   and nivel = 'unidad';
