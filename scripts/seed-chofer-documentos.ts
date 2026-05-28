import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DRY_RUN = process.argv.includes("--dry-run");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// Helper para normalizar cadenas
function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[,.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstToken(s: string): string {
  return normalize(s).split(" ")[0] ?? "";
}

// Mapeo de nombres con errores o variaciones
const NAME_FIXES: Record<string, string> = {
  "scwhindt": "schwindt",
  "pitanna eugenio": "pittana eugenio",
  "pitana maxi": "pittana maximiliano",
  "eugenio pitta": "pittana eugenio",
  "guilfor": "guilford pablo",
  "gustavo bermay": "bermay gustavo",
  "sebastian godoy": "godoy sebastian",
  "garmendia damian": "garmendia andres damian",
  "garmendia andres": "garmendia andres damian",
};

function fixName(raw: string): string {
  const n = normalize(raw);
  return NAME_FIXES[n] ?? n;
}

// Parser de fecha
function cleanAndParseDate(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    const mm = String(d.m).padStart(2, "0");
    const dd = String(d.d).padStart(2, "0");
    return `${d.y}-${mm}-${dd}`;
  }
  if (typeof v === "string") {
    let t = v.trim();
    t = t.replace(/venc/i, "").trim();
    if (!t) return null;
    const lower = t.toLowerCase();
    if (lower === "1º vez" || lower === "1 vez" || lower === "1o vez" || lower === "1° vez") {
      return null;
    }
    // Formato tipo "1/6/2025" o "13/4/2023"
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

function normCuil(v: unknown): string | null {
  if (v == null) return null;
  const d = String(v).replace(/\D/g, "");
  return d.length === 11 ? d : null;
}

type ChoferDB = {
  id: string;
  apellido: string;
  nombre: string;
  cuil: string | null;
  dni: string | null;
  estado: string;
};

// Carga de la lista de choferes en la DB
async function fetchChoferes(): Promise<ChoferDB[]> {
  const { data, error } = await supabase
    .from("choferes")
    .select("id, apellido, nombre, cuil, dni, estado");
  if (error) throw error;
  return data ?? [];
}

// Lectura de Excel
function readSheet(file: string, sheet: string, headerRow = 0): Record<string, any>[] {
  const wb = XLSX.readFile(path.join(__dirname, "data", file));
  const ws = wb.Sheets[sheet];
  if (!ws) throw new Error(`No existe sheet "${sheet}" en ${file}`);
  return XLSX.utils.sheet_to_json(ws, { range: headerRow, defval: null });
}

// Asegurar la existencia de tipos de documento
async function ensureDocumentTypes() {
  const typesToEnsure = [
    { codigo: "licencia", nombre: "Licencia de conducir", aplica_a: "chofer", estado: "activo" },
    { codigo: "psicofisico", nombre: "Examen psicofísico", aplica_a: "chofer", estado: "activo" },
    { codigo: "curso_peligrosas", nombre: "Curso Cargas Peligrosas", aplica_a: "chofer", estado: "activo" },
    { codigo: "curso_generales", nombre: "Curso Cargas Generales", aplica_a: "chofer", estado: "activo" },
    { codigo: "manual_induccion", nombre: "Manual de Inducción", aplica_a: "chofer", estado: "activo" },
  ];

  console.log("Verificando tipos de documento...");
  const typeMap = new Map<string, string>(); // codigo -> id

  for (const t of typesToEnsure) {
    const { data: existente } = await supabase
      .from("tipos_documento")
      .select("id")
      .eq("codigo", t.codigo)
      .maybeSingle();

    if (existente) {
      typeMap.set(t.codigo, existente.id);
      console.log(`  ✓ Tipo "${t.nombre}" ya existe (${existente.id})`);
    } else {
      if (DRY_RUN) {
        console.log(`  + [DRY-RUN] Crearía tipo "${t.nombre}"`);
        typeMap.set(t.codigo, `TEMP_ID_${t.codigo}`);
      } else {
        const { data: nuevo, error } = await supabase
          .from("tipos_documento")
          .insert(t)
          .select("id")
          .single();
        if (error || !nuevo) {
          throw new Error(`Error al crear tipo de documento ${t.nombre}: ${error?.message}`);
        }
        typeMap.set(t.codigo, nuevo.id);
        console.log(`  ✓ Tipo "${t.nombre}" creado con éxito (${nuevo.id})`);
      }
    }
  }

  return typeMap;
}

// Algoritmo de emparejamiento de choferes
function findDriver(
  rawName: string,
  cuil: string | null,
  dbDrivers: ChoferDB[],
  cuilToDriverMap: Map<string, ChoferDB>
): ChoferDB | null {
  // 1. Intento por CUIL
  if (cuil) {
    const nC = normCuil(cuil);
    if (nC && cuilToDriverMap.has(nC)) {
      return cuilToDriverMap.get(nC) || null;
    }
  }

  // 2. Intento por Apellido / Nombre normalizado
  const normName = normalize(rawName);
  if (!normName) return null;

  const tokens = normName.split(" ");
  const lastNameToken = tokens[0];
  const nextTokens = tokens.slice(1);

  // Candidatos que coincidan en apellido
  let candidates = dbDrivers.filter((d) => {
    const dbAp = normalize(d.apellido);
    return dbAp === lastNameToken || dbAp.startsWith(lastNameToken + " ");
  });

  if (candidates.length === 1) {
    return candidates[0];
  }

  if (candidates.length > 1 && nextTokens.length > 0) {
    const exFirstNom = nextTokens[0] ?? "";
    // Prioridad 1: Match con la primera palabra del nombre en DB
    let match = candidates.find((c) => {
      const dbNom = normalize(c.nombre);
      const dbNomTokens = dbNom.split(" ");
      const dbFirstNom = dbNomTokens[0] ?? "";
      return dbFirstNom.startsWith(exFirstNom) || exFirstNom.startsWith(dbFirstNom);
    });
    if (match) return match;

    // Prioridad 2: Match con cualquier palabra del nombre en DB (ej: segundo nombre/apodo)
    match = candidates.find((c) => {
      const dbNom = normalize(c.nombre);
      const dbNomTokens = dbNom.split(" ");
      return dbNomTokens.some((tok) => tok.startsWith(exFirstNom) || exFirstNom.startsWith(tok));
    });
    if (match) return match;
  }

  // 3. Intento con NAME_FIXES
  const fixed = fixName(rawName);
  const fixedTokens = fixed.split(" ");
  const fixedLast = fixedTokens[0];
  candidates = dbDrivers.filter((d) => {
    const dbAp = normalize(d.apellido);
    return dbAp === fixedLast || dbAp.startsWith(fixedLast + " ");
  });
  if (candidates.length === 1) {
    return candidates[0];
  }

  return null;
}

interface DocImport {
  chofer_id: string;
  tipo_documento_id: string;
  tipo_codigo: string;
  fecha_vencimiento: string;
  numero: string | null;
  observaciones: string | null;
}

async function main() {
  console.log(`Modo: ${DRY_RUN ? "DRY-RUN (Vista Previa)" : "WRITE (Escritura Real)"}\n`);

  const dbDrivers = await fetchChoferes();
  console.log(`Choferes cargados desde DB: ${dbDrivers.length}`);

  const cuilToDriverMap = new Map<string, ChoferDB>();
  for (const d of dbDrivers) {
    const c = normCuil(d.cuil);
    if (c) cuilToDriverMap.set(c, d);
  }

  const typeMap = await ensureDocumentTypes();

  // Acumularemos los documentos mapeados para cada chofer
  // driverId -> Map<tipo_codigo, DocImport>
  const resolvedDocs = new Map<string, Map<string, DocImport>>();

  const addDoc = (chofer: ChoferDB, typeCode: string, fechaStr: string | null, rawValue: any) => {
    const parsedDate = cleanAndParseDate(fechaStr);
    const docTypeId = typeMap.get(typeCode);
    if (!docTypeId) return;

    // Si tiene un valor pero no se pudo parsear a fecha válida
    let observaciones: string | null = null;
    let fecha_vencimiento: string | null = parsedDate;

    if (!parsedDate && fechaStr && String(fechaStr).trim()) {
      const trimmed = String(fechaStr).trim();
      if (trimmed.toLowerCase() !== "1º vez" && trimmed.toLowerCase() !== "1 vez") {
        observaciones = `Dato no parseable en Excel: "${trimmed}"`;
      }
    }

    // Si no tenemos fecha válida y tampoco observaciones importantes, no guardamos documento vacío
    if (!fecha_vencimiento && !observaciones) return;

    // Asegurarse de que el mapa exista
    if (!resolvedDocs.has(chofer.id)) {
      resolvedDocs.set(chofer.id, new Map());
    }
    const driverMap = resolvedDocs.get(chofer.id)!;

    // Si ya existe este tipo de documento para el chofer, consolidar
    // (por ejemplo, Licencia está en ambos Excels. Preferimos la fecha más lejana o no-nula)
    const existing = driverMap.get(typeCode);
    const newDoc: DocImport = {
      chofer_id: chofer.id,
      tipo_documento_id: docTypeId,
      tipo_codigo: typeCode,
      fecha_vencimiento: fecha_vencimiento ?? "1970-01-01", // fecha dummy si es solo observación
      numero: null,
      observaciones,
    };

    if (existing) {
      // Comparar fechas y quedarse con la última
      if (fecha_vencimiento && existing.fecha_vencimiento) {
        if (fecha_vencimiento > existing.fecha_vencimiento) {
          driverMap.set(typeCode, newDoc);
        }
      } else if (fecha_vencimiento) {
        driverMap.set(typeCode, newDoc);
      }
    } else {
      driverMap.set(typeCode, newDoc);
    }
  };

  // ---------------------------------------------------------------------------
  // 1. Procesar venc-choferes.xlsx (Licencias)
  // ---------------------------------------------------------------------------
  console.log("\nProcesando venc-choferes.xlsx...");
  const rowsChof = readSheet("venc-choferes.xlsx", "Hoja1", 1);
  let matchedChofExcel = 0;
  let unmatchedChofExcel = 0;

  for (const r of rowsChof) {
    const rawName = r["CHOFER"];
    const rawCuil = r["CUIL"];
    const rawLic = r["LIC"];
    if (!rawName) continue;

    const chofer = findDriver(rawName, rawCuil, dbDrivers, cuilToDriverMap);
    if (chofer) {
      matchedChofExcel++;
      if (rawLic) {
        addDoc(chofer, "licencia", rawLic, rawLic);
      }
    } else {
      unmatchedChofExcel++;
      console.log(`  ⚠ Chofer sin match en DB (venc-choferes): "${rawName}" (CUIL: ${rawCuil})`);
    }
  }
  console.log(`  Resultados venc-choferes: ${matchedChofExcel} coincidentes, ${unmatchedChofExcel} no coincidentes`);

  // ---------------------------------------------------------------------------
  // 2. Procesar venc-manuales.xlsx - Hoja CHOFERES
  // ---------------------------------------------------------------------------
  console.log("\nProcesando venc-manuales.xlsx [Hoja CHOFERES]...");
  const rowsManChof = readSheet("venc-manuales.xlsx", "CHOFERES", 1);
  let matchedManChof = 0;
  let unmatchedManChof = 0;

  for (const r of rowsManChof) {
    const rawName = r["CHOFERES"];
    if (!rawName) continue;

    const chofer = findDriver(rawName, null, dbDrivers, cuilToDriverMap);
    if (chofer) {
      matchedManChof++;
      if (r["VENC C. MUNIC"]) addDoc(chofer, "licencia", r["VENC C. MUNIC"], r["VENC C. MUNIC"]);
    } else {
      unmatchedManChof++;
      console.log(`  ⚠ Chofer sin match en DB (venc-manuales CHOFERES): "${rawName}"`);
    }
  }
  console.log(`  Resultados Hoja CHOFERES: ${matchedManChof} coincidentes, ${unmatchedManChof} no coincidentes`);

  // ---------------------------------------------------------------------------
  // 3. Procesar venc-manuales.xlsx - Hoja MANUALES
  // ---------------------------------------------------------------------------
  console.log("\nProcesando venc-manuales.xlsx [Hoja MANUALES]...");
  const rowsManuales = readSheet("venc-manuales.xlsx", "MANUALES", 0);
  let matchedMan = 0;
  let unmatchedMan = 0;

  for (const r of rowsManuales) {
    const rawName = r["CHOFER "];
    if (!rawName) continue;

    const chofer = findDriver(rawName, null, dbDrivers, cuilToDriverMap);
    if (chofer) {
      matchedMan++;
      if (r["VENC MANUAL"]) addDoc(chofer, "manual_induccion", r["VENC MANUAL"], r["VENC MANUAL"]);
    } else {
      unmatchedMan++;
      console.log(`  ⚠ Chofer sin match en DB (venc-manuales MANUALES): "${rawName}"`);
    }
  }
  console.log(`  Resultados Hoja MANUALES: ${matchedMan} coincidentes, ${unmatchedMan} no coincidentes`);

  // ---------------------------------------------------------------------------
  // 4. Agregar placeholders para choferes activos que no tienen licencia o manual
  // ---------------------------------------------------------------------------
  console.log("\nVerificando documentos faltantes para choferes activos...");
  let placeholdersAgregados = 0;
  for (const d of dbDrivers) {
    if (d.estado !== "activo") continue;

    if (!resolvedDocs.has(d.id)) {
      resolvedDocs.set(d.id, new Map());
    }
    const driverMap = resolvedDocs.get(d.id)!;

    // Licencia de conducir
    if (!driverMap.has("licencia")) {
      const docTypeId = typeMap.get("licencia");
      if (docTypeId) {
        driverMap.set("licencia", {
          chofer_id: d.id,
          tipo_documento_id: docTypeId,
          tipo_codigo: "licencia",
          fecha_vencimiento: "1970-01-01",
          numero: null,
          observaciones: "Pendiente de carga (no figura en planilla Excel)",
        });
        placeholdersAgregados++;
        console.log(`  + Agregando placeholder de Licencia para: ${d.apellido}, ${d.nombre}`);
      }
    }

    // Manual de inducción
    if (!driverMap.has("manual_induccion")) {
      const docTypeId = typeMap.get("manual_induccion");
      if (docTypeId) {
        driverMap.set("manual_induccion", {
          chofer_id: d.id,
          tipo_documento_id: docTypeId,
          tipo_codigo: "manual_induccion",
          fecha_vencimiento: "1970-01-01",
          numero: null,
          observaciones: "Pendiente de carga (no figura en planilla Excel)",
        });
        placeholdersAgregados++;
        console.log(`  + Agregando placeholder de Manual de Inducción para: ${d.apellido}, ${d.nombre}`);
      }
    }
  }
  console.log(`  Total placeholders agregados: ${placeholdersAgregados}`);

  // ---------------------------------------------------------------------------
  // Preparar inserciones en DB
  // ---------------------------------------------------------------------------
  const payloads: any[] = [];
  for (const [choferId, docMap] of resolvedDocs.entries()) {
    const chofer = dbDrivers.find((d) => d.id === choferId)!;
    for (const doc of docMap.values()) {
      const fVenc = doc.fecha_vencimiento === "1970-01-01" ? null : doc.fecha_vencimiento;
      payloads.push({
        chofer_id: doc.chofer_id,
        tipo_documento_id: doc.tipo_documento_id,
        fecha_vencimiento: fVenc,
        observaciones: doc.observaciones,
        numero: null,
      });
    }
  }

  console.log(`\n========== RESUMEN DE CARGA ==========`);
  console.log(`Total documentos a cargar: ${payloads.length}`);
  
  if (DRY_RUN) {
    console.log("\n[DRY-RUN] Ejemplos de payload a insertar (primeros 10):");
    payloads.slice(0, 10).forEach((p) => {
      const ch = dbDrivers.find((d) => d.id === p.chofer_id)!;
      const tc = Object.entries(typeMap).find(([_, id]) => id === p.tipo_documento_id)?.[0] || "desconocido";
      console.log(`  • Chofer: ${ch.apellido}, ${ch.nombre} | Tipo: ${tc} | Vence: ${p.fecha_vencimiento} | Obs: ${p.observaciones}`);
    });
    console.log("\nEjecutá sin --dry-run para aplicar los cambios a la base de datos.");
    return;
  }

  // Carga real en BD
  console.log("\nGuardando en base de datos...");

  // Limpieza inicial de la tabla chofer_documentos
  console.log("Limpiando la tabla chofer_documentos...");
  const { error: deleteError } = await supabase
    .from("chofer_documentos")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (deleteError) {
    console.error("  ✗ Error al limpiar la tabla chofer_documentos:", deleteError.message);
    process.exit(1);
  }
  console.log("  ✓ Tabla limpia.");

  const chunk = 50;
  let insertedCount = 0;

  for (let i = 0; i < payloads.length; i += chunk) {
    const batch = payloads.slice(i, i + chunk);
    const { error } = await supabase.from("chofer_documentos").insert(batch);
    if (error) {
      console.error(`  ✗ Error al insertar lote ${i}:`, error.message);
      process.exit(1);
    }
    insertedCount += batch.length;
  }

  console.log(`\n✓ Se cargaron exitosamente ${insertedCount} documentos de choferes en la base de datos.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
