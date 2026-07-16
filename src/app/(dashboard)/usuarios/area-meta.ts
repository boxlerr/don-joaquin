// Metadatos de presentación de cada área de permiso. Centraliza el título corto
// y QUÉ SECCIONES controla cada área, para mostrarlo claro en la matriz, los
// overrides y el tutorial. (El permiso real vive en la DB; esto es solo UI.)

export type AreaMeta = { titulo: string; paginas: string[] };

export const AREA_META: Record<string, AreaMeta> = {
  viajes: { titulo: "Viajes", paginas: ["Viajes", "Carga rápida", "Importar hoja de ruta", "Importar PDF de YPF"] },
  logistica: { titulo: "Personal, Siniestros y Reportes", paginas: ["Legajos", "Ranking de choferes", "Rotación", "Vacaciones", "Sueldos choferes (confidencial)", "Siniestros", "Reportes"] },
  flota: { titulo: "Camiones y Extintores", paginas: ["Camiones", "Extintores"] },
  mantenimiento: { titulo: "Mantenimiento", paginas: ["Mantenimiento (taller, services, roturas)"] },
  combustible: { titulo: "Combustible", paginas: ["Combustible (cargas de gasoil)"] },
  comercial: { titulo: "Comercial", paginas: ["Clientes", "Tarifas"] },
  finanzas: { titulo: "Finanzas", paginas: ["Gastos", "Cheques"] },
  caja: { titulo: "Caja", paginas: ["Caja (movimientos de dinero)"] },
  rrhh: { titulo: "RR.HH.", paginas: ["Entrevistas", "Sueldos admin y taller (confidencial)"] },
  compliance: { titulo: "Compliance", paginas: ["Loma Negra", "YPF", "SICOP", "Secondi", "Próximas presentaciones"] },
  sistema: { titulo: "Sistema", paginas: ["Usuarios y permisos", "Auditoría", "Configuración"] },
};

export const areaTitulo = (codigo: string, fallback?: string) =>
  AREA_META[codigo]?.titulo ?? fallback ?? codigo;

export const areaPaginas = (codigo: string): string[] => AREA_META[codigo]?.paginas ?? [];

// Niveles de permiso — etiqueta + qué significa.
export const NIVEL_INFO: Record<string, { label: string; desc: string; clase: string }> = {
  none: { label: "Sin acceso", desc: "No ve la sección", clase: "bg-muted text-muted-foreground" },
  read: { label: "Lectura", desc: "Puede ver, no editar", clase: "bg-blue-50 text-blue-700" },
  write: { label: "Edición", desc: "Puede ver y cargar/editar", clase: "bg-green-50 text-green-700" },
  admin: { label: "Admin", desc: "Control total del área", clase: "bg-amber-50 text-amber-700" },
};

// Nombre de rol acortado para listas/desplegables angostos:
// "Representante de Combustible" -> "Rep. Combustible".
export function rolLabel(nombre: string): string {
  return nombre
    .replace(/^Representante de\s+/i, "Rep. ")
    .replace(/^Representante\s+/i, "Rep. ");
}
