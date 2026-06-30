-- Score de choferes — planilla de Bárbara (jun 2026).
-- Toda la configuración del puntaje (pesos/topes, referencias y % de descuento
-- por nivel de cada concepto) vive en UNA sola fila JSON, editable por el admin
-- desde la web ("Configurar criterios"). El código (criterios.ts → mergeCriterios)
-- hace fallback a estos mismos defaults si la fila falta o el JSON es inválido.
-- Idempotente.

INSERT INTO parametros_sistema (clave, valor, tipo_dato, categoria, descripcion, editable) VALUES (
  'ranking_score_config',
  '{"topes":{"km":18,"toneladas":10,"combustible":13,"gomas":9,"roturas_varias":9,"seguridad":20,"siniestros":11,"conducta":10},"km_ref_mensual":13500,"combustible_ref":33.6,"tramos":{"km":{"promedio":0.35,"malo":0.7,"muy_malo":1},"toneladas":{"leve":0.4,"importante":0.7,"grave":1},"combustible":{"promedio":0.35,"malo":0.7,"muy_malo":1},"gomas":{"uno":0.3,"dos":0.65,"tres_mas":1},"roturas_varias":{"leve":0.3,"medio":0.7,"grave":1},"seguridad":{"uno":0.7,"dos_mas":1},"siniestros":{"uno":0.6,"dos_mas":1},"conducta":{"dos":0.35,"tres":0.7,"cuatro_mas":1}}}',
  'json', 'ranking',
  'Configuración completa del score de choferes (pesos, referencias y % por nivel), editable desde la web',
  true
) ON CONFLICT (clave) DO NOTHING;

-- Limpieza del modelo viejo (penalizaciones flat) y de las filas sueltas
-- intermedias (topes/refs por separado), reemplazadas por el JSON único.
DELETE FROM parametros_sistema
WHERE clave LIKE 'ranking_pen_%'
   OR clave LIKE 'ranking_tope_%'
   OR clave LIKE 'ranking_ref_%';
