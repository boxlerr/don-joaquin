-- Parámetros faltantes para el sistema de alertas
-- Los parámetros dias_alerta_cheque y dias_alerta_vencimiento_default ya existen

INSERT INTO parametros_sistema (clave, valor, tipo_dato, categoria, descripcion, editable)
VALUES
  (
    'alerta_critico_dias',
    '7',
    'number',
    'notificaciones',
    'Días restantes para marcar un vencimiento como crítico (severidad alta)',
    true
  ),
  (
    'alerta_viatico_pendiente_dias',
    '7',
    'number',
    'notificaciones',
    'Días sin rendición para generar alerta de viático pendiente',
    true
  ),
  (
    'alerta_viaje_sin_cerrar_horas',
    '48',
    'number',
    'notificaciones',
    'Horas transcurridas sin cerrar un viaje para generar alerta',
    true
  )
ON CONFLICT (clave) DO NOTHING;
