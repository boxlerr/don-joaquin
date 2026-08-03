/**
 * Mensajes de error que dicen qué pasó.
 *
 * Antes, cualquier falla mostraba "Error al guardar el cheque." y ahí se
 * terminaba la información: sin el motivo real no hay forma de saber si fue un
 * permiso, la base, o que el navegador quedó con una versión vieja de la
 * página. El detalle técnico va entre paréntesis, después de la explicación.
 */
export function describirError(e: unknown, fallback: string): string {
  const detalle =
    e instanceof Error ? e.message : typeof e === "string" ? e : "";

  // Next corta la llamada cuando el navegador quedó con la página de un deploy
  // anterior: el botón apunta a una acción que en el servidor ya no existe.
  if (/server action|not found|failed to find/i.test(detalle)) {
    return "La página quedó con una versión vieja. Recargá con Cmd+Shift+R y probá de nuevo.";
  }
  if (/fetch failed|network|load failed/i.test(detalle)) {
    return "Se cortó la conexión con el servidor. Revisá internet y probá de nuevo.";
  }

  return detalle ? `${fallback} (${detalle})` : fallback;
}
