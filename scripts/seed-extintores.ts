import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DRY_RUN = process.argv.includes("--dry-run");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en las variables de entorno");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// Helper para parsear fechas de Excel (serial number, Date o string)
function cleanAndParseDate(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    try {
      const d = XLSX.SSF.parse_date_code(v);
      if (!d) return null;
      const mm = String(d.m).padStart(2, "0");
      const dd = String(d.d).padStart(2, "0");
      return `${d.y}-${mm}-${dd}`;
    } catch {
      return null;
    }
  }
  if (typeof v === "string") {
    const t = v.trim();
    if (!t) return null;
    // Formato YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
    // Formato DD/MM/YYYY o D/M/YY
    const parts = t.split("/");
    if (parts.length === 3) {
      const d = parts[0].padStart(2, "0");
      const m = parts[1].padStart(2, "0");
      let y = parts[2];
      if (y.length === 2) y = "20" + y;
      return `${y}-${m}-${d}`;
    }
    const d = new Date(t);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return null;
}

// Helper para extraer la patente limpia y observaciones
function parseDominio(raw: string, categoria: string): { dominio: string; observaciones: string | null } {
  const trimmed = raw.trim();
  if (categoria === "chasis" || categoria === "acoplado") {
    // Busca patente: 2-3 letras, espacio/guión opcional, 3 números, espacio/guión opcional, 0-3 letras
    const match = trimmed.toUpperCase().match(/[A-Z]{2,3}\s?-?\s?\d{3}\s?-?\s?[A-Z]{0,3}/);
    if (match) {
      const patenteRaw = match[0];
      const cleanPatente = patenteRaw.replace(/[\s-]/g, "").toUpperCase();
      let rest = trimmed.replace(patenteRaw, "").trim();
      // Limpiar paréntesis residuales
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

async function main() {
  console.log(`Modo: ${DRY_RUN ? "DRY-RUN (Vista Previa)" : "ESCRITURA REAL"}`);

  const excelPath = "D:\\Descargas windows\\VENCIMIENTO_EXTINTORES.xlsx";
  console.log(`Leyendo Excel desde: ${excelPath}`);

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.readFile(excelPath);
  } catch (e: any) {
    console.error(`Error al abrir el archivo Excel: ${e.message}`);
    process.exit(1);
  }

  const sheetName = "VENC EXTINTORES EQUIPOS Y DEMAS";
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    console.error(`No se encontró la hoja "${sheetName}" en el Excel.`);
    process.exit(1);
  }

  // Convertimos a array de arrays (header: 1) para procesar paso a paso
  const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: null });
  console.log(`Filas detectadas en la planilla: ${rows.length}`);

  let currentCategory = "chasis"; // default inicial (el Excel empieza con extintores de camiones)
  const payloads: any[] = [];

  // La fila 0 es "EXTINTORES"
  // La fila 1 es el header: "DOMINIO", "Nº EXTINTOR", "Nº INTERNO", "CAPACIDAD", "VENCIMIENTO"
  for (let i = 2; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    // Filtrar celdas no nulas
    const nonNullCells = row.filter((c) => c !== null && c !== undefined && String(c).trim() !== "");
    if (nonNullCells.length === 0) continue;

    // Si es una fila con una sola celda, es un cambio de sección
    if (nonNullCells.length === 1) {
      const headerVal = String(nonNullCells[0]).trim().toUpperCase();
      if (headerVal === "CHASIS") {
        currentCategory = "chasis";
      } else if (headerVal === "ACOPLADOS" || headerVal === "ACOPLADO") {
        currentCategory = "acoplado";
      } else if (headerVal === "OTROS") {
        currentCategory = "otros";
      } else if (headerVal === "EXTINTORES") {
        currentCategory = "chasis";
      }
      // Omitir esta fila de cabecera en el parseo
      continue;
    }

    // Parsear fila normal
    const rawDominio = row[0] ? String(row[0]).trim() : "";
    const rawNumExtintor = row[1] ? String(row[1]).trim() : "";
    const rawNumInterno = row[2] ? String(row[2]).trim() : "";
    const rawCapacidad = row[3] ? String(row[3]).trim() : "";
    const rawVencimiento = row[4];

    if (!rawDominio && !rawNumExtintor) continue;

    // Clasificar dominio
    const { dominio, observaciones: obsDominio } = parseDominio(rawDominio, currentCategory);
    
    // Normalizar vencimiento
    const fechaVencimiento = cleanAndParseDate(rawVencimiento);

    // Consolidar observaciones
    let observaciones = obsDominio;
    // Si el número de serie dice "ROBADO...", agregar a observaciones
    if (rawNumExtintor.toUpperCase().includes("ROBADO")) {
      observaciones = observaciones ? `${observaciones} | ${rawNumExtintor}` : rawNumExtintor;
    }

    payloads.push({
      dominio,
      n_extintor: rawNumExtintor,
      n_interno: rawNumInterno || null,
      capacidad: rawCapacidad || null,
      fecha_vencimiento: fechaVencimiento,
      categoria: currentCategory,
      observaciones: observaciones || null,
    });
  }

  console.log(`Total extintores parseados: ${payloads.length}`);
  console.log(`  - Chasis: ${payloads.filter((p) => p.categoria === "chasis").length}`);
  console.log(`  - Acoplado: ${payloads.filter((p) => p.categoria === "acoplado").length}`);
  console.log(`  - Otros: ${payloads.filter((p) => p.categoria === "otros").length}`);

  if (DRY_RUN) {
    console.log("\n[DRY-RUN] Ejemplos de extintores parseados (primeros 15):");
    payloads.slice(0, 15).forEach((p, idx) => {
      console.log(`  ${idx + 1}. Cat: ${p.categoria} | Dom: ${p.dominio} | Nº Ext: ${p.n_extintor} | Nº Int: ${p.n_interno} | Cap: ${p.capacidad} | Venc: ${p.fecha_vencimiento} | Obs: ${p.observaciones}`);
    });
    console.log("\nEjecuta sin --dry-run para aplicar los cambios a la base de datos.");
    return;
  }

  // Carga real en la base de datos
  console.log("\nLimpiando la tabla extintores...");
  const { error: deleteError } = await supabase
    .from("extintores")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000"); // borrar todos

  if (deleteError) {
    console.error(`Error al vaciar la tabla extintores: ${deleteError.message}`);
    process.exit(1);
  }
  console.log("Tabla limpia exitosamente.");

  console.log("Cargando nuevos datos en la DB...");
  const chunkSize = 50;
  let insertedCount = 0;

  for (let i = 0; i < payloads.length; i += chunkSize) {
    const chunk = payloads.slice(i, i + chunkSize);
    const { error } = await supabase.from("extintores").insert(chunk);
    if (error) {
      console.error(`Error al insertar lote en la base de datos: ${error.message}`);
      process.exit(1);
    }
    insertedCount += chunk.length;
  }

  console.log(`\n¡Carga exitosa! Se insertaron ${insertedCount} extintores en la base de datos.`);
}

main().catch((e) => {
  console.error("Error inesperado en main:", e);
  process.exit(1);
});
