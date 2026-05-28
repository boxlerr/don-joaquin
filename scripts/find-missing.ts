import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[,.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function searchInExcel(filename: string, sheetName: string, headerRow: number, term: string) {
  const filePath = path.join(__dirname, "data", filename);
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<any[]>(ws, { range: headerRow, defval: null });
  
  const matches: any[] = [];
  for (const r of rows) {
    const values = Object.values(r).map(v => normalize(String(v ?? "")));
    if (values.some(v => v.includes(term))) {
      matches.push(r);
    }
  }
  return matches;
}

async function run() {
  // 1. Obtener todos los choferes activos
  const { data: choferes, error } = await supabase
    .from("choferes")
    .select("id, nombre, apellido, cuil, dni")
    .eq("estado", "activo");

  if (error) {
    console.error("Error al obtener choferes:", error);
    return;
  }

  // 2. Obtener todos los documentos cargados
  const { data: docs, error: dErr } = await supabase
    .from("chofer_documentos")
    .select("chofer_id, tipo_documento_id, tipos_documento(codigo)");

  if (dErr) {
    console.error("Error al obtener documentos:", dErr);
    return;
  }

  const driverDocsMap = new Map<string, string[]>();
  for (const d of docs ?? []) {
    const list = driverDocsMap.get(d.chofer_id) ?? [];
    const code = (d.tipos_documento as any)?.codigo || "";
    if (code) list.push(code);
    driverDocsMap.set(d.chofer_id, list);
  }

  console.log(`=== CHOFERES ACTIVOS CON DOCUMENTOS FALTANTES ===`);
  const missingDrivers: typeof choferes = [];

  for (const c of choferes ?? []) {
    const loaded = driverDocsMap.get(c.id) ?? [];
    const hasLicencia = loaded.includes("licencia");
    const hasManual = loaded.includes("manual_induccion");

    if (!hasLicencia || !hasManual) {
      console.log(`Chofer: ${c.apellido}, ${c.nombre} (CUIL: ${c.cuil}, DNI: ${c.dni})`);
      console.log(`  Documentos cargados: [${loaded.join(", ")}]`);
      missingDrivers.push(c);
      
      // Buscar apellido en los Excels
      const apNorm = normalize(c.apellido);
      const matchesChof = searchInExcel("venc-choferes.xlsx", "Hoja1", 1, apNorm);
      const matchesManC = searchInExcel("venc-manuales.xlsx", "CHOFERES", 1, apNorm);
      const matchesManM = searchInExcel("venc-manuales.xlsx", "MANUALES", 0, apNorm);

      if (matchesChof.length > 0) {
        console.log(`  -> Encontrado en venc-choferes.xlsx:`, JSON.stringify(matchesChof));
      }
      if (matchesManC.length > 0) {
        console.log(`  -> Encontrado en venc-manuales.xlsx [CHOFERES]:`, JSON.stringify(matchesManC));
      }
      if (matchesManM.length > 0) {
        console.log(`  -> Encontrado en venc-manuales.xlsx [MANUALES]:`, JSON.stringify(matchesManM));
      }
      console.log();
    }
  }

  console.log(`Total choferes activos con faltantes: ${missingDrivers.length}`);
}

run().catch(console.error);
