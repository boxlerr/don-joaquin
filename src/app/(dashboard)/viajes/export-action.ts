"use server";

import { requireArea } from "@/lib/auth";
import {
  buildSingleSheetWorkbook,
  type ProColumn,
  type CellValue,
} from "@/lib/excel/professional-sheet";
import { RUTA_VIA_LABELS } from "@/domain/viajes/ruta-via";

// Arma el Excel del listado de viajes con el estilo profesional del sistema y
// lo devuelve en base64 para que el cliente dispare la descarga. Recibe los
// viajes ya filtrados desde la vista (getAllViajesForExportAction).

const MONEY_FMT = '"$" #,##0.00';

// Shape flexible: las filas vienen del select con joins, donde clientes /
// chofer / camion / origen / destino pueden llegar como objeto o como array
// según cómo resuelva PostgREST la relación.
export type ViajeExportRow = {
  id?: string;
  codigo?: string | null;
  fecha_viaje?: string | null;
  km_totales?: number | null;
  km_con_carga?: number | null;
  km_vacios?: number | null;
  tonelaje_real?: number | null;
  toneladas?: number | null;
  estado?: string | null;
  facturado?: boolean | null;
  monto_flete?: number | null;
  monto?: number | null;
  moneda?: string | null;
  observaciones?: string | null;
  notas?: string | null;
  nro_viaje_ypf?: string | null;
  ruta_via?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function primero(valor: unknown): any {
  if (!valor) return null;
  return Array.isArray(valor) ? (valor[0] ?? null) : valor;
}

function nombreChofer(chofer?: unknown): string | null {
  if (typeof chofer === "string") return chofer || null;
  const c = primero(chofer);
  if (!c) return null;
  const partes = [c.apellido, c.nombre].filter(Boolean);
  if (partes.length > 0) return partes.join(", ");
  return c.razon_social || c.nombre || c.name || null;
}

function nombreCliente(cliente?: unknown): string | null {
  if (typeof cliente === "string") return cliente || null;
  const c = primero(cliente);
  if (!c) return null;
  return c.razon_social || c.nombre || c.name || null;
}

function nombreCamion(camion?: unknown): string | null {
  if (typeof camion === "string") return camion || null;
  const c = primero(camion);
  if (!c) return null;
  const partes = [c.patente, c.marca, c.modelo].filter(Boolean);
  if (partes.length > 0) return partes.join(" - ");
  return c.patente || null;
}

function nombrePunto(punto?: unknown): string | null {
  if (typeof punto === "string") return punto || null;
  const p = primero(punto);
  if (!p) return null;
  return p.nombre || p.alias || p.localidad || null;
}

// Origen/destino: primero el punto de ruta joineado; si no hay, el nombre
// suelto que traen algunos imports; y como último recurso lo parseado de las
// observaciones ("Origen: ... | Destino: ...", legado del importador).
function puntoConFallback(
  punto: unknown,
  nombreSuelto: string | undefined,
  observaciones: string | null | undefined,
  etiqueta: "Origen" | "Destino",
): string | null {
  const p = nombrePunto(punto);
  if (p) return p;
  if (nombreSuelto && nombreSuelto !== "—") return nombreSuelto;
  const match = (observaciones || "").match(new RegExp(`${etiqueta}:\\s*([^|]+)`));
  return match ? match[1].trim() : null;
}

// Vía por la que fue el camión (de ella dependen los km). Sin vía la celda queda
// VACÍA en vez de "—": el guion se cuela en los filtros y en el orden de Excel.
function rutaCell(via?: string | null): string | null {
  return (via && RUTA_VIA_LABELS[via]) || null;
}

function textoEstado(estado?: string | null): string | null {
  if (!estado) return null;
  const str = estado.replace(/_/g, " ");
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Notas visibles: las observaciones sin las partes "Origen:"/"Destino:" que ya
// se muestran en sus propias columnas.
function notasLimpias(v: ViajeExportRow): string | null {
  const crudas = v.observaciones ?? v.notas ?? "";
  const limpias = crudas
    .split("|")
    .filter((parte) => !parte.includes("Origen:") && !parte.includes("Destino:"))
    .join(" | ")
    .trim();
  return limpias || null;
}

// Mediodía para esquivar corrimientos de zona horaria al formatear la fecha.
function fechaCell(iso?: string | null): Date | null {
  if (!iso) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(iso)) return new Date(`${iso.slice(0, 10)}T12:00:00`);
  const ts = Date.parse(iso);
  return Number.isNaN(ts) ? null : new Date(ts);
}

function montoCell(monto: unknown): number | null {
  if (monto === null || monto === undefined || monto === "") return null;
  const val = Number(monto);
  return Number.isFinite(val) ? val : null;
}

export async function exportarViajesXlsxAction(
  viajes: ViajeExportRow[],
  filenameBase: string = "viajes",
): Promise<{ filename: string; base64: string }> {
  await requireArea("viajes", "read");

  const columns: ProColumn[] = [
    { header: "ID", width: 14, align: "c" },
    { header: "Fecha", width: 12, align: "c", numFmt: "dd/mm/yyyy" },
    { header: "Cliente", width: 25, align: "l" },
    { header: "Chofer", width: 25, align: "l" },
    { header: "Camión", width: 20, align: "l" },
    { header: "Origen", width: 20, align: "l" },
    { header: "Destino", width: 20, align: "l" },
    // Va pegada al destino porque es un atributo del trayecto: de la vía dependen
    // los km que siguen (Ruta 5 directa vs Ruta 22 por la base).
    { header: "Ruta", width: 10, align: "c" },
    // Igual que la planilla del cliente: km con carga y km vacíos separados.
    { header: "KM", width: 10, align: "c", numFmt: "#,##0" },
    { header: "KM vacíos", width: 10, align: "c", numFmt: "#,##0" },
    { header: "Toneladas", width: 12, align: "c", numFmt: "#,##0.00" },
    { header: "Estado", width: 15, align: "c" },
    { header: "Facturado", width: 12, align: "c" },
    { header: "Monto", width: 18, align: "r", numFmt: MONEY_FMT },
    { header: "Nº YPF", width: 14, align: "c" },
    { header: "Notas", width: 30, align: "l" },
  ];

  const rows: CellValue[][] = viajes.map((v) => [
    v.codigo || v.id || null,
    fechaCell(v.fecha_viaje),
    nombreCliente(v.clientes ?? v.cliente),
    nombreChofer(v.chofer),
    nombreCamion(v.camion),
    puntoConFallback(v.origen, v.origen_nombre, v.observaciones, "Origen"),
    puntoConFallback(v.destino, v.destino_nombre, v.observaciones, "Destino"),
    rutaCell(v.ruta_via),
    Number(v.km_con_carga ?? v.km_totales ?? 0) || 0,
    Number(v.km_vacios ?? 0) || 0,
    Number(v.tonelaje_real || v.toneladas || 0),
    textoEstado(v.estado),
    v.facturado ? "Sí" : "No",
    montoCell(v.monto_flete ?? v.monto),
    v.nro_viaje_ypf ?? null,
    notasLimpias(v),
  ]);

  const hoy = new Date();
  const buf = await buildSingleSheetWorkbook("Viajes", {
    title: "Viajes — Listado",
    subtitle: `${viajes.length} viaje(s) · exportado el ${hoy.toLocaleDateString("es-AR")}`,
    columns,
    rows,
  });

  const base = filenameBase.replace(/\.xlsx$/, "") || "viajes";
  return {
    filename: `${base}_${hoy.toISOString().slice(0, 10)}.xlsx`,
    base64: buf.toString("base64"),
  };
}
