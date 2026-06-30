import { NextRequest, NextResponse } from "next/server";
import { requireArea } from "@/lib/auth";
import { getCargasParaExportAction } from "../actions";
import { buildSingleSheetWorkbook, type ProColumn, type CellValue } from "@/lib/excel/professional-sheet";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await requireArea("combustible", "read");
  const month = req.nextUrl.searchParams.get("month") || undefined;
  const data = await getCargasParaExportAction(month);

  if (data.length === 0) {
    return NextResponse.json({ error: "No hay cargas para exportar en este período." }, { status: 404 });
  }

  const columns: ProColumn[] = [
    { header: "Fecha", width: 12, align: "c", numFmt: "dd/mm/yyyy" },
    { header: "Patente", width: 12, align: "c" },
    { header: "Marca / Modelo", width: 22, align: "l" },
    { header: "Chofer", width: 24, align: "l" },
    { header: "Tipo de carga", width: 14, align: "c" },
    { header: "Estación", width: 18, align: "l" },
    { header: "Combustible", width: 18, align: "c" },
    { header: "KM odómetro", width: 13, align: "c", numFmt: "#,##0" },
    { header: "Litros", width: 11, align: "c", numFmt: "#,##0.00" },
    { header: "Importe", width: 16, align: "r", numFmt: '"$" #,##0.00' },
  ];
  const rows: CellValue[][] = data.map((c) => [
    new Date(`${String(c.fecha).slice(0, 10)}T12:00:00`),
    c.patente,
    c.marca_modelo,
    c.chofer,
    c.lugar_carga,
    c.estacion,
    c.tipo,
    c.km_odometro || null,
    c.litros,
    c.importe_total,
  ]);
  const totLitros = data.reduce((s, c) => s + c.litros, 0);
  const totImporte = data.reduce((s, c) => s + c.importe_total, 0);
  const totals: CellValue[] = [
    "TOTALES", null, null, null, null, null, null, null,
    Number(totLitros.toFixed(2)),
    Number(totImporte.toFixed(2)),
  ];

  const buf = await buildSingleSheetWorkbook("Combustible", { columns, rows, totals });
  const filename = `combustible_${month || "mes-actual"}.xlsx`;

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
