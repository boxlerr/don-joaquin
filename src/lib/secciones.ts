// ---------------------------------------------------------------------------
// Catálogo de SUBSECCIONES (un nivel más fino que las áreas).
//
// Una subsección hereda el nivel de su área por defecto. El admin puede pisar
// ese nivel por rol (tabla `rol_secciones`) para abrir o cerrar páginas puntuales
// sin tocar el resto del área — ej.: "Choferes sí, Sueldos no".
//
// Esta es la ÚNICA fuente de verdad del catálogo: la usan la resolución de
// permisos (auth.ts), la navegación (nav-items.ts) y el editor de la matriz.
// La tabla `secciones` en la DB la espeja (para FK de rol_secciones / RLS futura).
// ---------------------------------------------------------------------------

import type { AreaCodigo } from "./auth";

export type SeccionCodigo =
  // Logística → Choferes y Siniestros
  | "choferes"
  | "choferes_ranking"
  | "choferes_rotacion"
  | "choferes_vacaciones"
  | "siniestros"
  | "reportes"
  | "sueldos"
  // Viajes
  | "viajes_listado"
  | "viajes_hoja_ruta"
  | "viajes_carga_rapida"
  | "viajes_planilla"
  // Flota
  | "camiones"
  | "extintores"
  // Mantenimiento
  | "mantenimiento_servicios"
  | "mantenimiento_costos"
  // Comercial
  | "clientes"
  | "tarifas"
  // Finanzas
  | "gastos"
  | "cheques"
  | "impuestos"
  // Compliance
  | "compliance_loma"
  | "compliance_ypf"
  | "compliance_sicop"
  | "compliance_secondi"
  // Sistema
  | "usuarios"
  | "auditoria"
  | "configuracion";

export interface Seccion {
  codigo: SeccionCodigo;
  /** Área "madre": de ahí hereda el nivel y bajo ella se agrupa en la matriz. */
  area: AreaCodigo;
  nombre: string;
  orden: number;
  /**
   * Si es true, arranca en "Sin acceso" para todos los roles no-admin aunque
   * tengan el área: hay que otorgarla explícitamente. Para datos sensibles
   * (sueldos). El admin siempre la ve.
   */
  confidencial?: boolean;
}

export const SECCIONES: Seccion[] = [
  // --- Logística -----------------------------------------------------------
  { codigo: "choferes", area: "logistica", nombre: "Legajos", orden: 10 },
  { codigo: "choferes_ranking", area: "logistica", nombre: "Ranking", orden: 11 },
  { codigo: "choferes_rotacion", area: "logistica", nombre: "Rotación", orden: 12 },
  { codigo: "choferes_vacaciones", area: "logistica", nombre: "Vacaciones", orden: 13 },
  { codigo: "siniestros", area: "logistica", nombre: "Siniestros", orden: 14 },
  { codigo: "reportes", area: "logistica", nombre: "Reportes", orden: 15 },
  { codigo: "sueldos", area: "logistica", nombre: "Sueldos", orden: 16, confidencial: true },
  // --- Viajes --------------------------------------------------------------
  { codigo: "viajes_listado", area: "viajes", nombre: "Listado y mensual", orden: 10 },
  { codigo: "viajes_hoja_ruta", area: "viajes", nombre: "Hoja de ruta", orden: 11 },
  { codigo: "viajes_carga_rapida", area: "viajes", nombre: "Carga rápida", orden: 12 },
  { codigo: "viajes_planilla", area: "viajes", nombre: "Planilla diaria", orden: 13 },
  // --- Flota ---------------------------------------------------------------
  { codigo: "camiones", area: "flota", nombre: "Camiones", orden: 10 },
  { codigo: "extintores", area: "flota", nombre: "Extintores", orden: 11 },
  // --- Mantenimiento -------------------------------------------------------
  { codigo: "mantenimiento_servicios", area: "mantenimiento", nombre: "Servicios", orden: 10 },
  { codigo: "mantenimiento_costos", area: "mantenimiento", nombre: "Costos rep. y rep.", orden: 11 },
  // --- Comercial -----------------------------------------------------------
  { codigo: "clientes", area: "comercial", nombre: "Clientes", orden: 10 },
  { codigo: "tarifas", area: "comercial", nombre: "Tarifas", orden: 11 },
  // --- Finanzas ------------------------------------------------------------
  { codigo: "gastos", area: "finanzas", nombre: "Gastos", orden: 10 },
  { codigo: "cheques", area: "finanzas", nombre: "Cheques", orden: 11 },
  { codigo: "impuestos", area: "finanzas", nombre: "Impuestos", orden: 12 },
  // --- Compliance ----------------------------------------------------------
  { codigo: "compliance_loma", area: "compliance", nombre: "Loma Negra", orden: 10 },
  { codigo: "compliance_ypf", area: "compliance", nombre: "YPF", orden: 11 },
  { codigo: "compliance_sicop", area: "compliance", nombre: "SICOP", orden: 12 },
  { codigo: "compliance_secondi", area: "compliance", nombre: "Secondi", orden: 13 },
  // --- Sistema -------------------------------------------------------------
  { codigo: "usuarios", area: "sistema", nombre: "Usuarios y permisos", orden: 10 },
  { codigo: "auditoria", area: "sistema", nombre: "Auditoría", orden: 11 },
  { codigo: "configuracion", area: "sistema", nombre: "Configuración", orden: 12 },
];

export const SECCION_BY_CODIGO: Record<SeccionCodigo, Seccion> = Object.fromEntries(
  SECCIONES.map((s) => [s.codigo, s]),
) as Record<SeccionCodigo, Seccion>;

/** Subsecciones de un área, ordenadas. Vacío = el área no tiene subsecciones. */
export function seccionesDeArea(area: AreaCodigo): Seccion[] {
  return SECCIONES.filter((s) => s.area === area).sort((a, b) => a.orden - b.orden);
}
