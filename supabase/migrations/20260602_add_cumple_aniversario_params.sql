-- Parámetros configurables para preaviso de cumpleaños y aniversarios de choferes.
-- Si ya existen (p.ej. de una carga manual) no se sobreescriben.
INSERT INTO parametros_sistema (clave, valor, tipo_dato, categoria, descripcion, editable) VALUES
  ('alerta_cumple_dias_preaviso', '30', 'number', 'notificaciones',
   'Días de anticipación para avisar el cumpleaños de un chofer', true),
  ('alerta_aniversario_dias_preaviso', '30', 'number', 'notificaciones',
   'Días de anticipación para avisar un aniversario de antigüedad (hito) de un chofer', true)
ON CONFLICT (clave) DO NOTHING;
