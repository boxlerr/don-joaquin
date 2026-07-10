import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasSeccion } from "@/lib/auth";
import { getMetricasAction } from "../actions";
import { armarPlanillas, parsearPlanillasParam } from "../export-data";
import {
  buildMultiSheetWorkbook,
  type ProColumn,
  type CellValue,
} from "@/lib/excel/professional-sheet";

export const dynamic = "force-dynamic";

// Export a Excel de las planillas de gestión del mes (una hoja por planilla),
// con el mismo look profesional del resto del sistema. Confidencial.

const MONEY = '"$" #,##0';
const MONEY2 = '"$" #,##0.00';
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !hasSeccion(user, "metricas", "read")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const month = req.nextUrl.searchParams.get("month") ?? "";
  const data = await getMetricasAction(month);
  const planillas = armarPlanillas(data, parsearPlanillasParam(req.nextUrl.searchParams.get("planilla")));
  const [y, m] = data.mes.split("-");
  const periodo = `${MESES[parseInt(m, 10) - 1]} ${y}`;

  const sheets = planillas.map((p) => ({
    name: p.titulo.slice(0, 31),
    opts: {
      title: p.titulo,
      subtitle: `${periodo} · ${data.choferes.length} choferes`,
      columns: p.columnas.map((c): ProColumn => ({
        header: c.header,
        width: c.width,
        align: c.align,
        numFmt: c.money ? (c.dec ? MONEY2 : MONEY) : c.dec ? `#,##0.${"0".repeat(c.dec)}` : undefined,
      })),
      rows: p.filas as CellValue[][],
      totals: p.totales.length ? (p.totales as CellValue[]) : undefined,
    },
  }));

  const buffer = await buildMultiSheetWorkbook(sheets);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="metricas_${data.mes.slice(0, 7)}.xlsx"`,
    },
  });
}
