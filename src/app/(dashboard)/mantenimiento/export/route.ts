import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasSeccion } from "@/lib/auth";
import {
  getInsumosAction,
  getServiciosAction,
  getRoturasAction,
  getReporteMantenimientoPorUnidadAction,
  getCostoRepuestosPorChoferAction,
  type ServicioRow,
  type RoturaRow,
} from "../actions";
import {
  buildMultiSheetWorkbook,
  type ProColumn,
  type CellValue,
} from "@/lib/excel/professional-sheet";

export const dynamic = "force-dynamic";

// Export de la sección Mantenimiento con el look profesional del sistema
// (hoja de ruta / sueldos). Se puede bajar UNA vista individual con ?only=… o
// TODO junto (sin el parámetro) en un Excel de varias hojas:
//   Insumos · Servicios · Roturas · Reportes por unidad · Costo por chofer.

const MONEY = '"$" #,##0';
type SheetSpec = Parameters<typeof buildMultiSheetWorkbook>[0][number];
type Only = "insumos" | "servicios" | "roturas" | "reportes" | "costo";
const ONLY_VALIDOS: Only[] = ["insumos", "servicios", "roturas", "reportes", "costo"];

// Etiqueta legible de categoría/tipo (replicada acá para no importar el módulo
// cliente AddRoturaDialog dentro de una route de servidor).
const CATEGORIA_LABEL: Record<string, string> = {
  goma: "Goma / cubierta",
  llanta: "Llanta",
  guardabarros: "Guardabarros",
  paragolpes: "Paragolpes / defensa",
  espejo: "Espejo",
  optica: "Óptica / faro",
  parabrisas: "Parabrisas / vidrio",
  carroceria: "Carrocería / chapa",
  electrico: "Eléctrico",
  mecanico: "Mecánico",
};
function categoriaLabel(tipo: string | null | undefined): string {
  if (!tipo) return "—";
  return CATEGORIA_LABEL[tipo] ?? tipo.charAt(0).toUpperCase() + tipo.slice(1);
}
function fechaAR(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return d && m && y ? `${d}/${m}/${y}` : "";
}
function unidadTxt(tipo: "camion" | "acoplado" | null | undefined, patente: string | null | undefined): string {
  if (!patente) return "—";
  const pref = tipo === "camion" ? "Cam" : tipo === "acoplado" ? "Acop" : "";
  return pref ? `${pref} ${patente}` : patente;
}
function servicioLabel(s: ServicioRow): string {
  if (s.tipo_servicio_codigo === "otro" && s.descripcion) return s.descripcion;
  return s.tipo_servicio_nombre ?? s.descripcion;
}
function roturaDetalle(r: RoturaRow): string {
  return [r.marca, r.estado_uso, r.posicion ?? r.observaciones].filter(Boolean).join(" · ");
}

async function hojaInsumos(): Promise<SheetSpec | null> {
  const insumos = await getInsumosAction();
  if (insumos.length === 0) return null;
  const columns: ProColumn[] = [
    { header: "Insumo", width: 28, align: "l" },
    { header: "Categoría", width: 18, align: "l" },
    { header: "Marca", width: 16, align: "l" },
    { header: "Precio", width: 14, align: "r", numFmt: MONEY },
    { header: "Estado", width: 11, align: "c" },
    { header: "Precio actualizado", width: 16, align: "c" },
    { header: "Usos en roturas", width: 14, align: "c", numFmt: "#,##0" },
    { header: "Notas", width: 30, align: "l" },
  ];
  const rows: CellValue[][] = insumos.map((i) => [
    i.nombre,
    categoriaLabel(i.tipo),
    i.marca ?? "",
    i.precio,
    i.estado === "inactivo" ? "Inactivo" : "Activo",
    fechaAR(i.precio_actualizado_en) + (i.precio_desactualizado ? " (desactualizado)" : ""),
    i.usos,
    i.observaciones ?? "",
  ]);
  const totalPrecio = insumos.reduce((s, i) => s + (i.precio || 0), 0);
  const totals: CellValue[] = ["TOTALES", "", "", totalPrecio, "", "", insumos.reduce((s, i) => s + i.usos, 0), ""];
  return { name: "Insumos", opts: { title: "Catálogo de insumos", subtitle: `${insumos.length} insumos · precios de referencia`, columns, rows, totals } };
}

async function hojaServicios(): Promise<SheetSpec | null> {
  const servicios = await getServiciosAction();
  if (servicios.length === 0) return null;
  const columns: ProColumn[] = [
    { header: "Fecha", width: 12, align: "c" },
    { header: "Unidad", width: 14, align: "l" },
    { header: "Marca / modelo", width: 18, align: "l" },
    { header: "Servicio", width: 24, align: "l" },
    { header: "Taller", width: 18, align: "l" },
    { header: "KM", width: 12, align: "r", numFmt: "#,##0" },
    { header: "Costo", width: 14, align: "r", numFmt: MONEY },
  ];
  const rows: CellValue[][] = servicios.map((s) => [
    fechaAR(s.fecha),
    unidadTxt(s.unidad_tipo, s.unidad_patente),
    s.unidad_marca_modelo || "",
    servicioLabel(s),
    s.taller ?? "",
    s.unidad_tipo === "acoplado" ? null : s.km_odometro,
    s.costo,
  ]);
  const totalCosto = servicios.reduce((sum, s) => sum + (s.costo || 0), 0);
  const totals: CellValue[] = ["TOTALES", "", "", `${servicios.length} servicios`, "", "", totalCosto];
  return { name: "Servicios", opts: { title: "Servicios registrados", subtitle: "Histórico de services y reparaciones", columns, rows, totals } };
}

async function hojaRoturas(): Promise<SheetSpec | null> {
  const roturas = await getRoturasAction();
  if (roturas.length === 0) return null;
  const columns: ProColumn[] = [
    { header: "Fecha", width: 12, align: "c" },
    { header: "Chofer", width: 22, align: "l" },
    { header: "Qué rompió", width: 18, align: "l" },
    { header: "Gravedad", width: 11, align: "c" },
    { header: "Unidad", width: 14, align: "l" },
    { header: "Detalle", width: 28, align: "l" },
    { header: "Cantidad", width: 10, align: "c", numFmt: "#,##0" },
    { header: "Costo", width: 14, align: "r", numFmt: MONEY },
  ];
  const rows: CellValue[][] = roturas.map((r) => [
    fechaAR(r.fecha),
    r.chofer_nombre ?? "Sin asignar",
    categoriaLabel(r.tipo),
    r.gravedad === "grave" ? "Grave" : "Leve",
    unidadTxt(r.unidad_tipo, r.unidad_patente),
    roturaDetalle(r),
    r.cantidad,
    r.costo,
  ]);
  const totalCant = roturas.reduce((s, r) => s + (r.cantidad || 0), 0);
  const totalCosto = roturas.reduce((s, r) => s + (r.costo || 0), 0);
  const totals: CellValue[] = ["TOTALES", "", "", "", "", `${roturas.length} eventos`, totalCant, totalCosto];
  return { name: "Roturas", opts: { title: "Roturas registradas", subtitle: "Gomas y otras roturas de la flota", columns, rows, totals } };
}

async function hojaReportes(): Promise<SheetSpec | null> {
  const rep = await getReporteMantenimientoPorUnidadAction();
  if (rep.length === 0) return null;
  const columns: ProColumn[] = [
    { header: "Unidad", width: 14, align: "l" },
    { header: "Marca / modelo", width: 18, align: "l" },
    { header: "Visitas a taller", width: 14, align: "c", numFmt: "#,##0" },
    { header: "Servicios", width: 11, align: "c", numFmt: "#,##0" },
    { header: "Costo total", width: 16, align: "r", numFmt: MONEY },
  ];
  const rows: CellValue[][] = rep.map((u) => [
    unidadTxt(u.unidad_tipo, u.unidad_patente),
    u.unidad_marca_modelo || "",
    u.visitas_taller,
    u.servicios_total,
    u.costo_total,
  ]);
  const totals: CellValue[] = [
    "TOTALES", "",
    rep.reduce((s, u) => s + (u.visitas_taller || 0), 0),
    rep.reduce((s, u) => s + (u.servicios_total || 0), 0),
    rep.reduce((s, u) => s + (u.costo_total || 0), 0),
  ];
  return { name: "Por unidad", opts: { title: "Mantenimiento por unidad", subtitle: "Acumulado de los últimos 6 meses", columns, rows, totals } };
}

async function hojaCosto(): Promise<SheetSpec | null> {
  const costo = await getCostoRepuestosPorChoferAction();
  if (costo.length === 0) return null;
  const columns: ProColumn[] = [
    { header: "Chofer", width: 26, align: "l" },
    { header: "Roturas con costo", width: 16, align: "c", numFmt: "#,##0" },
    { header: "Costo total", width: 16, align: "r", numFmt: MONEY },
  ];
  const rows: CellValue[][] = costo.map((c) => [c.chofer, c.eventos, c.costo_total]);
  const totals: CellValue[] = [
    "TOTALES",
    costo.reduce((s, c) => s + (c.eventos || 0), 0),
    costo.reduce((s, c) => s + (c.costo_total || 0), 0),
  ];
  return { name: "Costo por chofer", opts: { title: "Costo de repuestos por chofer", subtitle: "Roturas con costo — últimos 6 meses", columns, rows, totals } };
}

const HOJAS: Record<Only, () => Promise<SheetSpec | null>> = {
  insumos: hojaInsumos,
  servicios: hojaServicios,
  roturas: hojaRoturas,
  reportes: hojaReportes,
  costo: hojaCosto,
};

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  if (!hasSeccion(user, "mantenimiento_servicios", "read")) {
    return NextResponse.json({ error: "No tenés permiso para exportar mantenimiento." }, { status: 403 });
  }

  const onlyParam = req.nextUrl.searchParams.get("only");
  const only = ONLY_VALIDOS.includes(onlyParam as Only) ? (onlyParam as Only) : null;
  const cuales: Only[] = only ? [only] : ONLY_VALIDOS;

  const hojas = await Promise.all(cuales.map((k) => HOJAS[k]()));
  const sheets = hojas.filter((s): s is SheetSpec => s != null);

  if (sheets.length === 0) {
    return NextResponse.json(
      { error: only ? "No hay datos para exportar en esta vista." : "No hay datos de mantenimiento para exportar." },
      { status: 404 },
    );
  }

  const buf = await buildMultiSheetWorkbook(sheets);
  const filename = `mantenimiento_${only ?? "completo"}.xlsx`;

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
