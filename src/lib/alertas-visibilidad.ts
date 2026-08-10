import type { CurrentUser } from "@/lib/auth";
import { hasSeccion } from "@/lib/auth";
import { alertaColumnaDe, COLUMNA_CONFIDENCIAL, seccionDeColumna } from "@/lib/alertas-routing";
import type { SeccionCodigo } from "@/lib/secciones";
import type { Database } from "@/types/database";

/**
 * Qué alertas puede ver cada usuario.
 *
 * Las pantallas de avisos sólo exigen estar logueado, y hay alertas que hablan de
 * secciones confidenciales: las de préstamos traen montos ("en noviembre hay que
 * pagar $345M", "venció la cuota 12/48 de Nación: $7.696.212"), las de cheques el
 * número y el librador, las de impuestos datos fiscales de la empresa. Sin este
 * filtro, un chofer o alguien de taller vería la deuda bancaria desde la campanita.
 *
 * La lista de qué columna pide qué sección vive en `COLUMNA_CONFIDENCIAL`
 * (lib/alertas-routing.ts), compartida con el reparto por email y con la matriz de
 * /configuracion/notificaciones: si cada capa tuviera la suya, tapar una en la
 * campana la dejaría abierta en el correo, que es justo como estaba.
 *
 * Vive en `lib` y no en la pantalla porque lo tienen que compartir la lista, el
 * contador del badge y "marcar todas como leídas": si cada uno filtra distinto,
 * el badge dice 3 y la lista muestra 0.
 */

export type AlertaVisibilidad = { tipo: string; entidad_tipo?: string | null };

/** Sección confidencial de la que habla la alerta, si es de alguna. */
export function seccionDeAlerta(a: AlertaVisibilidad): SeccionCodigo | null {
  return seccionDeColumna(
    alertaColumnaDe({
      tipo: a.tipo as Database["public"]["Enums"]["alerta_tipo"],
      entidad_tipo: a.entidad_tipo,
    }),
  );
}

/** Filtro reutilizable: `alertas.filter(visiblePara(user))`. */
export function visiblePara(user: CurrentUser): (a: AlertaVisibilidad) => boolean {
  // Se resuelve UNA vez por usuario y no por alerta: el pop-up del día llega a
  // pasar 1000 filas por acá.
  const ve = new Map<SeccionCodigo, boolean>();
  for (const seccion of Object.values(COLUMNA_CONFIDENCIAL)) {
    if (!ve.has(seccion)) ve.set(seccion, hasSeccion(user, seccion, "read"));
  }
  return (a) => {
    const seccion = seccionDeAlerta(a);
    if (!seccion) return true;
    return ve.get(seccion) ?? hasSeccion(user, seccion, "read");
  };
}
