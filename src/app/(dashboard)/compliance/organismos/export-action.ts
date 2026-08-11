"use server";

import { requireArea } from "@/lib/auth";
import {
  buildSingleSheetWorkbook,
  type ProColumn,
  type CellValue,
} from "@/lib/excel/professional-sheet";
import { NIVEL_LABEL, type ComplianceEstado, type OrganismoChecklistRow } from "../types";

// Excel del checklist de un organismo (SICOP, Secondi). Mismo estilo que el
// export del checklist de clientes: lo que se ve en pantalla, en el mismo orden.
// Se exporta lo que hay que presentar y cómo está cada cosa — que es lo que se
// lleva a una reunión o se le manda al estudio.

const ESTADO_LABEL: Record<ComplianceEstado, string> = {
  vigente: "al día",
  por_vencer: "por vencer",
  vencido: "vencido",
  faltante: "falta",
};

const PERIODICIDAD_LABEL: Record<string, string> = {
  mensual: "mensual",
  anual: "anual",
  renovable: "renovable",
  unica: "única vez",
};

/** Mediodía para esquivar corrimientos de zona horaria al formatear la fecha. */
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

export async function exportarOrganismoXlsxAction(
  nombreOrganismo: string,
  rows: OrganismoChecklistRow[],
  hoyISO: string,
): Promise<{ filename: string; base64: string }> {
  await requireArea("compliance", "read");

  const hoy = hoyISO.slice(0, 10).split("-").reverse().join("/");

  const columns: ProColumn[] = [
    { header: "Requisito", width: 40, align: "l" },
    { header: "Alcance", width: 12, align: "l" },
    { header: "Cada cuánto", width: 13, align: "l" },
    { header: "Estado", width: 12, align: "c" },
    { header: "Presentado", width: 13, align: "c", numFmt: "dd/mm/yyyy" },
    { header: "Vence", width: 13, align: "c", numFmt: "dd/mm/yyyy" },
    { header: "Se manda a", width: 28, align: "l" },
    { header: "Observaciones", width: 34, align: "l" },
  ];

  const rowsXlsx: CellValue[][] = rows.map((r) => [
    r.requisito_nombre,
    NIVEL_LABEL[r.nivel],
    PERIODICIDAD_LABEL[r.periodicidad] ?? r.periodicidad,
    ESTADO_LABEL[r.estado],
    fechaCell(r.fecha_emision),
    fechaCell(r.fecha_vencimiento),
    r.enviar_a ?? "",
    r.observaciones ?? "",
  ]);

  const vencidos = rows.filter((r) => r.estado === "vencido").length;
  const faltan = rows.filter((r) => r.estado === "faltante").length;
  const detalle = [
    `${rows.length} requisito(s)`,
    vencidos > 0 ? `${vencidos} vencido(s)` : null,
    faltan > 0 ? `${faltan} sin presentar` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const buf = await buildSingleSheetWorkbook("Checklist", {
    title: `Compliance — ${nombreOrganismo}`,
    subtitle: `${detalle} · exportado el ${hoy}`,
    columns,
    rows: rowsXlsx,
  });

  return {
    filename: `compliance-${slugFilename(nombreOrganismo)}-${hoyISO}.xlsx`,
    base64: buf.toString("base64"),
  };
}
