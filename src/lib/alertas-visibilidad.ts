import type { CurrentUser } from "@/lib/auth";
import { hasSeccion } from "@/lib/auth";

/**
 * Qué alertas puede ver cada usuario.
 *
 * La pantalla de notificaciones sólo exige estar logueado, y hay alertas que
 * hablan de secciones confidenciales: las de préstamos traen montos ("en
 * noviembre hay que pagar $345M", "venció la cuota 12/48 de Nación: $7.696.212").
 * Sin este filtro, un chofer o alguien de taller vería la deuda bancaria de la
 * empresa desde la campanita.
 *
 * Vive en `lib` y no en la pantalla porque lo tienen que compartir la lista, el
 * contador del badge y "marcar todas como leídas": si cada uno filtra distinto,
 * el badge dice 3 y la lista muestra 0.
 */

export type AlertaVisibilidad = { tipo: string; entidad_tipo?: string | null };

/** Sección confidencial de la que habla la alerta, si es de alguna. */
export function seccionDeAlerta(a: AlertaVisibilidad): "prestamos" | null {
  if (a.tipo !== "otro") return null;
  const t = a.entidad_tipo ?? "";
  if (t.startsWith("prestamo_cuota") || t === "prestamos_tope_mensual") return "prestamos";
  return null;
}

/** Filtro reutilizable: `alertas.filter(visiblePara(user))`. */
export function visiblePara(user: CurrentUser): (a: AlertaVisibilidad) => boolean {
  const vePrestamos = hasSeccion(user, "prestamos", "read");
  return (a) => {
    const seccion = seccionDeAlerta(a);
    if (seccion === "prestamos") return vePrestamos;
    return true;
  };
}
