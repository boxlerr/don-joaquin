/**
 * Vocabulario de permisos (áreas y niveles) sin dependencias de servidor, para
 * que la lógica pura de permisos pueda importarse desde tests y desde el
 * cliente. `auth.ts` lo re-exporta: sigue siendo el punto de entrada habitual.
 */

export type AreaCodigo =
  | "principal"
  | "logistica"
  | "viajes"
  | "flota"
  | "mantenimiento"
  | "combustible"
  | "seguridad"
  | "comercial"
  | "finanzas"
  | "caja"
  | "rrhh"
  | "compliance"
  | "sistema";

export type AreaNivel = "none" | "read" | "write" | "admin";

export const NIVEL_RANK: Record<AreaNivel, number> = {
  none: 0,
  read: 1,
  write: 2,
  admin: 3,
};

export type PermisosArea = Record<AreaCodigo, AreaNivel>;

export const AREAS_VACIAS: PermisosArea = {
  principal: "none",
  logistica: "none",
  viajes: "none",
  flota: "none",
  mantenimiento: "none",
  combustible: "none",
  seguridad: "none",
  comercial: "none",
  finanzas: "none",
  caja: "none",
  rrhh: "none",
  compliance: "none",
  sistema: "none",
};
