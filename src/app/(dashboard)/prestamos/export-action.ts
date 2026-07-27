"use server";

import { requireSeccion } from "@/lib/auth";
import {
  buildMultiSheetWorkbook,
  type ProColumn,
  type CellValue,
} from "@/lib/excel/professional-sheet";
import { getPrestamosAction } from "./actions";
import { textoFaltantes } from "./faltantes";

// Arma el Excel de préstamos con el estilo profesional del sistema (mismo que
// cheques, clientes, viajes…) y lo devuelve en base64 para que el botón dispare
// la descarga. Dos hojas: "Préstamos" (resumen por préstamo con totales) y
// "Cuotas" (cronograma completo, con estado de cada cuota).

// Mediodía para esquivar corrimientos de zona horaria al formatear la fecha.
function fechaCell(iso?: string | null): Date | null {
  if (!iso) return null;
  const dia = iso.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(dia) ? new Date(`${dia}T12:00:00`) : null;
}

export async function exportarPrestamosXlsxAction(): Promise<{
  filename: string;
  base64: string;
}> {
  // Sección confidencial: mismo gate que la página (no basta con "finanzas").
  await requireSeccion("prestamos", "read");

  const prestamos = await getPrestamosAction();
  const hoyISO = new Date().toISOString().slice(0, 10);
  const hoy = hoyISO.split("-").reverse().join("/");

  // --- Hoja 1: resumen por préstamo ---------------------------------------
  const resumenCols: ProColumn[] = [
    { header: "Banco", width: 16, align: "l" },
    { header: "Monto", width: 16, align: "l" },
    { header: "Referencia", width: 14, align: "l" },
    { header: "Tasa %", width: 10, align: "c", numFmt: "0.0" },
    { header: "Importe cuota", width: 16, align: "r", numFmt: '"$" #,##0.00' },
    { header: "Cuotas", width: 9, align: "c" },
    { header: "Pagadas", width: 9, align: "c" },
    { header: "Pendientes", width: 11, align: "c" },
    { header: "Próxima cuota", width: 14, align: "c", numFmt: "dd/mm/yyyy" },
    { header: "Última cuota", width: 14, align: "c", numFmt: "dd/mm/yyyy" },
    { header: "Falta pagar", width: 16, align: "r", numFmt: '"$" #,##0.00' },
    { header: "Falta cargar", width: 30, align: "l" },
  ];

  const resumenRows: CellValue[][] = prestamos.map((p) => {
    const ultima = p.cuotas[p.cuotas.length - 1]?.fecha_vencimiento ?? null;
    return [
      p.banco,
      p.detalle || null,
      p.referencia || null,
      p.tasa,
      p.importe_cuota,
      p.cuotas_total,
      p.pagadas,
      p.cuotas_total - p.pagadas,
      fechaCell(p.proxima?.fecha_vencimiento),
      fechaCell(ultima),
      p.restante,
      textoFaltantes(p),
    ];
  });

  const totalFalta = prestamos.reduce((s, p) => s + p.restante, 0);
  const totals: CellValue[] = [
    "TOTALES",
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    totalFalta,
    null,
  ];

  // --- Hoja 2: cronograma completo ----------------------------------------
  const cuotaCols: ProColumn[] = [
    { header: "Banco", width: 16, align: "l" },
    { header: "Monto", width: 16, align: "l" },
    { header: "Referencia", width: 14, align: "l" },
    { header: "Cuota", width: 9, align: "c" },
    { header: "Vencimiento", width: 14, align: "c", numFmt: "dd/mm/yyyy" },
    { header: "Importe", width: 16, align: "r", numFmt: '"$" #,##0.00' },
    { header: "Estado", width: 12, align: "c" },
  ];

  const cuotaRows: CellValue[][] = prestamos.flatMap((p) =>
    p.cuotas.map((c) => [
      p.banco,
      p.detalle || null,
      p.referencia || null,
      `${c.nro}/${p.cuotas_total}`,
      fechaCell(c.fecha_vencimiento),
      c.importe,
      c.pagada ? "Pagada" : c.fecha_vencimiento < hoyISO ? "Vencida" : "Pendiente",
    ]),
  );

  const buf = await buildMultiSheetWorkbook([
    {
      name: "Préstamos",
      opts: {
        title: "Préstamos — Resumen por banco",
        subtitle: `${prestamos.length} préstamo(s) · exportado el ${hoy}`,
        columns: resumenCols,
        rows: resumenRows,
        totals,
      },
    },
    {
      name: "Cuotas",
      opts: {
        title: "Préstamos — Cronograma de cuotas",
        subtitle: `${cuotaRows.length} cuota(s) · exportado el ${hoy}`,
        columns: cuotaCols,
        rows: cuotaRows,
      },
    },
  ]);

  return {
    filename: `prestamos-${hoyISO}.xlsx`,
    base64: buf.toString("base64"),
  };
}
