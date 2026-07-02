import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireSeccion } from "@/lib/auth";
import { computeRanking, resolverRango } from "../../lib";

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

  const rows = [
    ...conScore.map((r, idx) => ({
      "#": idx + 1,
      Apellido: r.apellido,
      Nombre: r.nombre,
      Localidad: r.localidad ?? "",
      Score: r.score,
      Viajes: r.viajes_count,
      "KM con carga": r.km_con_carga,
      "KM vacíos": r.km_vacios,
      "KM totales": r.km_total,
      "Toneladas": Math.round(r.toneladas_total),
      "Facturación (ARS)": Math.round(r.facturacion_total),
      "$ / km": r.pesos_por_km != null ? Math.round(r.pesos_por_km) : "",
      "% Vacíos": Number(r.pct_vacios.toFixed(1)),
      "Consumo (L/100km)": r.combustible_lp100 != null ? Number(r.combustible_lp100.toFixed(1)) : "",
      Gomas: r.gomas_count,
      "Roturas varias": r.roturas_varias_count,
      Apercibimientos: r.apercibimientos_count,
      Siniestros: r.siniestros_count,
      Conducta: r.conducta_count,
      Taller: r.taller_count,
      "Licencias activas": r.licencias_activas,
    })),
    ...sinActividad.map((r) => ({
      "#": "",
      Apellido: r.apellido,
      Nombre: r.nombre,
      Localidad: r.localidad ?? "",
      Score: "Sin actividad",
      Viajes: 0,
      "KM con carga": 0,
      "KM vacíos": 0,
      "KM totales": 0,
      "Toneladas": 0,
      "Facturación (ARS)": 0,
      "$ / km": "",
      "% Vacíos": 0,
      "Consumo (L/100km)": "",
      Gomas: 0,
      "Roturas varias": 0,
      Apercibimientos: 0,
      Siniestros: 0,
      Conducta: 0,
      Taller: 0,
      "Licencias activas": 0,
    })),
  ];

  const header = [
    [`Ranking de Choferes — ${periodo.label}`],
    [`Período: ${periodo.desde} a ${periodo.hasta}`],
    [`Generado: ${new Date().toLocaleString("es-AR")}`],
    [],
  ];

  const ws = XLSX.utils.aoa_to_sheet(header);
  XLSX.utils.sheet_add_json(ws, rows, { origin: "A5" });

  const widths = [
    4, 18, 18, 16, 6, 8, 12, 12, 12, 10, 16, 8, 9, 16, 7, 13, 13, 10, 9, 8, 14,
  ];
  ws["!cols"] = widths.map((wch) => ({ wch }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Ranking");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

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
