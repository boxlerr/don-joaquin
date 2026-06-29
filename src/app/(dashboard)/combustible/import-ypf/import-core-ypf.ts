// Lógica de importación del reporte "YPF en ruta" (ReporteConsumos.xlsx).
// SIN "use server": parsea el Excel server-side y matchea contra la flota.
// El reporte trae TODAS las transacciones de la tarjeta YPF; mapeamos solo las
// columnas que le importan a Nico (camión, fecha, litros, odómetro, importe) y
// guardamos remito + producto como referencia. Dedup por remito.

import * as XLSX from "xlsx";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type SB = ReturnType<typeof createAdminClient>;
type CargaInsert = Database["public"]["Tables"]["cargas_combustible"]["Insert"];

const SHEET = "ReporteConsumos";

export type YpfRowParsed = {
  fila: number;
  fechaISO: string | null;
  patente: string; // normalizada (mayúsculas, sin espacios)
  dni: string; // solo dígitos
  conductor: string;
  odometro: number;
  litros: number;
  importe: number;
  remito: string;
  producto: string;
  estacion: string;
};

export type RowEstado = "ok" | "sin_camion" | "duplicado" | "invalido";

export type YpfRowPreview = {
  fila: number;
  fecha: string | null;
  patente: string;
  camion_patente: string | null;
  chofer: string | null;
  producto: string;
  litros: number;
  importe: number;
  estado: RowEstado;
  motivo?: string;
};

export type YpfPreviewData =
  | { error: string }
  | {
      total: number;
      aImportar: number;
      porEstado: Record<RowEstado, number>;
      patentesSinCamion: string[];
      productos: Record<string, number>;
      rango: { desde: string | null; hasta: string | null };
      muestra: YpfRowPreview[]; // primeras filas para revisar
    };

export type YpfConfirmData =
  | { error: string }
  | { ok: true; insertadas: number; duplicadas: number; sinCamion: number; invalidas: number };

// ---------------------------------------------------------------------------

function parseFechaYpf(s: string): string | null {
  const m = String(s).trim().match(
    /^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/,
  );
  if (!m) return null;
  const [, dd, mm, yyyy, hh = "0", mi = "0", ss = "0"] = m;
  return `${yyyy}-${mm}-${dd}T${hh.padStart(2, "0")}:${mi.padStart(2, "0")}:${ss.padStart(2, "0")}`;
}

function toNum(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const raw = String(v ?? "").trim();
  if (!raw) return 0;
  // formato AR: 1.234,56 -> 1234.56
  const n = parseFloat(raw.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function normPat(s: string): string {
  return String(s ?? "").toUpperCase().replace(/\s/g, "");
}

export function parseYpfBuffer(buf: Buffer): YpfRowParsed[] {
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets[SHEET] ?? wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });
  if (rows.length < 2) return [];

  const H = (rows[0] as unknown[]).map((x) => String(x).trim());
  const col = (name: string) => H.indexOf(name);
  const c = {
    fecha: col("FECHA"),
    tipoTarj: col("TIPO IDENTIFICACION TARJETA"),
    tarj: col("IDENTIFICACION TARJETA"),
    dni: col("NRO IDENTIFICACION CONDUCTOR"),
    cond: col("CONDUCTOR"),
    odo: col("ODOMETRO"),
    lit: col("LITROS UNIDADES"),
    impYer: col("IMP TOT YER"),
    impPvp: col("IMP TOT PVP ESTABLECIMIENTO"),
    rem: col("REMITO"),
    prod: col("PRODUCTO"),
    est: col("ESTABLECIMIENTO"),
    loc: col("LOCALIDAD"),
  };

  const out: YpfRowParsed[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] as unknown[];
    if (!r || r.length === 0) continue;
    const fechaRaw = String(r[c.fecha] ?? "").trim();
    if (!fechaRaw) continue;

    const esPatente = String(r[c.tipoTarj] ?? "").toUpperCase().includes("PATENTE");
    const importe = toNum(r[c.impYer]) || toNum(r[c.impPvp]);
    const establecimiento = String(r[c.est] ?? "").replace(/^\d+\s*-\s*/, "").trim();
    const localidad = String(r[c.loc] ?? "").trim();

    out.push({
      fila: i + 1, // 1-based como en Excel
      fechaISO: parseFechaYpf(fechaRaw),
      patente: esPatente ? normPat(String(r[c.tarj] ?? "")) : "",
      dni: String(r[c.dni] ?? "").replace(/\D/g, ""),
      conductor: String(r[c.cond] ?? "").trim().replace(/\s+/g, " "),
      odometro: Math.max(0, Math.round(toNum(r[c.odo]))),
      litros: toNum(r[c.lit]),
      importe,
      remito: String(r[c.rem] ?? "").trim(),
      producto: String(r[c.prod] ?? "").trim(),
      estacion: [establecimiento, localidad].filter(Boolean).join(" - "),
    });
  }
  return out;
}

type Lookups = {
  camionByPat: Map<string, { id: string; patente: string }>;
  choferByDni: Map<string, { id: string; nombre: string; apellido: string }>;
  remitosExistentes: Set<string>;
};

async function buildLookups(sb: SB, parsed: YpfRowParsed[]): Promise<Lookups> {
  const remitos = [...new Set(parsed.map((p) => p.remito).filter(Boolean))];

  const [camRes, chofRes, remRes] = await Promise.all([
    sb.from("camiones").select("id, patente"),
    sb.from("choferes").select("id, nombre, apellido, dni").neq("estado", "baja"),
    remitos.length
      ? sb.from("cargas_combustible").select("remito").in("remito", remitos)
      : Promise.resolve({ data: [] as { remito: string | null }[] }),
  ]);

  const camionByPat = new Map<string, { id: string; patente: string }>();
  for (const c of camRes.data ?? []) camionByPat.set(normPat(c.patente), { id: c.id, patente: c.patente });

  const choferByDni = new Map<string, { id: string; nombre: string; apellido: string }>();
  for (const c of (chofRes.data ?? []) as { id: string; nombre: string; apellido: string; dni: string | null }[]) {
    const d = (c.dni ?? "").replace(/\D/g, "");
    if (d) choferByDni.set(d, { id: c.id, nombre: c.nombre, apellido: c.apellido });
  }

  const remitosExistentes = new Set<string>();
  for (const r of (remRes.data ?? []) as { remito: string | null }[]) {
    if (r.remito) remitosExistentes.add(r.remito);
  }

  return { camionByPat, choferByDni, remitosExistentes };
}

function clasificar(p: YpfRowParsed, lk: Lookups) {
  const camion = p.patente ? lk.camionByPat.get(p.patente) : undefined;
  const chofer = p.dni ? lk.choferByDni.get(p.dni) : undefined;

  let estado: RowEstado = "ok";
  let motivo: string | undefined;
  if (!p.fechaISO || p.litros <= 0) {
    estado = "invalido";
    motivo = !p.fechaISO ? "fecha inválida" : "litros en 0";
  } else if (!camion) {
    estado = "sin_camion";
    motivo = p.patente ? `patente ${p.patente} no está en la flota` : "sin patente";
  } else if (p.remito && lk.remitosExistentes.has(p.remito)) {
    estado = "duplicado";
    motivo = "remito ya importado";
  }
  return { estado, motivo, camion, chofer };
}

export async function buildYpfPreview(sb: SB, buf: Buffer): Promise<YpfPreviewData> {
  let parsed: YpfRowParsed[];
  try {
    parsed = parseYpfBuffer(buf);
  } catch {
    return { error: "No pude leer el Excel. ¿Es el reporte de consumos de YPF (.xlsx)?" };
  }
  if (parsed.length === 0) {
    return { error: "El Excel no tiene filas de consumo o no tiene el formato esperado." };
  }

  const lk = await buildLookups(sb, parsed);

  const porEstado: Record<RowEstado, number> = { ok: 0, sin_camion: 0, duplicado: 0, invalido: 0 };
  const patentesSinCamion = new Set<string>();
  const productos: Record<string, number> = {};
  const muestra: YpfRowPreview[] = [];
  let desde: string | null = null;
  let hasta: string | null = null;

  for (const p of parsed) {
    const { estado, motivo, camion, chofer } = clasificar(p, lk);
    porEstado[estado]++;
    if (estado === "sin_camion" && p.patente) patentesSinCamion.add(p.patente);
    productos[p.producto || "—"] = (productos[p.producto || "—"] ?? 0) + 1;
    if (p.fechaISO) {
      const d = p.fechaISO.slice(0, 10);
      if (!desde || d < desde) desde = d;
      if (!hasta || d > hasta) hasta = d;
    }
    if (muestra.length < 60) {
      muestra.push({
        fila: p.fila,
        fecha: p.fechaISO ? p.fechaISO.slice(0, 10) : null,
        patente: p.patente,
        camion_patente: camion?.patente ?? null,
        chofer: chofer ? `${chofer.apellido}, ${chofer.nombre}` : null,
        producto: p.producto,
        litros: p.litros,
        importe: p.importe,
        estado,
        motivo,
      });
    }
  }

  return {
    total: parsed.length,
    aImportar: porEstado.ok,
    porEstado,
    patentesSinCamion: [...patentesSinCamion].sort(),
    productos,
    rango: { desde, hasta },
    muestra,
  };
}

export async function runYpfImport(
  sb: SB,
  buf: Buffer,
  userId: string,
): Promise<YpfConfirmData> {
  let parsed: YpfRowParsed[];
  try {
    parsed = parseYpfBuffer(buf);
  } catch {
    return { error: "No pude leer el Excel para confirmar la importación." };
  }
  if (parsed.length === 0) return { error: "El Excel no tiene filas para importar." };

  const lk = await buildLookups(sb, parsed);

  const result = { insertadas: 0, duplicadas: 0, sinCamion: 0, invalidas: 0 };
  const vistosEnArchivo = new Set<string>(); // dedup intra-archivo
  const filas: CargaInsert[] = [];

  for (const p of parsed) {
    const { estado, camion, chofer } = clasificar(p, lk);
    if (estado === "invalido") { result.invalidas++; continue; }
    if (estado === "sin_camion") { result.sinCamion++; continue; }
    if (estado === "duplicado") { result.duplicadas++; continue; }
    if (p.remito && vistosEnArchivo.has(p.remito)) { result.duplicadas++; continue; }
    if (p.remito) vistosEnArchivo.add(p.remito);

    filas.push({
      camion_id: camion!.id,
      chofer_id: chofer?.id ?? null,
      fecha: p.fechaISO!,
      litros: p.litros,
      km_odometro: p.odometro,
      importe_total: p.importe,
      estacion: p.estacion || null,
      lugar_carga: "en_ruta",
      origen: "estacion_servicio",
      moneda: "ARS",
      remito: p.remito || null,
      observaciones: `YPF en ruta · ${p.producto || "Combustible"}${p.conductor ? ` · ${p.conductor}` : ""}`,
      created_by: userId,
    });
  }

  // Insertar en lotes
  const BATCH = 200;
  for (let i = 0; i < filas.length; i += BATCH) {
    const lote = filas.slice(i, i + BATCH);
    const { error } = await sb.from("cargas_combustible").insert(lote);
    if (error) {
      return {
        error: `Se importaron ${result.insertadas} cargas y falló un lote: ${error.message}`,
      };
    }
    result.insertadas += lote.length;
  }

  return { ok: true, ...result };
}
