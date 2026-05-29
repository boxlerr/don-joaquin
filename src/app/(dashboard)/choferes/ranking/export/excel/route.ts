import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireArea } from "@/lib/auth";
import { computeRanking, resolverRango } from "../../lib";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await requireArea("logistica", "read");

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
      "% Vacíos": Number(r.pct_vacios.toFixed(1)),
      "Apercib. leves": r.apercibimientos_leves,
      "Apercib. moderados": r.apercibimientos_moderados,
      "Apercib. graves": r.apercibimientos_graves,
      "Apercib. total": r.apercibimientos_total,
      Roturas: r.roturas_count,
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
      "% Vacíos": 0,
      "Apercib. leves": 0,
      "Apercib. moderados": 0,
      "Apercib. graves": 0,
      "Apercib. total": 0,
      Roturas: 0,
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
    4, 18, 18, 16, 6, 8, 12, 12, 12, 9, 13, 18, 14, 14, 8, 16,
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
