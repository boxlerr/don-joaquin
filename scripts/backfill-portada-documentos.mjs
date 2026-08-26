// Completa la PORTADA (`archivo_id`) de los documentos que tienen el papel
// cargado en su tabla puente pero la columna vacía. La portada es lo que miran
// las vistas que muestran un solo papel por documento —`v_compliance_estado`
// entre ellas—, así que sin esto un documento cargado desde la ficha del camión
// o del chofer figura como "sin papel" en Compliance.
//
//   node scripts/backfill-portada-documentos.mjs            → dry-run (no escribe)
//   node scripts/backfill-portada-documentos.mjs --aplicar  → escribe
//
// Es idempotente: solo toca filas con archivo_id NULL y les pone el PRIMER
// adjunto (el más viejo). Correrlo dos veces no cambia nada la segunda.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = readFileSync(join(root, ".env"), "utf8");
const sb = createClient(
  env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim(),
  env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim(),
  { auth: { persistSession: false } },
);

const APLICAR = process.argv.includes("--aplicar");

const TABLAS = [
  { docs: "camion_documentos", puente: "camion_documento_archivos", fk: "camion_documento_id" },
  { docs: "chofer_documentos", puente: "chofer_documento_archivos", fk: "chofer_documento_id" },
  { docs: "compliance_documentos", puente: "compliance_documento_archivos", fk: "compliance_documento_id" },
];

// Ojo con el corte de 1000 filas de Supabase: se pagina siempre.
async function traerTodo(tabla, columnas) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(tabla).select(columnas).range(from, from + 999);
    if (error) throw new Error(`${tabla}: ${error.message}`);
    out.push(...data);
    if (data.length < 1000) return out;
  }
}

let total = 0;
for (const { docs, puente, fk } of TABLAS) {
  const [filas, adjuntos] = await Promise.all([
    traerTodo(docs, "id, archivo_id"),
    traerTodo(puente, `${fk}, archivo_id, created_at`),
  ]);

  // El primero de cada documento, por fecha de subida.
  const primero = new Map();
  for (const a of adjuntos.sort((x, y) => x.created_at.localeCompare(y.created_at))) {
    if (a[fk] && a.archivo_id && !primero.has(a[fk])) primero.set(a[fk], a.archivo_id);
  }

  const huerfanos = filas.filter((d) => !d.archivo_id && primero.has(d.id));
  console.log(
    `${docs}: ${filas.length} documentos · ${primero.size} con papel · ${huerfanos.length} sin portada`,
  );

  for (const d of huerfanos) {
    total++;
    if (!APLICAR) continue;
    const { error } = await sb.from(docs).update({ archivo_id: primero.get(d.id) }).eq("id", d.id);
    if (error) console.error(`  ✗ ${d.id}: ${error.message}`);
  }
}

console.log(
  APLICAR
    ? `\nListo: ${total} documentos con la portada completada.`
    : `\nDry-run: ${total} documentos a completar. Corré con --aplicar para escribir.`,
);
