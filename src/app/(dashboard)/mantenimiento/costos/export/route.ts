import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasSeccion } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { buildMultiSheetWorkbook, type CellValue } from "@/lib/excel/professional-sheet";
import {
  getCostosRepRepAction,
  getCostosResumenAction,
  type CostoRepRep,
} from "../actions";
import { mesLabel } from "../formato";

export const dynamic = "force-dynamic";

// Export de Costos de Repuestos y Reparaciones con el look profesional del resto
// del sistema. Tres hojas: el detalle por proveedor, el total de cada mes y el
// acumulado por proveedor (que es lo que la pantalla mensual no muestra).

const MONEY = '"$" #,##0';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (!hasSeccion(user, "mantenimiento_costos", "read")) {
    return NextResponse.json({ error: "No tenés permiso para exportar costos." }, { status: 403 });
  }

  const mesParam = req.nextUrl.searchParams.get("mes");
  const mes = mesParam && /^\d{4}-\d{2}-\d{2}$/.test(mesParam) ? mesParam : null;
  // El Excel tiene que cerrar con lo que se ve en pantalla: si hay un proveedor
  // buscado, el archivo trae ese proveedor y no los treinta.
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();

  const [todas, resumen] = await Promise.all([
    getCostosRepRepAction(mes),
    getCostosResumenAction(),
  ]);
  const rows = q ? todas.filter((r) => r.proveedor.toLowerCase().includes(q)) : todas;

  if (rows.length === 0) {
    return NextResponse.json(
      { error: q ? `No hay costos de "${q}" para exportar.` : "No hay costos para exportar." },
      { status: 404 },
    );
  }

  const iva = (r: CostoRepRep) => Number(r.facturado_total) - Number(r.neto_total);
  const suma = (f: (r: CostoRepRep) => number) => rows.reduce((a, r) => a + f(r), 0);

  /* --- Hoja 1: detalle ---------------------------------------------------- */
  const detalle = {
    name: "Detalle",
    opts: {
      title: "Costos de Repuestos y Reparaciones",
      subtitle: mes ? mesLabel(mes) : "Todos los meses cargados",
      columns: [
        { header: "Mes", width: 14, align: "l" as const },
        { header: "Proveedor", width: 42, align: "l" as const },
        { header: "Neto 21%", width: 16, align: "r" as const, numFmt: MONEY },
        { header: "Facturado 21%", width: 16, align: "r" as const, numFmt: MONEY },
        { header: "Neto NG", width: 14, align: "r" as const, numFmt: MONEY },
        { header: "Facturado NG", width: 15, align: "r" as const, numFmt: MONEY },
        { header: "Neto total", width: 16, align: "r" as const, numFmt: MONEY },
        { header: "IVA", width: 15, align: "r" as const, numFmt: MONEY },
        { header: "Facturado total", width: 17, align: "r" as const, numFmt: MONEY },
        { header: "Observaciones", width: 28, align: "l" as const },
      ],
      rows: rows.map<CellValue[]>((r) => [
        mesLabel(r.mes),
        r.proveedor,
        Number(r.neto_gravado),
        Number(r.facturado_gravado),
        Number(r.neto_ng),
        Number(r.facturado_ng),
        Number(r.neto_total),
        iva(r),
        Number(r.facturado_total),
        r.observaciones ?? "",
      ]),
      totals: [
        "TOTAL",
        `${rows.length} registros`,
        suma((r) => Number(r.neto_gravado)),
        suma((r) => Number(r.facturado_gravado)),
        suma((r) => Number(r.neto_ng)),
        suma((r) => Number(r.facturado_ng)),
        suma((r) => Number(r.neto_total)),
        suma(iva),
        suma((r) => Number(r.facturado_total)),
        null,
      ] as CellValue[],
    },
  };

  /* --- Hoja 2: total por mes ---------------------------------------------- */
  // De más viejo a más nuevo: leído como evolución, el orden natural es al revés
  // del que usa la pantalla.
  const porMes = [...resumen].reverse();
  const hojaMeses = {
    name: "Por mes",
    opts: {
      title: "Costos de Repuestos y Reparaciones — total por mes",
      columns: [
        { header: "Mes", width: 18, align: "l" as const },
        { header: "Proveedores", width: 14, align: "c" as const },
        { header: "Neto total", width: 18, align: "r" as const, numFmt: MONEY },
        { header: "IVA", width: 18, align: "r" as const, numFmt: MONEY },
        { header: "Facturado total", width: 19, align: "r" as const, numFmt: MONEY },
      ],
      rows: porMes.map<CellValue[]>((m) => [
        mesLabel(m.mes),
        m.proveedores,
        m.neto_total,
        m.iva_total,
        m.facturado_total,
      ]),
      totals: [
        "TOTAL",
        null,
        porMes.reduce((a, m) => a + m.neto_total, 0),
        porMes.reduce((a, m) => a + m.iva_total, 0),
        porMes.reduce((a, m) => a + m.facturado_total, 0),
      ] as CellValue[],
    },
  };

  /* --- Hoja 3: acumulado por proveedor ------------------------------------ */
  const acc = new Map<string, { meses: number; neto: number; facturado: number }>();
  for (const r of rows) {
    const a = acc.get(r.proveedor) ?? { meses: 0, neto: 0, facturado: 0 };
    a.meses += 1;
    a.neto += Number(r.neto_total);
    a.facturado += Number(r.facturado_total);
    acc.set(r.proveedor, a);
  }
  const porProveedor = [...acc.entries()].sort((a, b) => b[1].facturado - a[1].facturado);
  const totalFacturado = porProveedor.reduce((a, [, v]) => a + v.facturado, 0);

  const hojaProveedores = {
    name: "Por proveedor",
    opts: {
      title: "Costos de Repuestos y Reparaciones — acumulado por proveedor",
      subtitle: mes ? mesLabel(mes) : "Todos los meses cargados",
      columns: [
        { header: "Proveedor", width: 42, align: "l" as const },
        { header: "Meses", width: 10, align: "c" as const },
        { header: "Neto total", width: 18, align: "r" as const, numFmt: MONEY },
        { header: "IVA", width: 18, align: "r" as const, numFmt: MONEY },
        { header: "Facturado total", width: 19, align: "r" as const, numFmt: MONEY },
        { header: "Participación", width: 14, align: "r" as const, numFmt: "0.0%" },
      ],
      rows: porProveedor.map<CellValue[]>(([nombre, v]) => [
        nombre,
        v.meses,
        v.neto,
        v.facturado - v.neto,
        v.facturado,
        totalFacturado ? v.facturado / totalFacturado : 0,
      ]),
      totals: [
        "TOTAL",
        porProveedor.length,
        porProveedor.reduce((a, [, v]) => a + v.neto, 0),
        porProveedor.reduce((a, [, v]) => a + (v.facturado - v.neto), 0),
        totalFacturado,
        totalFacturado ? 1 : 0,
      ] as CellValue[],
    },
  };

  /* --- Hoja 4: comparativo proveedor × mes -------------------------------- */
  // Sólo tiene sentido con más de un mes en el archivo.
  const mesesEnArchivo = [...new Set(rows.map((r) => r.mes))].sort();
  const hojas = [detalle, hojaMeses, hojaProveedores];
  if (mesesEnArchivo.length > 1) {
    const celda = new Map(rows.map((r) => [`${r.proveedor}|${r.mes}`, Number(r.facturado_total)]));
    const nombres = porProveedor.map(([nombre]) => nombre);
    hojas.push({
      name: "Comparativo",
      opts: {
        title: "Costos de Repuestos y Reparaciones — facturado por proveedor y mes",
        columns: [
          { header: "Proveedor", width: 42, align: "l" as const },
          ...mesesEnArchivo.map((m) => ({
            header: mesLabel(m),
            width: 16,
            align: "r" as const,
            numFmt: MONEY,
          })),
          { header: "Total", width: 18, align: "r" as const, numFmt: MONEY },
        ],
        rows: nombres.map<CellValue[]>((p) => [
          p,
          ...mesesEnArchivo.map((m) => celda.get(`${p}|${m}`) ?? null),
          acc.get(p)?.facturado ?? 0,
        ]),
        totals: [
          "TOTAL",
          ...mesesEnArchivo.map((m) =>
            rows.filter((r) => r.mes === m).reduce((a, r) => a + Number(r.facturado_total), 0),
          ),
          totalFacturado,
        ] as CellValue[],
      },
    });
  }

  const buf = await buildMultiSheetWorkbook(hojas);
  const sufijo = mes ? `_${mes.slice(0, 7)}` : "";
  const filename = `costos_repuestos_reparaciones${sufijo}.xlsx`;

  await logAudit({
    accion: "exportar",
    entidadTipo: "costo_rep_rep",
    usuarioId: user.id,
    metadata: { mes: mes ?? "todos", registros: rows.length, ...(q ? { busqueda: q } : {}) },
  });

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
