/**
 * Carga inicial de la flota desde PATENTES MODELOS TN.xlsx:
 *   - camiones        ← columna TRACTOR/CHASIS
 *   - acoplados       ← columna SEMI/ACOP
 *   - camion_acoplados← vínculo N:1 (un acoplado por camión, una asignación abierta)
 *
 * El Excel solo trae marca/modelo/año/km/TN completos en ~11 unidades (las que
 * Bárbara resaltó en amarillo). El resto de los tractores viene solo con patente:
 * para esos se cargan marca/modelo = "Sin datos" y capacidad_tn = 38 (estándar de
 * la flota — todas las unidades con dato muestran TN=38).
 *
 * Cada camión se vincula a su chofer por CUIL (match exacto contra choferes.cuil).
 *
 * Las filas de prueba preexistentes en `camiones` (no presentes en el Excel) se
 * marcan en observaciones con el prefijo "[DEMO]" — no se borran.
 *
 * Idempotente: upsert por patente; los vínculos se omiten si ya hay uno abierto.
 *
 * Uso:
 *   npx tsx --env-file=.env scripts/seed-camiones-acoplados.ts --dry-run
 *   npx tsx --env-file=.env scripts/seed-camiones-acoplados.ts
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
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const CAPACIDAD_TN_DEFAULT = 38; // todas las unidades con dato en el Excel muestran 38
const SIN_DATOS = "Sin datos";

// Patente AR: vieja (ABC123) o Mercosur (AB123CD). Excel sin espacios.
const PAT_RE = /^[A-Z]{2,3}\d{3}[A-Z]{0,2}$/;

function normPat(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim().toUpperCase().replace(/\s+/g, "");
  return PAT_RE.test(s) ? s : null;
}

function normCuil(v: unknown): string | null {
  if (v == null) return null;
  const d = String(v).replace(/\D/g, "");
  return d.length === 11 ? d : null;
}

function cleanMarca(v: unknown): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const up = s.toUpperCase();
  if (up.includes("MERCEDES")) return "Mercedes Benz"; // arregla "MERCEDESZ BENZ"
  if (up.includes("SCANIA")) return "Scania";
  if (up.includes("IVECO")) return "Iveco";
  if (up.includes("VOLVO")) return "Volvo";
  return s
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

type Terc = "interno" | "en_transicion" | "tercerizado";
function inferTercerizacion(marca: string | null): Terc {
  const m = (marca ?? "").toLowerCase();
  if (m.includes("scania")) return "tercerizado";
  if (m.includes("iveco")) return "en_transicion";
  return "interno"; // volvo, mercedes, sin datos
}

function parseInt0(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

function parseAno(v: unknown): number | null {
  const n = parseInt0(v);
  return n != null && n >= 1950 && n <= 2100 ? n : null;
}

type CamionRow = {
  patente: string;
  marca: string;
  modelo: string;
  ano: number | null;
  capacidad_tn: number;
  km_actual: number | null;
  tipo_camion: "tractor" | "chasis_rigido";
  tercerizacion_estado: Terc;
  observaciones: string | null;
  chofer_cuil: string | null;
};

function main() {
  // ── 1) Parsear el Excel ───────────────────────────────────────────────────
  const wb = XLSX.readFile(path.join(__dirname, "data", "patentes-modelos-tn.xlsx"));
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });

  // Columnas (0-indexed): 1=chofer 2=cuil 3=tractor 4=semi 6=localidad 7=marca
  //                       8=fabricacion 10=modelo 11=carga(kg) 12=km 13=tn
  const camiones: CamionRow[] = [];
  const acoplados: { patente: string; observaciones: string | null }[] = [];
  const pairs: { tractor: string; acoplado: string }[] = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0) continue;

    const esTransp = String(r[1] ?? "").trim().toLowerCase() === "transp";
    const col2 = String(r[2] ?? "").trim().toLowerCase(); // cuil | "equipo" | "chasis" | "acop"

    const tractor = normPat(r[3]);
    const acoplado = normPat(r[4]);

    // Camión (tractor o chasis)
    if (tractor) {
      const marca = cleanMarca(r[7]);
      const carga = parseInt0(r[11]);
      const obsParts: string[] = [];
      if (esTransp) obsParts.push("Transporte/equipo extra (sin chofer asignado)");
      if (carga) obsParts.push(`Carga útil: ${carga.toLocaleString("es-AR")} kg`);
      camiones.push({
        patente: tractor,
        marca: marca ?? SIN_DATOS,
        modelo: String(r[10] ?? "").trim() || SIN_DATOS,
        ano: parseAno(r[8]),
        capacidad_tn: parseInt0(r[13]) ?? CAPACIDAD_TN_DEFAULT,
        km_actual: parseInt0(r[12]),
        tipo_camion: col2 === "chasis" ? "chasis_rigido" : "tractor",
        tercerizacion_estado: inferTercerizacion(marca),
        observaciones: obsParts.length ? obsParts.join(" · ") : null,
        chofer_cuil: normCuil(r[2]),
      });
    }

    // Acoplado (semi/acop)
    if (acoplado) {
      acoplados.push({
        patente: acoplado,
        observaciones: !tractor ? "Acoplado sin tractor asignado (Transp)" : null,
      });
    }

    // Vínculo N:1 (la fila tiene tractor + semi)
    if (tractor && acoplado) pairs.push({ tractor, acoplado });
  }

  return { camiones, acoplados, pairs };
}

async function run() {
  console.log(`Modo: ${DRY_RUN ? "DRY-RUN (no escribe)" : "WRITE"}\n`);
  const { camiones, acoplados, pairs } = main();

  // ── 2) Map de choferes por CUIL ────────────────────────────────────────────
  const { data: choferesDb, error: chErr } = await supabase
    .from("choferes")
    .select("id, apellido, nombre, cuil");
  if (chErr) throw chErr;
  const choferByCuil = new Map<string, { id: string; label: string }>();
  for (const c of choferesDb ?? []) {
    const k = normCuil(c.cuil);
    if (k) choferByCuil.set(k, { id: c.id, label: `${c.apellido} ${c.nombre}` });
  }

  // ── 3) Camiones preexistentes → detectar filas demo (no están en el Excel) ─
  const { data: camDbPre, error: camErr } = await supabase
    .from("camiones")
    .select("id, patente, observaciones");
  if (camErr) throw camErr;
  const excelPats = new Set(camiones.map((c) => c.patente));
  const demoRows = (camDbPre ?? []).filter((c) => !excelPats.has(c.patente));

  // ── 4) Reporte / plan ──────────────────────────────────────────────────────
  const conData = camiones.filter((c) => c.marca !== SIN_DATOS).length;
  const conChofer = camiones.filter((c) => c.chofer_cuil && choferByCuil.has(c.chofer_cuil)).length;
  const cuilSinMatch = camiones.filter((c) => c.chofer_cuil && !choferByCuil.has(c.chofer_cuil));
  const acopSueltos = acoplados.filter((a) => a.observaciones);

  console.log("========== PLAN ==========");
  console.log(`Camiones a cargar: ${camiones.length}  (con datos completos: ${conData}, solo patente: ${camiones.length - conData})`);
  console.log(`  · vinculados a chofer por CUIL: ${conChofer}`);
  console.log(`  · CUIL sin match en choferes: ${cuilSinMatch.length}`);
  console.log(`Acoplados a cargar: ${acoplados.length}  (sueltos sin tractor: ${acopSueltos.length})`);
  console.log(`Vínculos camión↔acoplado: ${pairs.length}`);
  console.log(`Filas demo a marcar: ${demoRows.length}  [${demoRows.map((d) => d.patente).join(", ")}]`);

  if (cuilSinMatch.length) {
    console.log("\n-- CUIL sin match (camión queda sin chofer) --");
    cuilSinMatch.forEach((c) => console.log(`  • ${c.patente}  cuil=${c.chofer_cuil}`));
  }
  console.log("\n-- Acoplados sueltos (sin tractor) --");
  acopSueltos.forEach((a) => console.log(`  • ${a.patente}`));

  if (DRY_RUN) {
    console.log("\nDry-run terminado. Corré sin --dry-run para escribir.");
    return;
  }

  // ── 5) Upsert camiones ─────────────────────────────────────────────────────
  const camionPayload = camiones.map((c) => ({
    patente: c.patente,
    marca: c.marca,
    modelo: c.modelo,
    ano: c.ano,
    capacidad_tn: c.capacidad_tn,
    km_actual: c.km_actual,
    tipo_camion: c.tipo_camion,
    tercerizacion_estado: c.tercerizacion_estado,
    observaciones: c.observaciones,
    chofer_actual_id: c.chofer_cuil ? choferByCuil.get(c.chofer_cuil)?.id ?? null : null,
  }));
  const { error: upCamErr } = await supabase
    .from("camiones")
    .upsert(camionPayload, { onConflict: "patente" });
  if (upCamErr) throw new Error(`upsert camiones: ${upCamErr.message}`);
  console.log(`\n✓ Camiones upsert: ${camionPayload.length}`);

  // ── 6) Marcar filas demo ───────────────────────────────────────────────────
  let demoMarcados = 0;
  for (const d of demoRows) {
    const obs = d.observaciones ?? "";
    if (obs.startsWith("[DEMO]")) continue;
    const nuevo = obs ? `[DEMO] ${obs}` : "[DEMO] dato de prueba";
    const { error } = await supabase.from("camiones").update({ observaciones: nuevo }).eq("id", d.id);
    if (error) console.error(`  ✗ demo ${d.patente}: ${error.message}`);
    else demoMarcados++;
  }
  console.log(`✓ Filas demo marcadas: ${demoMarcados}`);

  // ── 7) Upsert acoplados ────────────────────────────────────────────────────
  // dedupe por patente conservando la observación de "suelto" si la hay
  const acopByPat = new Map<string, { patente: string; observaciones: string | null }>();
  for (const a of acoplados) {
    const prev = acopByPat.get(a.patente);
    acopByPat.set(a.patente, { patente: a.patente, observaciones: a.observaciones ?? prev?.observaciones ?? null });
  }
  const acopPayload = Array.from(acopByPat.values());
  const { error: upAcopErr } = await supabase
    .from("acoplados")
    .upsert(acopPayload, { onConflict: "patente" });
  if (upAcopErr) throw new Error(`upsert acoplados: ${upAcopErr.message}`);
  console.log(`✓ Acoplados upsert: ${acopPayload.length}`);

  // ── 8) Vínculos camion_acoplados ───────────────────────────────────────────
  const { data: camAll } = await supabase.from("camiones").select("id, patente");
  const { data: acopAll } = await supabase.from("acoplados").select("id, patente");
  const camIdByPat = new Map((camAll ?? []).map((c) => [c.patente, c.id]));
  const acopIdByPat = new Map((acopAll ?? []).map((a) => [a.patente, a.id]));

  const { data: linksExist } = await supabase.from("camion_acoplados").select("acoplado_id, hasta");
  const acopConLinkAbierto = new Set((linksExist ?? []).filter((l) => l.hasta == null).map((l) => l.acoplado_id));

  const linkPayload: { camion_id: string; acoplado_id: string }[] = [];
  const linkSkipped: string[] = [];
  for (const p of pairs) {
    const camion_id = camIdByPat.get(p.tractor);
    const acoplado_id = acopIdByPat.get(p.acoplado);
    if (!camion_id || !acoplado_id) {
      linkSkipped.push(`${p.tractor}→${p.acoplado} (id faltante)`);
      continue;
    }
    if (acopConLinkAbierto.has(acoplado_id)) continue; // ya tiene vínculo abierto
    acopConLinkAbierto.add(acoplado_id);
    linkPayload.push({ camion_id, acoplado_id });
  }

  if (linkPayload.length) {
    const { error: linkErr } = await supabase.from("camion_acoplados").insert(linkPayload);
    if (linkErr) throw new Error(`insert camion_acoplados: ${linkErr.message}`);
  }
  console.log(`✓ Vínculos creados: ${linkPayload.length}` + (linkSkipped.length ? ` (omitidos: ${linkSkipped.length})` : ""));
  if (linkSkipped.length) linkSkipped.forEach((s) => console.log(`    - ${s}`));

  console.log("\nListo.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
