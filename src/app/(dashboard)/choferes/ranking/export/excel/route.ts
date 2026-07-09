import { NextRequest, NextResponse } from "next/server";
import { requireSeccion } from "@/lib/auth";
import { computeRanking, resolverRango } from "../../lib";
import {
  buildSingleSheetWorkbook,
  type ProColumn,
  type CellValue,
} from "@/lib/excel/professional-sheet";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await requireSeccion("choferes_ranking", "read");

  const sp = req.nextUrl.searchParams;
  const periodo = resolverRango({
    rango: sp.get("rango") ?? undefined,
    desde: sp.get("desde") ?? undefined,
    hasta: sp.get("hasta") ?? undefined,
  });

  const ranking = await computeRanking({
    desde: periodo.desde,
    hasta: periodo.hasta,
  });

  const conScore = ranking.filter((r) => r.score !== null);
  const sinActividad = ranking.filter((r) => r.score === null);

  const columns: ProColumn[] = [
    { header: "#", width: 5, align: "c" },
    { header: "Apellido", width: 18, align: "l" },
    { header: "Nombre", width: 18, align: "l" },
    { header: "Localidad", width: 16, align: "l" },
    { header: "Score", width: 9, align: "c" },
    { header: "Viajes", width: 8, align: "c", numFmt: "#,##0" },
    { header: "KM con carga", width: 12, align: "c", numFmt: "#,##0" },
    { header: "KM vacíos", width: 11, align: "c", numFmt: "#,##0" },
    { header: "KM totales", width: 11, align: "c", numFmt: "#,##0" },
    { header: "Toneladas", width: 11, align: "c", numFmt: "#,##0" },
    { header: "Facturación (ARS)", width: 16, align: "r", numFmt: '"$" #,##0' },
    { header: "$ / km", width: 10, align: "r", numFmt: '"$" #,##0' },
    { header: "% Vacíos", width: 9, align: "c", numFmt: "0.0" },
    { header: "Consumo (L/100km)", width: 14, align: "c", numFmt: "0.0" },
    { header: "Gomas", width: 8, align: "c", numFmt: "#,##0" },
    { header: "Roturas varias", width: 12, align: "c", numFmt: "#,##0" },
    { header: "Apercibimientos", width: 14, align: "c", numFmt: "#,##0" },
    { header: "Siniestros", width: 11, align: "c", numFmt: "#,##0" },
    { header: "Conducta", width: 10, align: "c", numFmt: "#,##0" },
    { header: "Taller", width: 8, align: "c", numFmt: "#,##0" },
    { header: "Licencias activas", width: 13, align: "c", numFmt: "#,##0" },
  ];

  // Primero los rankeados (ordenados por score) y abajo los sin actividad.
  const rows: CellValue[][] = [
    ...conScore.map((r, idx): CellValue[] => [
      idx + 1,
      r.apellido,
      r.nombre,
      r.localidad ?? "",
      r.score,
      r.viajes_count,
      r.km_con_carga,
      r.km_vacios,
      r.km_total,
      Math.round(r.toneladas_total),
      Math.round(r.facturacion_total),
      r.pesos_por_km != null ? Math.round(r.pesos_por_km) : null,
      Number(r.pct_vacios.toFixed(1)),
      r.combustible_lp100 != null ? Number(r.combustible_lp100.toFixed(1)) : null,
      r.gomas_count,
      r.roturas_varias_count,
      r.apercibimientos_count,
      r.siniestros_count,
      r.conducta_count,
      r.taller_count,
      r.licencias_activas,
    ]),
    ...sinActividad.map((r): CellValue[] => [
      null,
      r.apellido,
      r.nombre,
      r.localidad ?? "",
      "Sin actividad",
      0, 0, 0, 0, 0, 0,
      null,
      0,
      null,
      0, 0, 0, 0, 0, 0, 0,
    ]),
  ];

  const buf = await buildSingleSheetWorkbook("Ranking", {
    title: `Ranking de Choferes — ${periodo.label}`,
    subtitle: `Período: ${periodo.desde} a ${periodo.hasta} · Generado: ${new Date().toLocaleString("es-AR")}`,
    columns,
    rows,
  });

  const filename = `ranking-choferes_${periodo.desde}_${periodo.hasta}.xlsx`;

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
