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
  | "viajes_liquidaciones"
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
  | "prestamos"
  | "dashboard_completo"
  | "metricas"
  // Caja
  | "caja_saldo"
  | "caja_grande"
  // RRHH
  | "sueldos_admin"
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
  // Siniestros y Extintores viven en el grupo "Seguridad" del sidebar → área propia.
  { codigo: "siniestros", area: "seguridad", nombre: "Siniestros", orden: 14 },
  // Reportes vive en el grupo "Principal" del sidebar → área propia.
  { codigo: "reportes", area: "principal", nombre: "Reportes", orden: 15 },
  { codigo: "sueldos", area: "logistica", nombre: "Sueldos", orden: 16, confidencial: true },
  // --- Viajes --------------------------------------------------------------
  { codigo: "viajes_listado", area: "viajes", nombre: "Listado y mensual", orden: 10 },
  { codigo: "viajes_hoja_ruta", area: "viajes", nombre: "Hoja de ruta", orden: 11 },
  { codigo: "viajes_carga_rapida", area: "viajes", nombre: "Carga rápida", orden: 12 },
  { codigo: "viajes_planilla", area: "viajes", nombre: "Planilla diaria", orden: 13 },
  { codigo: "viajes_liquidaciones", area: "viajes", nombre: "DM y liquidaciones", orden: 14 },
  // --- Flota ---------------------------------------------------------------
  { codigo: "camiones", area: "flota", nombre: "Camiones", orden: 10 },
  { codigo: "extintores", area: "seguridad", nombre: "Extintores", orden: 11 },
  // --- Mantenimiento -------------------------------------------------------
  { codigo: "mantenimiento_servicios", area: "mantenimiento", nombre: "Servicios", orden: 10 },
  { codigo: "mantenimiento_costos", area: "mantenimiento", nombre: "Costos de repuestos", orden: 11 },
  // --- Comercial -----------------------------------------------------------
  { codigo: "clientes", area: "comercial", nombre: "Clientes", orden: 10 },
  { codigo: "tarifas", area: "comercial", nombre: "Tarifas", orden: 11 },
  // --- Finanzas ------------------------------------------------------------
  // Gastos y Cheques se marcaron confidenciales desde /usuarios (la tabla
  // `secciones` PISA a este catálogo, ver auth.ts) y se otorgaron a mano a Nico,
  // Pablo y Paula. El catálogo decía lo contrario, y eso importa: si la consulta a
  // `secciones` falla o vuelve vacía, auth.ts cae acá — y estas dos pasaban a
  // heredarse del área `finanzas`, o sea a abrirse. Un fallback de permisos tiene
  // que fallar cerrado.
  { codigo: "gastos", area: "finanzas", nombre: "Gastos", orden: 10, confidencial: true },
  { codigo: "cheques", area: "finanzas", nombre: "Cheques", orden: 11, confidencial: true },
  // Impuestos va confidencial junto con Sueldos y Caja grande (audios Bárbara
  // 30/06, tema 8): datos fiscales de la empresa. Se destapa por rol desde
  // /usuarios → "Secciones confidenciales" si Bárbara decide abrirla.
  { codigo: "impuestos", area: "finanzas", nombre: "Impuestos", orden: 12, confidencial: true },
  // Préstamos bancarios (planilla de la mamá): cuotas, avisos y carga semanal.
  // Confidencial como el resto de finanzas sensibles (audios Bárbara 02/07).
  { codigo: "prestamos", area: "finanzas", nombre: "Préstamos", orden: 14, confidencial: true },
  // El dashboard general (/dashboard) queda sin facturación para todos; la
  // facturación acumulada vive en /dashboard/completo, solo Bárbara + Nicolás
  // (audios 30/06, tema 6 — opción B "dos dashboards").
  { codigo: "dashboard_completo", area: "principal", nombre: "Dashboard completo", orden: 13, confidencial: true },
  // Métricas históricas (las 6 planillas del padre + comparativa interanual):
  // confidencial, por defecto solo administradores (8vo feedback, 08/07).
  { codigo: "metricas", area: "principal", nombre: "Métricas históricas", orden: 14, confidencial: true },
  // --- Caja ------------------------------------------------------------------
  // "Operar ≠ ver": con área caja en write se pueden CARGAR movimientos, pero
  // saldo/historial/retiros (caja_saldo) y la caja grande (caja_grande) son
  // confidenciales — solo dirección, salvo permiso explícito (tema 3).
  { codigo: "caja_saldo", area: "caja", nombre: "Saldo e historial", orden: 10, confidencial: true },
  { codigo: "caja_grande", area: "caja", nombre: "Caja grande", orden: 11, confidencial: true },
  // --- RRHH ------------------------------------------------------------------
  // Planilla de sueldos de administración + taller sobre facturación (tema 2).
  { codigo: "sueldos_admin", area: "rrhh", nombre: "Sueldos admin y taller", orden: 11, confidencial: true },
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
