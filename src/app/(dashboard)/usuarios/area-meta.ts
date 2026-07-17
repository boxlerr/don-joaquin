// Metadatos de presentación de cada área de permiso. Centraliza el título corto
// y QUÉ SECCIONES controla cada área, para mostrarlo claro en la matriz, los
// overrides y el tutorial. (El permiso real vive en la DB; esto es solo UI.)

import type { AreaCodigo } from "@/lib/auth";

export type AreaMeta = { titulo: string; paginas: string[] };

export const AREA_META: Record<string, AreaMeta> = {
  principal: { titulo: "Principal", paginas: ["Reportes", "Métricas (confidencial)", "Dashboard completo (confidencial)"] },
  viajes: { titulo: "Viajes", paginas: ["Viajes", "Carga rápida", "Importar hoja de ruta", "Importar PDF de YPF"] },
  logistica: { titulo: "Personal", paginas: ["Legajos", "Ranking de choferes", "Rotación", "Vacaciones", "Sueldos choferes (confidencial)"] },
  flota: { titulo: "Camiones", paginas: ["Camiones"] },
  mantenimiento: { titulo: "Mantenimiento", paginas: ["Mantenimiento (taller, services, roturas)"] },
  combustible: { titulo: "Combustible", paginas: ["Combustible (cargas de gasoil)"] },
  seguridad: { titulo: "Seguridad", paginas: ["Siniestros", "Extintores"] },
  comercial: { titulo: "Comercial", paginas: ["Clientes", "Tarifas"] },
  finanzas: { titulo: "Finanzas", paginas: ["Gastos", "Cheques", "Impuestos (confidencial)", "Préstamos (confidencial)"] },
  caja: { titulo: "Caja", paginas: ["Caja (movimientos de dinero)"] },
  rrhh: { titulo: "Entrevistas", paginas: ["Entrevistas", "Sueldos admin y taller (confidencial)"] },
  compliance: { titulo: "Compliance", paginas: ["Loma Negra", "YPF", "SICOP", "Secondi", "Próximas presentaciones"] },
  sistema: { titulo: "Sistema", paginas: ["Usuarios y permisos", "Auditoría", "Configuración"] },
};

export const areaTitulo = (codigo: string, fallback?: string) =>
  AREA_META[codigo]?.titulo ?? fallback ?? codigo;

export const areaPaginas = (codigo: string): string[] => AREA_META[codigo]?.paginas ?? [];

// ---------------------------------------------------------------------------
// Estructura del SIDEBAR: los 9 grupos como los ve el usuario. Cada grupo manda
// sobre 1 o 2 áreas reales. La matriz muestra una columna por grupo (nivel
// grueso, bulk sobre sus áreas) y el editor fino de abajo desglosa área x
// subsección. El orden espeja el sidebar.
// ---------------------------------------------------------------------------
export type GrupoSidebar = { group: string; label: string; areas: AreaCodigo[] };

export const GRUPOS_SIDEBAR: GrupoSidebar[] = [
  { group: "PRINCIPAL", label: "Principal", areas: ["principal"] },
  { group: "LOGÍSTICA", label: "Logística", areas: ["viajes", "combustible"] },
  { group: "FLOTA", label: "Flota", areas: ["flota", "mantenimiento"] },
  { group: "SEGURIDAD", label: "Seguridad", areas: ["seguridad"] },
  { group: "RRHH", label: "RR.HH.", areas: ["logistica", "rrhh"] },
  { group: "COMERCIAL", label: "Comercial", areas: ["comercial"] },
  { group: "FINANZAS", label: "Finanzas", areas: ["caja", "finanzas"] },
  { group: "COMPLIANCE", label: "Compliance", areas: ["compliance"] },
  { group: "SISTEMA", label: "Sistema", areas: ["sistema"] },
];

// Color de acento de cada grupo del sidebar. Espeja `GROUP_ACCENT` de
// components/layout/Sidebar.tsx (misma paleta) para que los chips de permisos
// usen el mismo color con el que se ve el grupo en el menú lateral.
export const GRUPO_COLOR: Record<string, string> = {
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

/** Grupo del sidebar al que pertenece un área (ej. finanzas → FINANZAS). */
export function grupoDeArea(area: AreaCodigo): string {
  return GRUPOS_SIDEBAR.find((g) => g.areas.includes(area))?.group ?? "SISTEMA";
}

/** Color del área = color de su grupo del sidebar. */
export function areaColor(area: AreaCodigo): string {
  return GRUPO_COLOR[grupoDeArea(area)] ?? "#64748B";
}

// Niveles de permiso — etiqueta + qué significa.
export const NIVEL_INFO: Record<string, { label: string; desc: string; clase: string }> = {
  none: { label: "Sin acceso", desc: "No ve la sección", clase: "bg-muted text-muted-foreground" },
  read: { label: "Lectura", desc: "Puede ver, no editar", clase: "bg-blue-50 text-blue-700" },
  write: { label: "Edición", desc: "Control total del área: ver, cargar, editar y borrar", clase: "bg-green-50 text-green-700" },
  admin: { label: "Admin", desc: "Control total del área", clase: "bg-amber-50 text-amber-700" },
};

// Nombre de rol acortado para listas/desplegables angostos:
// "Representante de Combustible" -> "Rep. Combustible".
export function rolLabel(nombre: string): string {
  return nombre
    .replace(/^Representante de\s+/i, "Rep. ")
    .replace(/^Representante\s+/i, "Rep. ");
}
