-- La pantalla con la que arranca cada persona.
--
-- Pedido de Julián (26/08/2026): "Anabela, que usa compliance, que la lleve a
-- compliance de una". Anabela tiene el rol `administrativo`, el mismo que casi
-- todo el equipo, así que por permisos no hay forma de distinguirla: lo que
-- cambia no es lo que PUEDE ver sino lo que viene a hacer todos los días.
--
-- `null` = el dashboard de siempre. La columna es aditiva y nadie la lee hasta
-- que el código nuevo esté arriba: para la versión desplegada hoy no existe.

alter table public.usuarios
  add column if not exists pantalla_inicio text;

comment on column public.usuarios.pantalla_inicio is
  'Ruta a la que entra esta persona después del login (ej: /compliance). Null = /dashboard.';

-- Anabela (seguridad@) entra a cargar documentación: son 57 documentos cargados
-- en agosto y ni uno solo en otra sección.
update public.usuarios
   set pantalla_inicio = '/compliance'
 where email = 'seguridad@transportedonjoaquin.com.ar';
