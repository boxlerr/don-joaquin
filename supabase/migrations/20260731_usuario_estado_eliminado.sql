-- Eliminar un usuario no puede borrar su fila: casi todas las tablas del sistema
-- guardan quién cargó cada cosa (created_by) y el audit_log referencia al autor,
-- así que el DELETE choca contra esas claves foráneas (audit_log_usuario_id_fkey,
-- viajes_created_by_fkey, etc.) y no hay forma de borrar sin perder historial.
--
-- Nuevo estado "eliminado": el acceso de auth se borra de verdad (no puede entrar
-- nunca más y desaparece del listado), pero la fila queda como lápida para que
-- todo lo que hizo siga teniendo nombre. El login ya exige estado = 'activo',
-- así que el valor nuevo no habilita nada por sí solo.
alter type usuario_estado add value if not exists 'eliminado';
