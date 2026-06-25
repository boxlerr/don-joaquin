"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { Database } from "@/types/database";
import * as XLSX from "xlsx";
import { requireArea } from "@/lib/auth";
import {
  normalizeDate,
  formatIsoDate,
  normKey,
} from "@/lib/excel-utils";

type ExtintorInsert = Database["public"]["Tables"]["extintores"]["Insert"];

const EXTINTORES_HEADER_MAP: Record<string, string> = {
  dominio: "dominio",
  patente: "dominio",
  ubicacion: "dominio",
  "ubicacion / dominio": "dominio",
  "n extintor": "n_extintor",
  "nº extintor": "n_extintor",
  "num extintor": "n_extintor",
  "numero extintor": "n_extintor",
  "n interno": "n_interno",
  "nº interno": "n_interno",
  "num interno": "n_interno",
  "numero interno": "n_interno",
  capacidad: "capacidad",
  vencimiento: "fecha_vencimiento",
  "fecha vencimiento": "fecha_vencimiento",
  categoria: "categoria",
  "categoria / ubicacion": "categoria",
  observaciones: "observaciones",
  detalle: "observaciones",
};

// Helper de seed-extintores para extraer patente y observaciones
function parseDominio(raw: string, categoria: string): { dominio: string; observaciones: string | null } {
  const trimmed = raw.trim();
  if (categoria === "chasis" || categoria === "acoplado") {
    const match = trimmed.toUpperCase().match(/[A-Z]{2,3}\s?-?\s?\d{3}\s?-?\s?[A-Z]{0,3}/);
    if (match) {
      const patenteRaw = match[0];
      const cleanPatente = patenteRaw.replace(/[\s-]/g, "").toUpperCase();
      let rest = trimmed.replace(patenteRaw, "").trim();
      if (rest) {
        rest = rest.replace(/^\s*[\(\[-]\s*|\s*[\)\]]\s*$/g, "").trim();
      }
      return {
        dominio: cleanPatente,
        observaciones: rest || null,
      };
    }
  }
  return {
    dominio: trimmed,
    observaciones: null,
  };
}

export type ParsedExtintorImportRow = {
  rowNum: number;
  dominio: string;
  n_extintor: string;
  n_interno: string | null;
  capacidad: string | null;
  fecha_vencimiento: string | null;
  categoria: string;
  observaciones: string | null;
  isValid: boolean;
  errorMsg?: string;
  warningMsg?: string;
};

export async function previewExtintoresImportAction(formData: FormData): Promise<{
  rows?: ParsedExtintorImportRow[];
  summary?: { validas: number; invalidas: number; chasis: number; acoplados: number; otros: number };
  error?: string;
}> {
  await requireArea("flota", "read");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Adjuntá un archivo .xlsx o .csv." };
  }

  const filename = file.name.toUpperCase();
  if (!filename.includes("VENCIMIENTO_EXTINTORES")) {
    return {
      error: "Archivo no reconocido. Solo se permite cargar el archivo: VENCIMIENTO_EXTINTORES.xlsx",
    };
  }

  let rows: unknown[][];
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet) return { error: "El archivo no contiene hojas." };
    rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null });
  } catch {
    return { error: "No se pudo leer el archivo." };
  }

  if (rows.length === 0) return { error: "El archivo no contiene filas." };

  const supabase = createAdminClient();
  const [camionesRes, acopladosRes] = await Promise.all([
    supabase.from("camiones").select("patente"),
    supabase.from("acoplados").select("patente"),
  ]);

  const camionesPatentes = new Set(
    (camionesRes.data || []).map((c) => c.patente.replace(/[\s-]/g, "").toUpperCase())
  );
  const acopladosPatentes = new Set(
    (acopladosRes.data || []).map((a) => a.patente.replace(/[\s-]/g, "").toUpperCase())
  );

  // Intentar detectar si hay una fila de cabeceras en las primeras 10 filas
  let colMap: Record<number, string> = {};
  let headerRowIndex = -1;

  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    const row = rows[r];
    if (!row) continue;
    let matches = 0;
    const tempMap: Record<number, string> = {};
    for (let c = 0; c < row.length; c++) {
      const val = row[c];
      if (val == null) continue;
      const cleanKey = normKey(String(val));
      const target = EXTINTORES_HEADER_MAP[cleanKey];
      if (target) {
        tempMap[c] = target;
        matches++;
      }
    }
    if (matches >= 2) {
      colMap = tempMap;
      headerRowIndex = r;
      break;
    }
  }

  let currentCategory = "chasis";
  const parsedRows: ParsedExtintorImportRow[] = [];
  const startIndex = headerRowIndex !== -1 ? headerRowIndex + 1 : 0;

  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const nonNullCells = row.filter((c) => c !== null && c !== undefined && String(c).trim() !== "");
    if (nonNullCells.length === 0) continue;

    // Fila con un único valor -> Posible cambio de sección
    if (nonNullCells.length === 1) {
      const val = String(nonNullCells[0]).trim().toUpperCase();
      if (val === "CHASIS" || val === "CAMIONES" || val === "CAMION") {
        currentCategory = "chasis";
        continue;
      } else if (val === "ACOPLADOS" || val === "ACOPLADO" || val === "SEMIS") {
        currentCategory = "acoplado";
        continue;
      } else if (val === "OTROS" || val === "OFICINAS" || val === "GALPONES" || val === "EDIFICIOS") {
        currentCategory = "otros";
        continue;
      }
    }

    let dominioRaw = "";
    let nExtintorRaw = "";
    let nInternoRaw = "";
    let capacidadRaw = "";
    let vencimientoRaw: unknown = null;
    let categoriaRaw = "";
    let observacionesRaw = "";

    if (headerRowIndex !== -1) {
      for (const [colIdxStr, target] of Object.entries(colMap)) {
        const colIdx = Number(colIdxStr);
        const val = row[colIdx];
        if (val == null) continue;
        const strVal = String(val).trim();
        if (target === "dominio") dominioRaw = strVal;
        else if (target === "n_extintor") nExtintorRaw = strVal;
        else if (target === "n_interno") nInternoRaw = strVal;
        else if (target === "capacidad") capacidadRaw = strVal;
        else if (target === "fecha_vencimiento") vencimientoRaw = val;
        else if (target === "categoria") categoriaRaw = strVal;
        else if (target === "observaciones") observacionesRaw = strVal;
      }
    } else {
      dominioRaw = row[0] ? String(row[0]).trim() : "";
      nExtintorRaw = row[1] ? String(row[1]).trim() : "";
      nInternoRaw = row[2] ? String(row[2]).trim() : "";
      capacidadRaw = row[3] ? String(row[3]).trim() : "";
      vencimientoRaw = row[4];
      categoriaRaw = row[5] ? String(row[5]).trim() : "";
      observacionesRaw = row[6] ? String(row[6]).trim() : "";
    }

    if (!dominioRaw && !nExtintorRaw) continue;

    // Evitar procesar headers duplicados
    const normDom = normKey(dominioRaw);
    if (normDom === "dominio" || normDom === "patente" || normKey(nExtintorRaw) === "nextintor") {
      continue;
    }

    // Clasificar categoría
    let categoria = currentCategory;
    if (categoriaRaw) {
      const cleanCat = normKey(categoriaRaw);
      if (cleanCat.includes("chasis") || cleanCat.includes("camion") || cleanCat.includes("camión") || cleanCat.includes("tractor")) {
        categoria = "chasis";
      } else if (cleanCat.includes("acoplado") || cleanCat.includes("semi") || cleanCat.includes("batea")) {
        categoria = "acoplado";
      } else if (cleanCat.includes("otro") || cleanCat.includes("oficina") || cleanCat.includes("galpon") || cleanCat.includes("galpón") || cleanCat.includes("edificio") || cleanCat.includes("taller")) {
        categoria = "otros";
      }
    }

    // Auto-detectar categoría por patente si no es explícita
    const cleanPatente = dominioRaw.replace(/[\s-]/g, "").toUpperCase();
    if (!categoriaRaw && headerRowIndex !== -1) {
      if (camionesPatentes.has(cleanPatente)) {
        categoria = "chasis";
      } else if (acopladosPatentes.has(cleanPatente)) {
        categoria = "acoplado";
      }
    }

    // Parsear dominio
    const { dominio, observaciones: obsDominio } = parseDominio(dominioRaw, categoria);

    // Unificar observaciones
    let observaciones = observacionesRaw || null;
    if (obsDominio) {
      observaciones = observaciones ? `${observaciones} | ${obsDominio}` : obsDominio;
    }
    if (nExtintorRaw.toUpperCase().includes("ROBADO")) {
      observaciones = observaciones ? `${observaciones} | ${nExtintorRaw}` : nExtintorRaw;
    }

    // Normalizar vencimiento
    const dateObj = normalizeDate(vencimientoRaw);
    const fechaVencimiento = dateObj ? formatIsoDate(dateObj) : null;

    let warningMsg: string | undefined;
    if (vencimientoRaw && !fechaVencimiento) {
      warningMsg = `Vencimiento no reconocido: "${vencimientoRaw}"`;
    }

    const isValid = !!nExtintorRaw && !!dominio;
    let errorMsg: string | undefined;
    if (!nExtintorRaw) errorMsg = "Falta Nº Extintor";
    else if (!dominio) errorMsg = "Falta Ubicación/Dominio";

    parsedRows.push({
      rowNum: i + 1,
      dominio,
      n_extintor: nExtintorRaw,
      n_interno: nInternoRaw || null,
      capacidad: capacidadRaw || null,
      fecha_vencimiento: fechaVencimiento,
      categoria,
      observaciones,
      isValid,
      errorMsg,
      warningMsg,
    });
  }

  const validas = parsedRows.filter((r) => r.isValid).length;
  const chasis = parsedRows.filter((r) => r.isValid && r.categoria === "chasis").length;
  const acoplados = parsedRows.filter((r) => r.isValid && r.categoria === "acoplado").length;
  const otros = parsedRows.filter((r) => r.isValid && r.categoria === "otros").length;

  return {
    rows: parsedRows,
    summary: {
      validas,
      invalidas: parsedRows.length - validas,
      chasis,
      acoplados,
      otros,
    },
  };
}

export async function confirmExtintoresImportAction(rows: ParsedExtintorImportRow[]): Promise<{
  imported: number;
  updated: number;
  skipped: number;
  errors: { row: number; message: string }[];
}> {
  await requireArea("flota", "write");

  const supabase = createAdminClient();

  // Obtener extintores existentes para hacer un "upsert" lógico por n_extintor
  const { data: existingList } = await supabase
    .from("extintores")
    .select("id, n_extintor");

  const existingMap = new Map<string, string>(); // n_extintor normalizado -> id
  for (const item of existingList || []) {
    const key = (item.n_extintor ?? "").trim().toLowerCase();
    existingMap.set(key, item.id);
  }

  const errors: { row: number; message: string }[] = [];
  let imported = 0;
  let updated = 0;
  let skipped = 0;

  for (const r of rows) {
    if (!r.isValid) {
      skipped++;
      continue;
    }

    const payload: ExtintorInsert = {
      dominio: r.dominio,
      n_extintor: r.n_extintor,
      n_interno: r.n_interno,
      capacidad: r.capacidad,
      fecha_vencimiento: r.fecha_vencimiento,
      categoria: r.categoria,
      observaciones: r.observaciones,
    };

    const key = r.n_extintor.trim().toLowerCase();
    const existingId = existingMap.get(key);

    if (existingId) {
      // Actualizar registro existente
      const { error } = await supabase
        .from("extintores")
        .update(payload)
        .eq("id", existingId);

      if (error) {
        skipped++;
        errors.push({ row: r.rowNum, message: `Error al actualizar: ${error.message}` });
      } else {
        updated++;
      }
    } else {
      // Insertar nuevo registro
      const { error } = await supabase
        .from("extintores")
        .insert(payload);

      if (error) {
        skipped++;
        errors.push({ row: r.rowNum, message: `Error al insertar: ${error.message}` });
      } else {
        imported++;
      }
    }
  }

  revalidatePath("/extintores");
  return { imported, updated, skipped, errors };
}

export async function exportExtintoresAction(): Promise<{
  filename: string;
  base64: string;
}> {
  await requireArea("flota", "read");
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("extintores")
    .select("dominio, n_extintor, n_interno, capacidad, fecha_vencimiento, categoria, observaciones")
    .order("dominio");

  const rows = (data || []).map((e) => ({
    "Ubicación / Dominio": e.dominio,
    "Nº Extintor": e.n_extintor,
    "Nº Interno": e.n_interno || "",
    Capacidad: e.capacidad || "",
    Vencimiento: e.fecha_vencimiento || "",
    "Categoría": e.categoria === "chasis" ? "Chasis" : e.categoria === "acoplado" ? "Acoplado" : "Otros",
    Observaciones: e.observaciones || "",
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Extintores");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const date = new Date().toISOString().slice(0, 10);
  return {
    filename: `extintores-${date}.xlsx`,
    base64: buf.toString("base64"),
  };
}
