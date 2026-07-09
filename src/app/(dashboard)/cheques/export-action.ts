"use server";

import { requireArea } from "@/lib/auth";
import {
  buildSingleSheetWorkbook,
  type ProColumn,
  type CellValue,
} from "@/lib/excel/professional-sheet";
import type { ChequeExportRow } from "./actions";

// Arma el Excel de cheques con el estilo profesional del sistema y lo devuelve
// en base64 para que el cliente dispare la descarga. Recibe los datos ya
// consultados desde la vista (getAllChequesForExportAction).

const TIPO_LABEL: Record<string, string> = {
  comun: "Común",
  diferido: "Diferido",
  electronico: "Electrónico",
};

const ESTADO_LABEL: Record<string, string> = {
  cartera: "En cartera",
  entregado: "Entregado",
  depositado: "Depositado",
  acreditado: "Acreditado",
  rechazado: "Rechazado",
  anulado: "Anulado",
};

function tipoTexto(tipo?: string): string | null {
  if (!tipo) return null;
  return TIPO_LABEL[tipo] ?? tipo;
}

function estadoTexto(estado?: string): string | null {
  if (!estado) return null;
  return ESTADO_LABEL[estado] ?? estado.charAt(0).toUpperCase() + estado.slice(1);
}

// Mediodía para esquivar corrimientos de zona horaria al formatear la fecha.
function fechaCell(iso?: string | null): Date | null {
  if (!iso) return null;
  const dia = iso.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(dia) ? new Date(`${dia}T12:00:00`) : null;
}

export async function exportarChequesXlsxAction(
  cheques: ChequeExportRow[],
  filenameBase = "cheques",
): Promise<{ filename: string; base64: string }> {
  await requireArea("finanzas", "read");

  const hoyISO = new Date().toISOString().slice(0, 10);
  const hoy = hoyISO.split("-").reverse().join("/");

  const columns: ProColumn[] = [
    { header: "Número", width: 16, align: "c" },
    { header: "Tipo", width: 12, align: "c" },
    { header: "Banco", width: 20, align: "l" },
    { header: "Librador", width: 25, align: "l" },
    { header: "Cliente", width: 25, align: "l" },
    { header: "Importe", width: 16, align: "r", numFmt: '"$" #,##0.00' },
    { header: "Fecha Emisión", width: 13, align: "c", numFmt: "dd/mm/yyyy" },
    { header: "Fecha Vencimiento", width: 15, align: "c", numFmt: "dd/mm/yyyy" },
    { header: "Estado", width: 13, align: "c" },
    { header: "Concepto", width: 30, align: "l" },
  ];

  const rows: CellValue[][] = cheques.map((c) => {
    const importe = Number(c.importe);
    return [
      c.numero || null,
      tipoTexto(c.tipo),
      c.banco?.nombre ?? null,
      c.librador_nombre || null,
      c.cliente?.razon_social ?? null,
      Number.isFinite(importe) ? importe : null,
      fechaCell(c.fecha_emision),
      fechaCell(c.fecha_vencimiento),
      estadoTexto(c.estado),
      c.concepto || null,
    ];
  });

  // Fila de totales: suma del importe (los cheques cargados son todos en ARS).
  const totalImporte = cheques.reduce((s, c) => {
    const v = Number(c.importe);
    return Number.isFinite(v) ? s + v : s;
  }, 0);
  const totals: CellValue[] = [
    "TOTALES",
    null,
    null,
    null,
    null,
    totalImporte,
    null,
    null,
    null,
    null,
  ];

  const buf = await buildSingleSheetWorkbook("Cheques", {
    title: "Cheques — Listado completo",
    subtitle: `${cheques.length} cheque(s) · exportado el ${hoy}`,
    columns,
    rows,
    totals,
  });

  return {
    filename: `${filenameBase}-${hoyISO}.xlsx`,
    base64: buf.toString("base64"),
  };
}
