/**
 * Carga fecha_ingreso, fecha_nacimiento y domicilio para los choferes
 * desde los Excels que mandó Bárbara (mayo 2026):
 *   - ANTIGUEDAD Y EDAD PROMEDIO.xlsx  → ingreso + nacimiento
 *   - DATOS RELEVAMIENTO DE DIRECCIONES.xlsx → domicilio
 *
 * También crea los choferes nuevos que aparecen en los Excels pero no
 * estaban en PATENTES MODELOS TN.xlsx:
 *   - Gomez Ricardo
 *   - Arcuby Lucas
 *   - Cardarelli Facundo
 *
 * Uso:
 *   npx tsx --env-file=.env scripts/seed-fechas-direcciones.ts --dry-run
 *   npx tsx --env-file=.env scripts/seed-fechas-direcciones.ts
 */
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

function toISODate(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number") {
    const d = XLSX.SSF.parse_date_code(value);
    if (!d) return null;
    const mm = String(d.m).padStart(2, "0");
    const dd = String(d.d).padStart(2, "0");
    return `${d.y}-${mm}-${dd}`;
  }
  if (typeof value === "string") {
    const t = value.trim();
    if (!t) return null;
    const d = new Date(t);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return null;
}

/**
 * Mapping de strings raw de los Excels (normalizados) → key canónico (apellido)
 * para resolver typos y nombres invertidos.
 */
const NAME_FIXES: Record<string, string> = {
  // Typos
  "scwhindt": "schwindt",
  "pitanna eugenio": "pittana eugenio",
  "pitana maxi": "pittana maximiliano",
  "eugenio pitta": "pittana eugenio",
  "guilfor": "guilford pablo",
  // Nombre/apellido invertidos
  "gustavo bermay": "bermay gustavo",
  "sebastian godoy": "godoy sebastian",
  // Garmendia ambigüedad: en Antig dice "Garmendia DAMIAN" pero en DB es "Andrés Damián"
  "garmendia damian": "garmendia andres damian",
  "garmendia andres": "garmendia andres damian",
};

function fixName(raw: string): string {
  const n = normalize(raw);
  return NAME_FIXES[n] ?? n;
}

type ChoferDB = {
  id: string;
  apellido: string;
  nombre: string;
  fecha_ingreso: string | null;
  fecha_nacimiento: string | null;
  domicilio: string | null;
};

async function fetchChoferes(): Promise<ChoferDB[]> {
  const { data, error } = await supabase
    .from("choferes")
    .select("id, apellido, nombre, fecha_ingreso, fecha_nacimiento, domicilio")
    .neq("estado", "baja");
  if (error) throw error;
  return data ?? [];
}

function readSheet(file: string, sheet: string, headerRow = 0): Record<string, unknown>[] {
  const wb = XLSX.readFile(path.join(__dirname, "data", file));
  const ws = wb.Sheets[sheet];
  if (!ws) throw new Error(`No existe sheet "${sheet}" en ${file}`);
  return XLSX.utils.sheet_to_json(ws, { range: headerRow, defval: null });
}

type Excel = {
  rawAfterFix: string;
  rawOriginal: string;
  apellidoKey: string;
  fecha_ingreso?: string | null;
  fecha_nacimiento?: string | null;
  domicilio?: string | null;
};

function buildExcelRows(): Excel[] {
  const byFixed = new Map<string, Excel>();
  const upsert = (raw: string, patch: Partial<Excel>) => {
    const fixed = fixName(raw);
    const key = firstToken(fixed);
    const existing = byFixed.get(fixed) ?? {
      rawAfterFix: fixed,
      rawOriginal: raw,
      apellidoKey: key,
    };
    Object.assign(existing, patch);
    byFixed.set(fixed, existing);
  };

  for (const row of readSheet("antiguedad-edad.xlsx", "ANTIGUEDAD PROMEDIO")) {
    const nombre = String(row["CHOFER"] ?? "").trim();
    if (!nombre || normalize(nombre) === "promedio") continue;
    const ing = toISODate(row["INGRESO"]);
    upsert(nombre, { fecha_ingreso: ing });
  }

  for (const row of readSheet("antiguedad-edad.xlsx", "Hoja2")) {
    const nombre = String(row["CHOFERES"] ?? "").trim();
    if (!nombre || /promedio/i.test(nombre)) continue;
    const nac = toISODate(row["FECHA NACIMIENTO"]);
    upsert(nombre, { fecha_nacimiento: nac });
  }

  for (const row of readSheet("direcciones.xlsx", "DIRECCIONES ACTUALES")) {
    const nombre = String(row["NOMBRE"] ?? "").trim();
    if (!nombre) continue;
    const dom = String(row["DOMICILIO AL DIA DE LA FECHA"] ?? "").trim() || null;
    upsert(nombre, { domicilio: dom });
  }

  return Array.from(byFixed.values());
}

/**
 * Choferes que están en los Excels pero no en PATENTES MODELOS TN.xlsx
 * (decisión del usuario: cargarlos).
 */
const CHOFERES_NUEVOS: Array<{
  apellido: string;
  nombre: string;
  fecha_ingreso?: string;
  fecha_nacimiento?: string;
  domicilio?: string;
  localidad?: string;
}> = [
  {
    apellido: "Gomez",
    nombre: "Ricardo",
    fecha_ingreso: "2025-08-04",
    fecha_nacimiento: "1986-01-19",
    domicilio: "AVELLANEDA 1338 ENTRE SANTA MARIA Y SAN MARTIN DEP N2 COLONIA HINOJO",
    localidad: "Colonia Hinojo",
  },
];
// Nota: Arcuby Lucas, Cardarelli Facundo, Pittana Carlos y Pittana Jorge aparecen
// solo en el Excel de direcciones pero no en Hoja2 (nacimiento), no tienen patente,
// licencia ni manual. No son choferes activos.

async function ensureChoferesNuevos(choferes: ChoferDB[]): Promise<ChoferDB[]> {
  // Match por (apellido + primer nombre) normalizado para no chocar con,
  // por ejemplo, Pittana Eugenio cuando se quiere insertar Pittana Carlos.
  const existing = new Set(
    choferes.map((c) => `${firstToken(c.apellido)}::${firstToken(c.nombre)}`)
  );
  const toInsert = CHOFERES_NUEVOS.filter(
    (c) => !existing.has(`${firstToken(c.apellido)}::${firstToken(c.nombre)}`)
  );

  if (toInsert.length === 0) {
    console.log("Choferes nuevos: ya existen los 3 en DB, nada que insertar.");
    return choferes;
  }

  console.log(`\n========== CHOFERES NUEVOS ==========`);
  console.log(`A insertar: ${toInsert.length}`);
  for (const c of toInsert) console.log(`  + ${c.apellido}, ${c.nombre} (${c.localidad ?? "?"})`);

  if (DRY_RUN) {
    console.log("(dry-run: no se insertan)\n");
    return choferes;
  }

  const inserted: ChoferDB[] = [];
  for (const c of toInsert) {
    const payload = {
      apellido: c.apellido,
      nombre: c.nombre,
      estado: "activo",
      fecha_ingreso: c.fecha_ingreso ?? null,
      fecha_nacimiento: c.fecha_nacimiento ?? null,
      domicilio: c.domicilio ?? null,
      localidad: c.localidad ?? null,
    };
    const { data, error } = await supabase.from("choferes").insert(payload).select("id, apellido, nombre, fecha_ingreso, fecha_nacimiento, domicilio").single();
    if (error) {
      console.error(`  ✗ ${c.apellido}: ${error.message}`);
    } else {
      console.log(`  ✓ ${c.apellido}, ${c.nombre} insertado (${data.id})`);
      inserted.push(data as ChoferDB);
    }
  }
  return [...choferes, ...inserted];
}

async function main() {
  console.log(`Modo: ${DRY_RUN ? "DRY-RUN (no escribe)" : "WRITE"}\n`);
  let choferes = await fetchChoferes();
  console.log(`Choferes activos en DB: ${choferes.length}`);

  // 1) Insertar choferes nuevos
  choferes = await ensureChoferesNuevos(choferes);

  // 2) Build excel rows con fixes
  const excelRows = buildExcelRows();
  console.log(`\nFilas únicas en los Excels (post-fixes): ${excelRows.length}`);

  // Index DB por primera palabra del apellido
  const dbByKey = new Map<string, ChoferDB[]>();
  for (const c of choferes) {
    const k = firstToken(c.apellido);
    const arr = dbByKey.get(k) ?? [];
    arr.push(c);
    dbByKey.set(k, arr);
  }

  const updates: { id: string; apellido: string; nombre: string; payload: Record<string, string> }[] = [];
  const ambiguous: { raw: string; candidates: string[] }[] = [];
  const unmatched: string[] = [];
  const conflicts: { raw: string; field: string; db: string; excel: string }[] = [];

  for (const ex of excelRows) {
    const cands = dbByKey.get(ex.apellidoKey) ?? [];
    let chofer: ChoferDB | null = null;

    if (cands.length === 1) {
      chofer = cands[0];
    } else if (cands.length > 1) {
      // Desambiguar por primer nombre. Si en el Excel viene solo la inicial
      // (FERNANDEZ J, FERNANDEZ F), matcheamos por inicial del nombre del candidato.
      const exTokens = normalize(ex.rawAfterFix).split(" ").slice(1);
      const exFirstName = exTokens[0] ?? "";
      let match: ChoferDB | undefined;
      if (exFirstName.length === 1) {
        match = cands.find((c) => normalize(c.nombre).split(" ").some((t) => t.startsWith(exFirstName)));
      } else if (exFirstName.length >= 3) {
        match = cands.find((c) => normalize(c.nombre).split(" ").some((t) => t.startsWith(exFirstName)));
      }
      if (match) chofer = match;
      else {
        ambiguous.push({
          raw: `${ex.rawOriginal} (fixed: ${ex.rawAfterFix})`,
          candidates: cands.map((c) => `${c.apellido} ${c.nombre}`),
        });
        continue;
      }
    } else {
      unmatched.push(`${ex.rawOriginal} (fixed: ${ex.rawAfterFix})`);
      continue;
    }

    const payload: Record<string, string> = {};
    const fields: Array<["fecha_ingreso" | "fecha_nacimiento" | "domicilio", string | null | undefined]> = [
      ["fecha_ingreso", ex.fecha_ingreso],
      ["fecha_nacimiento", ex.fecha_nacimiento],
      ["domicilio", ex.domicilio],
    ];
    for (const [field, value] of fields) {
      if (!value) continue;
      const current = chofer[field];
      if (!current) {
        payload[field] = value;
      } else if (current !== value) {
        conflicts.push({ raw: `${chofer.apellido} ${chofer.nombre}`, field, db: current, excel: value });
      }
    }

    if (Object.keys(payload).length > 0) {
      updates.push({ id: chofer.id, apellido: chofer.apellido, nombre: chofer.nombre, payload });
    }
  }

  console.log("\n========== PLAN ==========");
  console.log(`A actualizar: ${updates.length} choferes`);
  console.log(`Sin match en DB: ${unmatched.length}`);
  console.log(`Ambiguos: ${ambiguous.length}`);
  console.log(`Conflictos (valor distinto, NO se pisa): ${conflicts.length}`);

  if (updates.length) {
    console.log("\n-- Updates --");
    for (const u of updates) {
      const fields = Object.keys(u.payload).join(", ");
      console.log(`  ${u.apellido}, ${u.nombre}: [${fields}]`);
    }
  }
  if (unmatched.length) {
    console.log("\n-- Sin match en DB --");
    unmatched.forEach((n) => console.log("  • " + n));
  }
  if (ambiguous.length) {
    console.log("\n-- Ambiguos --");
    ambiguous.forEach((a) => console.log(`  • ${a.raw} → [${a.candidates.join(" | ")}]`));
  }
  if (conflicts.length) {
    console.log("\n-- Conflictos --");
    conflicts.forEach((c) => console.log(`  • ${c.raw} [${c.field}] db="${c.db}" excel="${c.excel}"`));
  }

  if (DRY_RUN) {
    console.log("\nDry-run terminado. Corré sin --dry-run para escribir.");
    return;
  }

  let ok = 0;
  let fail = 0;
  for (const u of updates) {
    const { error } = await supabase.from("choferes").update(u.payload).eq("id", u.id);
    if (error) {
      fail++;
      console.error(`✗ ${u.apellido} ${u.nombre}: ${error.message}`);
    } else {
      ok++;
    }
  }
  console.log(`\nResultado: ${ok} OK, ${fail} fallidos`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
