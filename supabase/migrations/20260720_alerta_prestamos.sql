-- Alerta propia para vencimientos de cuotas de préstamos.
--
-- Contexto: las alertas de cuotas de préstamo ya se generaban en
-- `src/lib/alertas.ts` (disparos a 7 días / 1 día / vencida), pero se guardaban
-- con `tipo = 'otro'`, así que en la matriz de notificaciones caían en la
-- columna genérica "Otros avisos" — mezcladas con cumpleaños, ausencias y
-- services. Eso hacía imposible mandarle SÓLO los préstamos a una persona
-- (pedido: que le lleguen a Paula cuando una cuota está por vencer).
--
-- El ruteo se resuelve en código por `entidad_tipo` ('prestamo_cuota:<umbral>'),
-- sin agregar valores al enum `alerta_tipo`. Acá sólo se siembra el parámetro
-- del toggle, para que aparezca encendido en Configuración → Notificaciones.

insert into parametros_sistema (clave, valor, tipo_dato, categoria, editable, descripcion)
select
  'alerta_prestamos_vencimiento_activa',
  'true',
  'boolean',
  'notificaciones',
  true,
  'Alerta activa: Préstamos por vencer'
where not exists (
  select 1 from parametros_sistema where clave = 'alerta_prestamos_vencimiento_activa'
);
