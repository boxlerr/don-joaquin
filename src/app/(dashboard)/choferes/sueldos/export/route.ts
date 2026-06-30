import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getSueldosResumenAction, type SueldoChoferRow } from "../actions";
import { buildSingleSheetWorkbook, type ProColumn, type CellValue } from "@/lib/excel/professional-sheet";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await requireAdmin();
  const month = req.nextUrl.searchParams.get("month") || undefined;
  const data = await getSueldosResumenAction(month);

  if (data.length === 0) {
    return NextResponse.json({ error: "No hay viajes cerrados para exportar en este período." }, { status: 404 });
  }

  const columns: ProColumn[] = [
    { header: "Chofer", width: 26, align: "l" },
    { header: "Viajes", width: 9, align: "c", numFmt: "#,##0" },
    { header: "Km al 100% (con carga)", width: 20, align: "c", numFmt: "#,##0" },
    { header: "Km vacíos", width: 12, align: "c", numFmt: "#,##0" },
    { header: "Km total", width: 12, align: "c", numFmt: "#,##0" },
    { header: "Toneladas", width: 12, align: "c", numFmt: "#,##0.00" },
    { header: "Viajes al sur", width: 13, align: "c", numFmt: "#,##0" },
    { header: "Zona petrolera", width: 14, align: "c", numFmt: "#,##0" },
  ];
  const rows: CellValue[][] = data.map((r) => [
    r.chofer,
    r.viajes,
    r.km_con_carga,
    r.km_vacios,
    r.km_total,
    Number(r.tonelaje.toFixed(2)),
    r.sur,
    r.pozo,
  ]);
  const sum = (k: keyof SueldoChoferRow) => data.reduce((s, r) => s + (Number(r[k]) || 0), 0);
  const totals: CellValue[] = [
    "TOTALES",
    sum("viajes"),
    sum("km_con_carga"),
    sum("km_vacios"),
    sum("km_total"),
    Number(sum("tonelaje").toFixed(2)),
    sum("sur"),
    sum("pozo"),
  ];

  const buf = await buildSingleSheetWorkbook("Sueldos", {
    title: "Resumen de sueldos por chofer",
    subtitle: month ? `Período ${month}` : "Mes actual",
    columns,
    rows,
    totals,
  });
  const filename = `sueldos_${month || "mes-actual"}.xlsx`;

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
