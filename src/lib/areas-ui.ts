import type { AreaCodigo } from "@/lib/permisos-nivel";

/**
 * Cómo se ve cada área: en qué grupo del menú vive, cómo se llama y de qué color
 * es. Sin lógica ni componentes, para que lo puedan leer los dos lados.
 *
 * El color existía sólo dentro del `Sidebar` (idea de Bárbara: el puntito que
 * distingue los grupos de un vistazo). Cuando las novedades pasaron a mostrar de
 * qué sección hablan, hacía falta el mismo color en otro lado — y una segunda
 * copia de trece hex es una que queda vieja. Vive acá y el sidebar lo importa.
 *
 * Que el color sea EL MISMO no es cosmético: la etiqueta de una novedad tiene
 * que teñirse igual que el grupo del menú al que hay que ir.
 */

export type GrupoMenu =
  | "PRINCIPAL"
  | "LOGÍSTICA"
  | "FLOTA"
  | "SEGURIDAD"
  | "RRHH"
  | "COMERCIAL"
  | "FINANZAS"
  | "COMPLIANCE"
  | "SISTEMA";

/** Color del grupo (punto + rótulo del menú). Gris si aparece uno nuevo. */
export const GRUPO_COLOR: Record<GrupoMenu, string> = {
  PRINCIPAL: "#475569",
  "LOGÍSTICA": "#0088D1",
  FLOTA: "#6366F1",
  SEGURIDAD: "#EF4444",
  RRHH: "#10B981",
  COMERCIAL: "#A855F7",
  FINANZAS: "#F59E0B",
  COMPLIANCE: "#06B6D4",
  SISTEMA: "#64748B",
};

/**
 * En qué grupo del menú cae cada área. Ojo que no es uno a uno con el nombre:
 * el área `logistica` es la de los legajos y en el menú vive bajo "Personal"
 * (RRHH), mientras que "Logística" agrupa Viajes y Combustible.
 */
export const AREA_GRUPO: Record<AreaCodigo, GrupoMenu> = {
  principal: "PRINCIPAL",
  logistica: "RRHH",
  rrhh: "RRHH",
  viajes: "LOGÍSTICA",
  combustible: "LOGÍSTICA",
  flota: "FLOTA",
  mantenimiento: "FLOTA",
  seguridad: "SEGURIDAD",
  comercial: "COMERCIAL",
  finanzas: "FINANZAS",
  caja: "FINANZAS",
  compliance: "COMPLIANCE",
  sistema: "SISTEMA",
};

/** Cómo se llama el área en la pantalla. */
export const AREA_NOMBRE: Record<AreaCodigo, string> = {
  principal: "Principal",
  logistica: "Personal",
  viajes: "Viajes",
  flota: "Flota",
  mantenimiento: "Mantenimiento",
  combustible: "Combustible",
  seguridad: "Seguridad",
  comercial: "Comercial",
  finanzas: "Finanzas",
  caja: "Caja",
  rrhh: "RRHH",
  compliance: "Compliance",
  sistema: "Sistema",
};

export function colorDeArea(area: AreaCodigo | null | undefined): string {
  if (!area) return GRUPO_COLOR.SISTEMA;
  return GRUPO_COLOR[AREA_GRUPO[area]] ?? GRUPO_COLOR.SISTEMA;
}
