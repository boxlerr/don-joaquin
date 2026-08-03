import { ExcelExportService, type ExcelColumn } from "@/shared/services/excel-export.service";

export interface ChequeExportable {
  numero?: string;
  tipo?: string;
  origen?: string;
  importe?: number | string;
  moneda?: string;
  fecha_emision?: string;
  fecha_vencimiento?: string;
  estado?: string;
  librador_nombre?: string;
  concepto?: string | null;
  banco?: { nombre?: string } | null;
  cliente?: { razon_social?: string } | null;
}

function formatFecha(fecha?: string): string {
  if (!fecha) return "—";
  if (/^\d{4}-\d{2}-\d{2}/.test(fecha)) {
    const parts = fecha.split("T")[0].split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  const ts = Date.parse(fecha);
  return Number.isNaN(ts) ? fecha : new Date(ts).toLocaleDateString("es-AR");
}

function formatImporte(importe?: number | string, moneda = "ARS"): string {
  const val = Number(importe);
  if (!Number.isFinite(val)) return "$ 0,00";
  try {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: moneda || "ARS",
    }).format(val);
  } catch {
    return `$ ${val.toLocaleString("es-AR")}`;
  }
}

function formatEstado(estado?: string): string {
  if (!estado) return "—";
  const labels: Record<string, string> = {
    cartera: "En cartera",
    entregado: "Entregado",
    depositado: "Depositado",
    acreditado: "Acreditado",
    emitido: "Emitido",
    debitado: "Debitado",
    rechazado: "Rechazado",
    anulado: "Anulado",
  };
  return labels[estado] ?? estado.charAt(0).toUpperCase() + estado.slice(1);
}

function formatOrigen(origen?: string): string {
  if (origen === "propio") return "Nuestro";
  return "Recibido";
}

function formatTipo(tipo?: string): string {
  if (!tipo) return "—";
  const labels: Record<string, string> = {
    comun: "Común",
    diferido: "Diferido",
    electronico: "Electrónico",
  };
  return labels[tipo] ?? tipo;
}

export function exportChequesToExcel(
  cheques: ChequeExportable[],
  filename = "cheques"
): void {
  const columns: ExcelColumn<ChequeExportable>[] = [
    { header: "Número", key: (c) => c.numero || "—", width: 16 },
    { header: "Origen", key: (c) => formatOrigen(c.origen), width: 12 },
    { header: "Tipo", key: (c) => formatTipo(c.tipo), width: 12 },
    { header: "Banco", key: (c) => c.banco?.nombre || "—", width: 20 },
    { header: "Librador", key: (c) => c.librador_nombre || "—", width: 25 },
    { header: "Cliente", key: (c) => c.cliente?.razon_social || "—", width: 25 },
    { header: "Importe", key: (c) => formatImporte(c.importe, c.moneda), width: 18 },
    { header: "Fecha Emisión", key: (c) => formatFecha(c.fecha_emision), width: 14 },
    { header: "Fecha Vencimiento", key: (c) => formatFecha(c.fecha_vencimiento), width: 18 },
    { header: "Estado", key: (c) => formatEstado(c.estado), width: 14 },
    { header: "Concepto", key: (c) => c.concepto || "—", width: 30 },
  ];

  ExcelExportService.exportToExcel({
    filename,
    data: cheques,
    columns,
    sheetName: "Cheques",
  });
}

export const ChequesExcelService = {
  exportChequesToExcel,
};
