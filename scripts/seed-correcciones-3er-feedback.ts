/**
 * Correcciones puntuales del 3er feedback (audios Bárbara + Word "60 chofer
 * Gomez Ricardo", 01/06/2026). NO carga masiva: el padrón ya tiene CUIL,
 * teléfono y localidad. Esto solo completa los huecos que faltaban:
 *
 *   - 5 domicilios en null (datos del Word)
 *   - 2 fechas ingreso+nacimiento (Álvarez Héctor, Clemente Jonatan Daniel)
 *   - Gómez Ricardo → estado "baja" (egresado; se conserva en DB)
 *
 * Idempotente: domicilio/fechas solo se completan si están en null (un valor
 * distinto se reporta como CONFLICTO y no se pisa). Gómez solo se toca si sigue
 * "activo".
 *
 * Uso:
 *   npx tsx --env-file=.env scripts/seed-correcciones-3er-feedback.ts --dry-run
 *   npx tsx --env-file=.env scripts/seed-correcciones-3er-feedback.ts
 */
import { createClient } from "@supabase/supabase-js";

const DRY_RUN = process.argv.includes("--dry-run");
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// Match exacto por (apellido, nombre) tal como están en la DB.
type Correccion = {
  apellido: string;
  nombre: string;
  domicilio?: string;
  fecha_ingreso?: string;
  fecha_nacimiento?: string;
};

const DOMICILIOS_Y_FECHAS: Correccion[] = [
  // 5 domicilios faltantes (Word, sección "Sin domicilio")
  { apellido: "Asteazarán", nombre: "Agustín", domicilio: "JAIME SEGUI 1438. SALADILLO CABECERA. SALADILLO" },
  { apellido: "Bermay", nombre: "Gustavo Basilio", domicilio: "CORONEL SANTIAGO AVENDAÑO 1023. AZUL" },
  { apellido: "Godoy", nombre: "Sebastián Horacio", domicilio: "9 DE JULIO 4178. OLAVARRIA" },
  { apellido: "Juarez", nombre: "Luis Nahuel", domicilio: "MORENO 503 DEPARTAMENTO A. LAS FLORES" },
  { apellido: "Valenza", nombre: "Pablo", domicilio: "SAN ANDRES DE GILES (ZONA RURAL A 4 KM DE LA AUTOPISTA RUTA 7)" },
  // 2 sin fecha de ingreso ni nacimiento (Word, sección 🟥)
  { apellido: "Alvarez", nombre: "Hector Martín", fecha_ingreso: "2024-05-02", fecha_nacimiento: "1980-09-18" },
  { apellido: "Clemente", nombre: "Jonatan Daniel", fecha_ingreso: "2026-05-18", fecha_nacimiento: "1988-01-09" },
];

const EGRESO = {
  apellido: "Gomez",
  nombre: "Ricardo",
  motivo_egreso: "otro" as const,
  observaciones:
    "Egresado de la empresa (informado por Bárbara, 3er feedback 01/06/2026). Se conserva en DB. Motivo y fecha exactos a confirmar.",
};

type ChoferDB = {
  id: string;
  apellido: string;
  nombre: string;
  estado: string;
  domicilio: string | null;
  fecha_ingreso: string | null;
  fecha_nacimiento: string | null;
  observaciones: string | null;
};

async function main() {
  console.log(`Modo: ${DRY_RUN ? "DRY-RUN (no escribe)" : "WRITE"}\n`);

  const { data, error } = await supabase
    .from("choferes")
    .select("id, apellido, nombre, estado, domicilio, fecha_ingreso, fecha_nacimiento, observaciones");
  if (error) throw error;
  const choferes = (data ?? []) as ChoferDB[];

  const find = (ap: string, no: string) =>
    choferes.find((c) => c.apellido === ap && c.nombre === no);

  const planned: { quien: string; campos: string[] }[] = [];
  const conflicts: { quien: string; campo: string; db: string; nuevo: string }[] = [];
  const noop: string[] = [];
  const notFound: string[] = [];
  const updates: { id: string; payload: Record<string, string> }[] = [];

  // 1) Domicilios y fechas (solo si está null)
  for (const c of DOMICILIOS_Y_FECHAS) {
    const db = find(c.apellido, c.nombre);
    if (!db) {
      notFound.push(`${c.apellido} ${c.nombre}`);
      continue;
    }
    const payload: Record<string, string> = {};
    const campos: string[] = [];
    const checks: Array<[keyof ChoferDB & ("domicilio" | "fecha_ingreso" | "fecha_nacimiento"), string | undefined]> = [
      ["domicilio", c.domicilio],
      ["fecha_ingreso", c.fecha_ingreso],
      ["fecha_nacimiento", c.fecha_nacimiento],
    ];
    for (const [campo, valor] of checks) {
      if (!valor) continue;
      const actual = db[campo];
      if (!actual) {
        payload[campo] = valor;
        campos.push(campo);
      } else if (actual !== valor) {
        conflicts.push({ quien: `${db.apellido} ${db.nombre}`, campo, db: String(actual), nuevo: valor });
      }
    }
    if (campos.length) {
      planned.push({ quien: `${db.apellido} ${db.nombre}`, campos });
      updates.push({ id: db.id, payload });
    } else if (conflicts.findIndex((x) => x.quien === `${db.apellido} ${db.nombre}`) === -1) {
      noop.push(`${db.apellido} ${db.nombre} (ya completo)`);
    }
  }

  // 2) Egreso de Gómez (solo si sigue activo)
  const gomez = find(EGRESO.apellido, EGRESO.nombre);
  let egresoUpdate: { id: string; payload: Record<string, string> } | null = null;
  if (!gomez) {
    notFound.push(`${EGRESO.apellido} ${EGRESO.nombre}`);
  } else if (gomez.estado === "activo") {
    egresoUpdate = {
      id: gomez.id,
      payload: { estado: "baja", motivo_egreso: EGRESO.motivo_egreso, observaciones: EGRESO.observaciones },
    };
    planned.push({ quien: `${gomez.apellido} ${gomez.nombre}`, campos: ["estado→baja", "motivo_egreso", "observaciones"] });
  } else {
    noop.push(`${gomez.apellido} ${gomez.nombre} (ya estado="${gomez.estado}")`);
  }

  console.log("========== PLAN ==========");
  console.log(`A actualizar: ${planned.length}`);
  planned.forEach((p) => console.log(`  ✓ ${p.quien}: [${p.campos.join(", ")}]`));
  if (noop.length) { console.log(`\nSin cambios (${noop.length}):`); noop.forEach((n) => console.log(`  • ${n}`)); }
  if (conflicts.length) { console.log(`\n⚠ CONFLICTOS (no se pisan):`); conflicts.forEach((c) => console.log(`  • ${c.quien} [${c.campo}] db="${c.db}" nuevo="${c.nuevo}"`)); }
  if (notFound.length) { console.log(`\n⚠ NO encontrados en DB:`); notFound.forEach((n) => console.log(`  • ${n}`)); }

  if (DRY_RUN) {
    console.log("\nDry-run terminado. Corré sin --dry-run para escribir.");
    return;
  }

  let ok = 0, fail = 0;
  for (const u of [...updates, ...(egresoUpdate ? [egresoUpdate] : [])]) {
    const { error: e } = await supabase.from("choferes").update(u.payload).eq("id", u.id);
    if (e) { fail++; console.error(`✗ ${u.id}: ${e.message}`); } else { ok++; }
  }
  console.log(`\nResultado: ${ok} OK, ${fail} fallidos`);
}

main().catch((e) => { console.error(e); process.exit(1); });
