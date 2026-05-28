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

// Patente AR: vieja (ABC123) o Mercosur (AB123CD). Excel sin espacios.
const PAT_RE = /^[A-Z]{2,3}\d{3}[A-Z]{0,2}$/;

function normPat(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim().toUpperCase().replace(/\s+/g, "");
  return PAT_RE.test(s) ? s : null;
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

type CamionDB = {
  id: string;
  patente: string;
  estado: string;
};

// Carga de la lista de camiones en la DB
async function fetchCamiones(): Promise<CamionDB[]> {
  const { data, error } = await supabase
    .from("camiones")
    .select("id, patente, estado");
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

// Obtener ID del tipo de documento VTV
async function getVtvTypeId(): Promise<string> {
  const { data, error } = await supabase
    .from("tipos_documento")
    .select("id")
    .eq("codigo", "vtv")
    .eq("aplica_a", "camion")
    .maybeSingle();

  if (error) {
    throw new Error(`Error al buscar tipo de documento VTV: ${error.message}`);
  }
  if (!data) {
    throw new Error("No se encontró el tipo de documento VTV (codigo: 'vtv', aplica_a: 'camion') en la base de datos");
  }
  return data.id;
}

interface DocImport {
  camion_id: string;
  tipo_documento_id: string;
  fecha_vencimiento: string | null;
  numero: string | null;
  observaciones: string | null;
}

async function main() {
  console.log(`Modo: ${DRY_RUN ? "DRY-RUN (Vista Previa)" : "WRITE (Escritura Real)"}\n`);

  const dbCamiones = await fetchCamiones();
  console.log(`Camiones cargados desde DB: ${dbCamiones.length}`);

  const vtvTypeId = await getVtvTypeId();
  console.log(`ID del tipo de documento VTV: ${vtvTypeId}`);

  // Mapa de patentes normalizadas a camión de DB
  const patToCamionMap = new Map<string, CamionDB>();
  for (const c of dbCamiones) {
    const pNorm = normPat(c.patente);
    if (pNorm) patToCamionMap.set(pNorm, c);
  }

  // resolvedDocs: camionId -> DocImport
  const resolvedDocs = new Map<string, DocImport>();

  console.log("\nProcesando venc-vtv.xlsx...");
  // Leemos desde la fila 0 y saltamos la fila de cabecera secundaria ("CHASIS ") manualmente
  const rows = readSheet("venc-vtv.xlsx", "Hoja1", 0);
  let matchedExcel = 0;
  let unmatchedExcel = 0;

  for (const r of rows) {
    const rawChasisPat = r["VENC UNIDADES"];
    const rawVtvVenc = r["__EMPTY"];
    
    if (!rawChasisPat) continue;
    if (String(rawChasisPat).trim().toUpperCase() === "CHASIS") continue;
    
    const pNorm = normPat(rawChasisPat);
    if (!pNorm) continue;

    const camion = patToCamionMap.get(pNorm);
    if (camion) {
      matchedExcel++;
      const parsedDate = cleanAndParseDate(rawVtvVenc);
      let observaciones: string | null = null;
      let fecha_vencimiento: string | null = parsedDate;

      if (!parsedDate && rawVtvVenc && String(rawVtvVenc).trim()) {
        observaciones = `Dato no parseable en Excel: "${String(rawVtvVenc).trim()}"`;
      }

      resolvedDocs.set(camion.id, {
        camion_id: camion.id,
        tipo_documento_id: vtvTypeId,
        fecha_vencimiento,
        numero: null,
        observaciones,
      });
    } else {
      unmatchedExcel++;
      console.log(`  ⚠ Camión sin match en DB (venc-vtv): "${rawChasisPat}" (VTV: ${rawVtvVenc})`);
    }
  }
  console.log(`  Resultados venc-vtv: ${matchedExcel} coincidentes, ${unmatchedExcel} no coincidentes`);

  // ---------------------------------------------------------------------------
  // 2. Agregar placeholders para camiones activos que no están en el Excel
  // ---------------------------------------------------------------------------
  console.log("\nVerificando documentos VTV faltantes para camiones activos...");
  let placeholdersAgregados = 0;
  for (const c of dbCamiones) {
    if (c.estado !== "activo") continue;

    if (!resolvedDocs.has(c.id)) {
      resolvedDocs.set(c.id, {
        camion_id: c.id,
        tipo_documento_id: vtvTypeId,
        fecha_vencimiento: null,
        numero: null,
        observaciones: "Pendiente de carga (no figura en planilla Excel)",
      });
      placeholdersAgregados++;
      console.log(`  + Agregando placeholder de VTV para camión: ${c.patente}`);
    }
  }
  console.log(`  Total placeholders agregados: ${placeholdersAgregados}`);

  // ---------------------------------------------------------------------------
  // Preparar inserciones en DB
  // ---------------------------------------------------------------------------
  const payloads = Array.from(resolvedDocs.values());

  console.log(`\n========== RESUMEN DE CARGA ==========`);
  console.log(`Total documentos de VTV a cargar: ${payloads.length}`);

  if (DRY_RUN) {
    console.log("\n[DRY-RUN] Ejemplos de payload a insertar (primeros 10):");
    payloads.slice(0, 10).forEach((p) => {
      const c = dbCamiones.find((cam) => cam.id === p.camion_id)!;
      console.log(`  • Camión: ${c.patente} | Vence: ${p.fecha_vencimiento} | Obs: ${p.observaciones}`);
    });
    console.log("\nEjecutá sin --dry-run para aplicar los cambios a la base de datos.");
    return;
  }

  // Carga real en BD
  console.log("\nGuardando en base de datos...");

  // Limpieza inicial segura (solo registros del tipo_documento VTV)
  console.log("Limpiando registros antiguos de VTV de la tabla camion_documentos...");
  const { error: deleteError } = await supabase
    .from("camion_documentos")
    .delete()
    .eq("tipo_documento_id", vtvTypeId);
  if (deleteError) {
    console.error("  ✗ Error al limpiar la tabla camion_documentos:", deleteError.message);
    process.exit(1);
  }
  console.log("  ✓ Registros de VTV antiguos eliminados.");

  const chunk = 50;
  let insertedCount = 0;

  for (let i = 0; i < payloads.length; i += chunk) {
    const batch = payloads.slice(i, i + chunk);
    const { error } = await supabase.from("camion_documentos").insert(batch);
    if (error) {
      console.error(`  ✗ Error al insertar lote ${i}:`, error.message);
      process.exit(1);
    }
    insertedCount += batch.length;
  }

  console.log(`\n✓ Se cargaron exitosamente ${insertedCount} documentos de VTV de camiones en la base de datos.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
