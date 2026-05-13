import { ExcelExportService, type ExcelColumn } from "@/shared/services/excel-export.service";

export interface ViajeExportable {
  id?: string;
  codigo?: string;
  fecha_viaje?: string;
  chofer?: unknown;
  camion?: unknown;
  origen?: unknown;
  destino?: unknown;
  km_totales?: number;
  km_con_carga?: number;
  km_vacios?: number;
  estado?: string;
  monto_flete?: number;
  monto?: number;
  moneda?: string;
  observaciones?: string | null;
  notas?: string | null;
  // Permitir flexibilidad para objetos anidados o resultados de joins directos
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

function formatFecha(fecha?: string): string {
  if (!fecha) return "—";
  // Extraer YYYY-MM-DD para formatear de manera directa y evitar desfases de zona horaria
  if (/^\d{4}-\d{2}-\d{2}/.test(fecha)) {
    const parts = fecha.split("T")[0].split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  }
  const timestamp = Date.parse(fecha);
  if (!Number.isNaN(timestamp)) {
    return new Date(timestamp).toLocaleDateString("es-AR");
  }
  return fecha;
}

function getChoferName(chofer?: unknown): string {
  if (!chofer) return "—";
  if (typeof chofer === "string") return chofer;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = Array.isArray(chofer) ? chofer[0] : chofer;
  if (!c) return "—";
  const parts = [c.apellido, c.nombre].filter(Boolean);
  if (parts.length > 0) return parts.join(", ");
  return c.razon_social || c.nombre || c.name || "—";
}

function getClienteName(cliente?: unknown): string {
  if (!cliente) return "—";
  if (typeof cliente === "string") return cliente;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = Array.isArray(cliente) ? cliente[0] : cliente;
  if (!c) return "—";
  return c.razon_social || c.nombre || c.name || "—";
}

function getCamionName(camion?: unknown): string {
  if (!camion) return "—";
  if (typeof camion === "string") return camion;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = Array.isArray(camion) ? camion[0] : camion;
  if (!c) return "—";
  const parts = [c.patente, c.marca, c.modelo].filter(Boolean);
  if (parts.length > 0) return parts.join(" - ");
  return c.patente || "—";
}

function getPuntoName(punto?: unknown): string {
  if (!punto) return "—";
  if (typeof punto === "string") return punto;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p: any = Array.isArray(punto) ? punto[0] : punto;
  if (!p) return "—";
  return p.nombre || p.alias || p.localidad || "—";
}

function formatEstado(estado?: string): string {
  if (!estado) return "—";
  const str = estado.replace(/_/g, " ");
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatMonto(monto?: unknown, moneda: string = "ARS"): string {
  const val = Number(monto);
  if (!Number.isFinite(val) || val === 0) return "$ 0,00";
  try {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: moneda || "ARS",
    }).format(val);
  } catch {
    return `$ ${val.toLocaleString("es-AR")}`;
  }
}

/**
 * Servicio de dominio para exportar el listado de Viajes a formato Excel.
 * Recibe un array genérico/flexible de viajes y estandariza sus columnas y formatos.
 */
export function exportViajesToExcel(
  viajes: ViajeExportable[],
  filename: string = "viajes"
): void {
  const columns: ExcelColumn<ViajeExportable>[] = [
    { header: "ID", key: (v) => v.codigo || v.id || "—", width: 14 },
    { header: "Fecha", key: (v) => formatFecha(v.fecha_viaje), width: 12 },
    { header: "Cliente", key: (v) => getClienteName(v.clientes || v.cliente), width: 25 },
    { header: "Chofer", key: (v) => getChoferName(v.chofer), width: 25 },
    { header: "Camión", key: (v) => getCamionName(v.camion), width: 20 },
    {
      header: "Origen",
      key: (v) => {
        const p = getPuntoName(v.origen);
        if (p !== "—") return p;
        if (v.origen_nombre && v.origen_nombre !== "—") return v.origen_nombre;
        const match = (v.observaciones || "").match(/Origen:\s*([^|]+)/);
        return match ? match[1].trim() : "—";
      },
      width: 20,
    },
    {
      header: "Destino",
      key: (v) => {
        const p = getPuntoName(v.destino);
        if (p !== "—") return p;
        if (v.destino_nombre && v.destino_nombre !== "—") return v.destino_nombre;
        const match = (v.observaciones || "").match(/Destino:\s*([^|]+)/);
        return match ? match[1].trim() : "—";
      },
      width: 20,
    },
    {
      header: "KM",
      key: (v) => {
        const km = v.km_totales ?? ((Number(v.km_con_carga) || 0) + (Number(v.km_vacios) || 0));
        return km > 0 ? km : 0;
      },
      width: 10,
    },
    { header: "Toneladas", key: (v) => Number(v.tonelaje_real || v.toneladas || 0), width: 12 },
    { header: "Estado", key: (v) => formatEstado(v.estado), width: 15 },
    { header: "Monto", key: (v) => formatMonto(v.monto_flete ?? v.monto, v.moneda), width: 18 },
    {
      header: "Notas",
      key: (v) => {
        const rawNotes = v.observaciones ?? v.notas ?? "";
        return rawNotes
          .split("|")
          .filter((part) => !part.includes("Origen:") && !part.includes("Destino:"))
          .join(" | ")
          .trim();
      },
      width: 30,
    },
  ];

  ExcelExportService.exportToExcel({
    filename,
    data: viajes,
    columns,
    sheetName: "Viajes",
  });
}

export const ViajesExcelService = {
  exportViajesToExcel,
};
