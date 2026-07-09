"use server";

import { requireArea } from "@/lib/auth";
import {
  buildSingleSheetWorkbook,
  type ProColumn,
  type CellValue,
} from "@/lib/excel/professional-sheet";
import { NIVEL_LABEL, type ComplianceEstado, type ComplianceEstadoRow } from "./types";

// Arma el Excel del checklist de compliance (las filas visibles del tablero,
// ya filtradas y ordenadas por nivel en el cliente) con el estilo profesional
// del sistema y lo devuelve en base64 para que el cliente dispare la descarga.

// Mismas etiquetas que muestra el checklist en pantalla.
const ESTADO_LABEL: Record<ComplianceEstado, string> = {
  vigente: "al día",
  por_vencer: "por vencer",
  vencido: "vencido",
  faltante: "falta",
};

function tagCliente(aplica: string): string | null {
  if (aplica === "YPF") return "solo YPF";
  if (aplica === "LOMA_NEGRA") return "solo Loma";
  return null;
}

// Mediodía para esquivar corrimientos de zona horaria al formatear la fecha.
function fechaCell(iso: string | null): Date | null {
  return iso ? new Date(`${iso.slice(0, 10)}T12:00:00`) : null;
}

function slugFilename(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export async function exportarComplianceChecklistXlsxAction(
  titulo: string,
  rows: ComplianceEstadoRow[],
  hoyISO: string,
): Promise<{ filename: string; base64: string }> {
  await requireArea("compliance", "read");

  const hoy = hoyISO.slice(0, 10).split("-").reverse().join("/");

  const columns: ProColumn[] = [
    { header: "Alcance", width: 12, align: "l" },
    { header: "Entidad", width: 26, align: "l" },
    { header: "Documento", width: 42, align: "l" },
    { header: "Estado", width: 12, align: "c" },
    { header: "Vencimiento", width: 13, align: "c", numFmt: "dd/mm/yyyy" },
  ];

  const rowsXlsx: CellValue[][] = rows.map((r) => {
    const tag = tagCliente(r.cliente_aplica);
    return [
      NIVEL_LABEL[r.nivel],
      r.chofer_nombre ?? r.camion_patente ?? "Empresa",
      r.requisito_nombre + (tag ? ` (${tag})` : ""),
      ESTADO_LABEL[r.estado],
      fechaCell(r.fecha_vencimiento),
    ];
  });

  const buf = await buildSingleSheetWorkbook("Checklist", {
    title: `Compliance — ${titulo}`,
    subtitle: `${rows.length} documento(s) · exportado el ${hoy}`,
    columns,
    rows: rowsXlsx,
  });

  return {
    filename: `compliance-${slugFilename(titulo)}-${hoyISO}.xlsx`,
    base64: buf.toString("base64"),
  };
}
