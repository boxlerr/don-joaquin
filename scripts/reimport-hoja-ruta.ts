/**
 * Reimportación de cero de la HOJA DE RUTA.
 *   1. Backup JSON de los viajes que se van a borrar.
 *   2. Borra TODOS los viajes importados de la hoja de ruta (obs "[Import HOJA DE RUTA")
 *      — los viajes YPF y cualquier otro quedan intactos.
 *   3. Reimporta scripts/data/hoja-de-ruta.xlsx usando el MISMO core que el modal
 *      (matching determinístico + alta automática de choferes faltantes).
 *   4. Valida: cantidad de viajes por sheet Excel == BD.
 *
 * Uso: npx tsx scripts/reimport-hoja-ruta.ts [--dry-run]
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { parseHojaRutaXlsx } from "../src/app/(dashboard)/viajes/import-hoja-ruta/parser-hoja-ruta";
import {
  resolverAsignaciones,
  runHojaRutaImport,
  CREAR_CHOFER,
  type AsignacionSheet,
  type ChoferRow,
} from "../src/app/(dashboard)/viajes/import-hoja-ruta/import-core";

const DRY = process.argv.includes("--dry-run");
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envFile = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
const env: Record<string, string> = {};
for (const line of envFile.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
}) as any;

const OBS_TAG = "%Import HOJA DE RUTA%";

async function fetchAllHrViajes(): Promise<any[]> {
  const all: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from("viajes")
      .select("*")
      .ilike("observaciones", OBS_TAG)
      .order("codigo")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    all.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return all;
}

async function main() {
  const buf = fs.readFileSync(path.join(__dirname, "data", "hoja-de-ruta.xlsx"));
  const parsed = parseHojaRutaXlsx(buf);
  console.log(`Excel: ${parsed.sheets.length} sheets, ${parsed.totalViajes} viajes.`);
  for (const w of parsed.warnings) console.log("  WARN:", w);

  // ----- 1) Backup -----
  const actuales = await fetchAllHrViajes();
  console.log(`\nViajes HR actuales en BD: ${actuales.length}`);
  const backupPath = path.join(__dirname, "data", `backup-viajes-hr-${Date.now()}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(actuales, null, 1));
  console.log(`Backup escrito: ${backupPath}`);

  // created_by: reusar el del import anterior (un usuario real del sistema).
  const userId: string | null = actuales.find((v) => v.created_by)?.created_by ?? null;
  if (!userId) throw new Error("No pude determinar un created_by (no hay viajes HR previos).");

  if (DRY) {
    console.log("\n--dry-run: no se borra ni se importa nada.");
    return;
  }

  // ----- 2) Borrar (en lotes por id) -----
  let borrados = 0;
  for (let i = 0; i < actuales.length; i += 200) {
    const ids = actuales.slice(i, i + 200).map((v) => v.id);
    const { error } = await sb.from("viajes").delete().in("id", ids);
    if (error) throw new Error(`Error borrando lote: ${error.message}`);
    borrados += ids.length;
  }
  console.log(`Borrados: ${borrados} viajes HR (los YPF y demás quedaron intactos).`);

  // ----- 3) Asignaciones determinísticas + alta automática -----
  const { data: choferesRaw } = await sb
    .from("choferes")
    .select("id, apellido, nombre, estado");
  const choferes = (choferesRaw ?? []) as ChoferRow[];
  const matches = resolverAsignaciones(parsed.sheets, choferes);

  const asignaciones: AsignacionSheet[] = [];
  for (const sp of parsed.sheets) {
    const m = matches.get(sp.sheetName)!;
    if (m.status === "ok") {
      asignaciones.push({ sheetName: sp.sheetName, chofer_id: m.id });
    } else if (m.status === "missing") {
      console.log(`  → sheet "${sp.sheetName}": chofer inexistente, se creará automáticamente.`);
      asignaciones.push({ sheetName: sp.sheetName, chofer_id: CREAR_CHOFER });
    } else {
      console.log(`  ⚠ sheet "${sp.sheetName}": AMBIGUO (${m.candidatos.map((c) => c.label).join(" / ")}) — se omite.`);
      asignaciones.push({ sheetName: sp.sheetName, chofer_id: null });
    }
  }

  // ----- 4) Importar con el core real -----
  const result = await runHojaRutaImport(sb, buf, asignaciones, userId, {
    archivo: "hoja-de-ruta.xlsx (reimport script)",
  });
  console.log("\nResultado import:", JSON.stringify(result?.imported ?? result, null, 2));

  // ----- 5) Validación: Excel vs BD por sheet -----
  const nuevos = await fetchAllHrViajes();
  const porSheet = new Map<string, number>();
  for (const v of nuevos) {
    const m = String(v.observaciones).match(/\[Import HOJA DE RUTA · (.+?)\]/);
    const key = m ? m[1] : "(sin sheet)";
    porSheet.set(key, (porSheet.get(key) ?? 0) + 1);
  }
  console.log("\nSHEET                       | EXCEL |  BD | DIF");
  console.log("-".repeat(55));
  let difTotal = 0;
  for (const sp of parsed.sheets) {
    const bd = porSheet.get(sp.sheetName) ?? 0;
    const dif = sp.viajes.length - bd;
    difTotal += Math.abs(dif);
    console.log(
      `${sp.sheetName.trim().padEnd(27)} | ${String(sp.viajes.length).padStart(5)} | ${String(bd).padStart(3)} | ${dif === 0 ? "OK" : String(dif)}`,
    );
  }
  console.log("-".repeat(55));
  console.log(`TOTAL Excel=${parsed.totalViajes} BD=${nuevos.length} | ${difTotal === 0 ? "✔ TODO CONSISTENTE" : `✖ ${difTotal} diferencias`}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
