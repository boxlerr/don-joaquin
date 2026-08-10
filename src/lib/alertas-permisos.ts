import "server-only";
import { COLUMNA_CONFIDENCIAL, seccionDeColumna } from "@/lib/alertas-routing";
import { getUsuariosConSeccion } from "@/lib/permisos-usuarios";
import type { SeccionCodigo } from "@/lib/secciones";

/**
 * El mismo filtro de confidencialidad que `alertas-visibilidad`, pero del lado del
 * que MANDA en vez del que mira.
 *
 * `visiblePara(user)` sirve cuando hay una sesión: la campana, el pop-up del día,
 * /notificaciones. El correo no tiene sesión — el cron recorre `usuarios` con
 * service role —, así que hay que resolver el permiso de OTRA persona. Eso lo hace
 * `getUsuariosConSeccion` (lib/permisos-usuarios.ts), que es el reverso de
 * `hasSeccion`.
 *
 * Falla CERRADO, al revés que los toggles de categoría (`tipoHabilitado` deja pasar
 * lo que no conoce, para que una categoría nueva no nazca muda). Acá el default
 * opuesto es el correcto: si la consulta de permisos falla, el resultado es un mail
 * de menos, no la deuda bancaria en la casilla equivocada.
 */

/**
 * Para las columnas pedidas, qué usuarios pueden recibir cada una.
 *
 * Sólo devuelve las CONFIDENCIALES: que una columna no esté en el mapa quiere decir
 * "es pública, no hay a quién restringirle nada". Se le pasan las columnas que
 * realmente aparecen en el envío para no resolver cinco secciones cuando el correo
 * de hoy trae sólo vencimientos de documentación.
 */
export async function usuariosPorColumna(
  columnas: Iterable<string>,
): Promise<Map<string, Set<string>>> {
  const columnasPorSeccion = new Map<SeccionCodigo, string[]>();
  for (const columna of columnas) {
    const seccion = seccionDeColumna(columna);
    if (!seccion) continue;
    const acc = columnasPorSeccion.get(seccion);
    if (acc) acc.push(columna);
    else columnasPorSeccion.set(seccion, [columna]);
  }
  if (columnasPorSeccion.size === 0) return new Map();

  const secciones = [...columnasPorSeccion.keys()];
  const sets = await Promise.all(secciones.map((s) => getUsuariosConSeccion(s, "read")));

  const permitidos = new Map<string, Set<string>>();
  secciones.forEach((seccion, i) => {
    for (const columna of columnasPorSeccion.get(seccion) ?? []) {
      permitidos.set(columna, sets[i] ?? new Set());
    }
  });
  return permitidos;
}

/** Todas las columnas confidenciales de una: para la matriz de configuración. */
export function usuariosPorColumnaTodas(): Promise<Map<string, Set<string>>> {
  return usuariosPorColumna(Object.keys(COLUMNA_CONFIDENCIAL));
}

/**
 * ¿Le puede llegar esta columna a este usuario? Pública → sí; confidencial → sólo
 * si tiene la sección. `permitidos` sale de `usuariosPorColumna`.
 */
export function puedeRecibir(
  usuarioId: string,
  columna: string,
  permitidos: Map<string, Set<string>>,
): boolean {
  const conAcceso = permitidos.get(columna);
  return conAcceso ? conAcceso.has(usuarioId) : !seccionDeColumna(columna);
}

/**
 * Columnas confidenciales que este usuario NO puede recibir, para dibujarlas
 * bloqueadas en /configuracion/notificaciones.
 */
export function columnasBloqueadas(
  usuarioId: string,
  permitidos: Map<string, Set<string>>,
): string[] {
  return Object.keys(COLUMNA_CONFIDENCIAL).filter(
    (columna) => !permitidos.get(columna)?.has(usuarioId),
  );
}
