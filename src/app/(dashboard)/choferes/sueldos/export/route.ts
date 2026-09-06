import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasSeccion } from "@/lib/auth";
import { getSueldosResumenAction, type SueldoChoferRow } from "../actions";
import {
  getSueldosAdminResumenAction,
  type SueldoAdminEmpleado,
} from "../../../sueldos-admin/actions";
import { getNominaMesAction } from "../../../sueldos-admin/nomina-actions";
import {
  buildMultiSheetWorkbook,
  type ProColumn,
  type CellValue,
} from "@/lib/excel/professional-sheet";

export const dynamic = "force-dynamic";

// Export de TODA la sección Sueldos en un solo Excel con el look profesional del
// sistema (hoja de ruta / planilla diaria): una hoja por vista que el usuario
// tenga permiso de ver — Nómina (lo transferido, por banco) · Choferes
// (liquidación por viajes) · Admin y taller (planilla del mes) · Aumentos
// (matriz base vigente mes a mes, como el Excel).

type SheetSpec = Parameters<typeof buildMultiSheetWorkbook>[0][number];

const MESES_ABR = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const MONEY = '"$" #,##0';
function mesAnio(iso: string): string {
  const [y, m] = iso.slice(0, 10).split("-");
  return `${MESES_ABR[parseInt(m, 10) - 1]} ${y}`;
}
function periodoLabel(month?: string): string {
  return month ? mesAnio(`${month}-01`) : "Mes actual";
}
function money(n: number): string {
  return `$ ${Math.round(n).toLocaleString("es-AR")}`;
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const canChoferes = hasSeccion(user, "sueldos", "read");
  const canAdmin = hasSeccion(user, "sueldos_admin", "read");
  if (!canChoferes && !canAdmin) {
    return NextResponse.json({ error: "No tenés permiso para exportar sueldos." }, { status: 403 });
  }

  const month = req.nextUrl.searchParams.get("month") || undefined;
  const periodo = periodoLabel(month);
  const sheets: SheetSpec[] = [];

  // ── Hoja: Nómina (lo transferido, abierto por banco) ─────────────────────
  // Es la hoja que se cruza contra el Excel que llegó: mismas personas, mismos
  // importes y el banco al lado, para poder compararla renglón por renglón.
  if (canAdmin) {
    const nomina = await getNominaMesAction(month);
    if (nomina.personas.length > 0) {
      const columns: ProColumn[] = [
        { header: "Persona", width: 30, align: "l" },
        { header: "Banco", width: 22, align: "l" },
        { header: "Transferido", width: 16, align: "r", numFmt: MONEY },
        { header: "Embargo", width: 14, align: "r", numFmt: MONEY },
      ];
      // Una fila por banco: quien cobra partido ocupa dos o tres renglones, que
      // es exactamente como viene el Excel de origen.
      const rows: CellValue[][] = nomina.personas.flatMap((p) =>
        (p.bancos.length ? p.bancos : [{ banco: null, importe: p.total }]).map((b, i) => [
          i === 0 ? p.nombre : "",
          b.banco ?? "Sin banco",
          b.importe,
          i === 0 && p.embargo > 0 ? p.embargo : null,
        ]),
      );
      const porBanco = nomina.bancos
        .map((b) => `${b.banco ?? "Sin banco"} ${money(b.total)}`)
        .join(" · ");
      sheets.push({
        name: "Nómina",
        opts: {
          title: "Nómina del mes — lo transferido a cada persona",
          subtitle: `${periodo} · ${nomina.personas.length} personas · Total ${money(nomina.total)}${porBanco ? ` — ${porBanco}` : ""}`,
          columns,
          rows,
          totals: ["TOTALES", "", nomina.total, nomina.totalEmbargos],
        },
      });
    }
  }

  // ── Hoja: Choferes (liquidación por viajes) ──────────────────────────────
  if (canChoferes) {
    const data = await getSueldosResumenAction(month);
    if (data.length > 0) {
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
        r.chofer, r.viajes, r.km_con_carga, r.km_vacios, r.km_total,
        Number(r.tonelaje.toFixed(2)), r.sur, r.pozo,
      ]);
      const sum = (k: keyof SueldoChoferRow) => data.reduce((s, r) => s + (Number(r[k]) || 0), 0);
      const totals: CellValue[] = [
        "TOTALES", sum("viajes"), sum("km_con_carga"), sum("km_vacios"), sum("km_total"),
        Number(sum("tonelaje").toFixed(2)), sum("sur"), sum("pozo"),
      ];
      sheets.push({
        name: "Choferes",
        opts: { title: "Liquidación de choferes (por viajes)", subtitle: periodo, columns, rows, totals },
      });
    }
  }

  // ── Hojas: Admin y taller (planilla) + Aumentos (matriz) ─────────────────
  if (canAdmin) {
    const admin = await getSueldosAdminResumenAction(month);

    // Planilla del mes.
    const columns: ProColumn[] = [
      { header: "Empleado", width: 26, align: "l" },
      { header: "Sector", width: 15, align: "l" },
      { header: "Sueldo base", width: 15, align: "r", numFmt: MONEY },
      { header: "Comisión logística", width: 16, align: "r", numFmt: MONEY },
      { header: "Combustible", width: 14, align: "r", numFmt: MONEY },
      { header: "Plus YPF", width: 12, align: "r", numFmt: MONEY },
      { header: "Sábados", width: 12, align: "r", numFmt: MONEY },
      { header: "Aguinaldo", width: 13, align: "r", numFmt: MONEY },
      { header: "Total", width: 15, align: "r", numFmt: MONEY },
    ];
    const rows: CellValue[][] = admin.empleados.map((e) => [
      e.nombre,
      e.rol === "administrativo" ? "Administración" : "Taller",
      e.sueldoBase, e.comisionLogistica, e.combustible, e.plusYpf, e.sabados, e.aguinaldo, e.total,
    ]);
    const sumBy = (f: (e: SueldoAdminEmpleado) => number) => admin.empleados.reduce((s, e) => s + f(e), 0);
    const totals: CellValue[] = [
      "TOTALES", "",
      sumBy((e) => e.sueldoBase), sumBy((e) => e.comisionLogistica), sumBy((e) => e.combustible),
      sumBy((e) => e.plusYpf), sumBy((e) => e.sabados), sumBy((e) => e.aguinaldo), admin.totalGeneral,
    ];
    const pctTxt = admin.porcentaje != null ? ` · ${admin.porcentaje.toFixed(1)}% de la facturación` : "";
    sheets.push({
      name: "Admin y taller",
      opts: {
        title: "Sueldos de administración y taller",
        subtitle: `${periodo} · Total ${money(admin.totalGeneral)} · Facturación ${money(admin.facturacionEfectiva)}${pctTxt}`,
        columns, rows, totals,
      },
    });

    // Aumentos: matriz empleado × mes (base vigente), como la hoja del Excel.
    const mesesSet = new Set<string>();
    for (const arr of Object.values(admin.aumentosPorEmpleado)) {
      for (const a of arr) mesesSet.add(a.vigente_desde.slice(0, 10));
    }
    const mesesArr = [...mesesSet].sort();
    if (mesesArr.length > 0) {
      const aumColumns: ProColumn[] = [
        { header: "Empleado", width: 26, align: "l" },
        ...mesesArr.map((m): ProColumn => ({ header: mesAnio(m), width: 13, align: "r", numFmt: MONEY })),
      ];
      const baseEn = (arr: { vigente_desde: string; sueldo_base: number }[], mesIso: string): number | null => {
        const a = (arr ?? []).find((x) => x.vigente_desde.slice(0, 10) <= mesIso); // viene desc
        return a ? a.sueldo_base : null;
      };
      const aumRows: CellValue[][] = admin.empleados.map((e) => {
        const arr = admin.aumentosPorEmpleado[e.chofer_id] ?? [];
        return [e.nombre, ...mesesArr.map((m) => baseEn(arr, m))];
      });
      sheets.push({
        name: "Aumentos",
        opts: {
          title: "Aumentos de sueldo — base vigente mes a mes",
          subtitle: "Como la hoja de aumentos del Excel (el año va en el encabezado de cada columna)",
          columns: aumColumns, rows: aumRows,
        },
      });
    }
  }

  if (sheets.length === 0) {
    return NextResponse.json({ error: "No hay datos de sueldos para exportar en este período." }, { status: 404 });
  }

  const buf = await buildMultiSheetWorkbook(sheets);
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
