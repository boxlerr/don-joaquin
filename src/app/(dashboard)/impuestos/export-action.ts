"use server";

import { requireArea } from "@/lib/auth";
import {
  buildMultiSheetWorkbook,
  type ProColumn,
  type CellValue,
} from "@/lib/excel/professional-sheet";
import { getImpuestosAction } from "./actions";
import { totalGeneral } from "./totales";

// Excel de impuestos con el estilo profesional del sistema (mismo que cheques,
// préstamos, viajes…). Una hoja con el calendario completo: qué vencía, cuándo
// se presentó, si se presentó tarde, cuánto se pagó y cuántos comprobantes
// tiene adjuntos.

// Mediodía para esquivar corrimientos de zona horaria al formatear la fecha.
function fechaCell(iso?: string | null): Date | null {
  if (!iso) return null;
  const dia = iso.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(dia) ? new Date(`${dia}T12:00:00`) : null;
}

function diasDe(a: string, b: string): number {
  return Math.round(
    (new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / 86400000,
  );
}

export async function exportarImpuestosXlsxAction(): Promise<{
  filename: string;
  base64: string;
}> {
  await requireArea("finanzas", "read");

  const impuestos = await getImpuestosAction();
  const hoyISO = new Date().toISOString().slice(0, 10);
  const hoy = hoyISO.split("-").reverse().join("/");

  const cols: ProColumn[] = [
    { header: "Impuesto", width: 28, align: "l" },
    { header: "Organismo", width: 16, align: "l" },
    { header: "Período", width: 12, align: "c" },
    { header: "Vencimiento", width: 14, align: "c", numFmt: "dd/mm/yyyy" },
    { header: "Presentado el", width: 14, align: "c", numFmt: "dd/mm/yyyy" },
    { header: "Importe pagado", width: 16, align: "r", numFmt: '"$" #,##0.00' },
    { header: "Pagado el", width: 14, align: "c", numFmt: "dd/mm/yyyy" },
    { header: "Estado", width: 18, align: "l" },
    { header: "Días", width: 9, align: "c" },
    { header: "Comprobantes", width: 13, align: "c" },
    { header: "Observaciones", width: 34, align: "l" },
  ];

  const rows: CellValue[][] = impuestos.map((i) => {
    let estado: string;
    let dias: number | null = null;

    if (i.fecha_presentacion) {
      const d = diasDe(i.fecha_vencimiento, i.fecha_presentacion);
      estado = d > 0 ? `Presentado (${d} d tarde)` : "Presentado en término";
      dias = d > 0 ? d : 0;
    } else {
      const d = diasDe(hoyISO, i.fecha_vencimiento);
      estado = d < 0 ? `Vencido hace ${Math.abs(d)} d` : d === 0 ? "Vence hoy" : `Vence en ${d} d`;
      dias = d;
    }

    return [
      i.nombre,
      i.organismo,
      i.periodo,
      fechaCell(i.fecha_vencimiento),
      fechaCell(i.fecha_presentacion),
      i.importe,
      fechaCell(i.fecha_pago),
      estado,
      dias,
      i.archivos,
      i.observaciones,
    ];
  });

  const presentados = impuestos.filter((i) => i.fecha_presentacion !== null).length;
  const vencidos = impuestos.filter(
    (i) => !i.fecha_presentacion && i.fecha_vencimiento < hoyISO,
  ).length;
  // Lo pagado va con cuántos les falta el importe al lado: el total solo se
  // leería como el gasto entero y es el de la parte que alguien cargó.
  const { total: pagado, sinImporte } = totalGeneral(impuestos);
  const resumenPagado =
    ` · pagado $${pagado.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` +
    (sinImporte > 0 ? ` (${sinImporte} sin importe cargado)` : "");

  const buf = await buildMultiSheetWorkbook([
    {
      name: "Impuestos",
      opts: {
        title: "Impuestos — Calendario de vencimientos",
        subtitle: `${impuestos.length} impuesto(s) · ${presentados} presentado(s) · ${vencidos} vencido(s) sin presentar${resumenPagado} — exportado el ${hoy}`,
        columns: cols,
        rows,
      },
    },
  ]);

  return { filename: `impuestos-${hoyISO}.xlsx`, base64: buf.toString("base64") };
}
