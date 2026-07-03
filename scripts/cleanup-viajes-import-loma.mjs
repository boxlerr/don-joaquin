// Limpieza acordada con Nico (WhatsApp 03/07/2026): borrar TODOS los viajes
// creados por los imports de la liquidación de Loma (mayo + junio + huérfanos
// de imports borrados), para que queden solo los de abril (hoja de ruta + DM
// YPF) y los cargados a mano. Los archivos se van a re-importar cuando el
// cliente termine su hoja de ruta, ya con el importador corregido (fecha por
// In.act.transp., peso bruto, solo completar).
//
// Uso:
//   node scripts/cleanup-viajes-import-loma.mjs            → dry-run (no borra)
//   node scripts/cleanup-viajes-import-loma.mjs --confirm  → borra en serio
//
// Identificación: los viajes creados por el import llevan observaciones
// "[Import Loma · Nº transporte ...]". Los viajes cargados a mano que el import
// solo COMPLETÓ no tienen esa marca (hoy: 0 según la inspección del 03/07).

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CONFIRM = process.argv.includes("--confirm");
const MARCA = "[Import Loma · Nº transporte%";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = readFileSync(join(root, ".env"), "utf8");
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();
const sb = createClient(url, key);

// ── 1) Viajes objetivo ───────────────────────────────────────────────────────
const objetivo = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await sb
    .from("viajes")
    .select("id, codigo, fecha_viaje, liq_loma_id")
    .like("observaciones", MARCA)
    .order("id", { ascending: true }) // orden estable para paginar sin saltear filas
    .range(from, from + 999);
  if (error) throw new Error(`Leyendo viajes: ${error.message}`);
  objetivo.push(...(data ?? []));
  if ((data ?? []).length < 1000) break;
}

const porMes = {};
for (const v of objetivo) {
  const m = v.fecha_viaje?.slice(0, 7) ?? "sin fecha";
  porMes[m] = (porMes[m] ?? 0) + 1;
}
console.log(`Viajes creados por imports de Loma: ${objetivo.length}`);
console.log("Por mes:", JSON.stringify(porMes, null, 2));

// ── 2) Chequeo de referencias (no debería haber: son viajes importados) ─────
const ids = objetivo.map((v) => v.id);
const TABLAS_REF = [
  "caja_movimientos", "cta_cte_movimientos", "gastos", "hoja_ruta_items",
  "viaje_cartas_porte", "viaje_facturas", "viaje_remitos",
  "viaje_tonelaje_detalle", "viaticos",
];
let refs = 0;
for (const tabla of TABLAS_REF) {
  let count = 0;
  for (let i = 0; i < ids.length; i += 200) {
    const { count: c, error } = await sb
      .from(tabla)
      .select("id", { count: "exact", head: true })
      .in("viaje_id", ids.slice(i, i + 200));
    if (error) { console.log(`  (${tabla}: no se pudo chequear — ${error.message})`); count = -1; break; }
    count += c ?? 0;
  }
  if (count > 0) {
    console.log(`⚠️  ${tabla}: ${count} filas referencian viajes a borrar`);
    refs += count;
  }
}
if (refs > 0) {
  console.log("ABORTADO: hay datos vinculados (cobros/gastos/facturas). Revisar a mano antes de borrar.");
  process.exit(1);
}
console.log("Sin referencias en caja/gastos/facturas/viáticos ✓");

// ── 3) Liquidaciones archivadas a borrar (registro + archivo en storage) ────
const { data: liqs, error: liqErr } = await sb
  .from("compliance_liq_loma")
  .select("id, periodo_desde, periodo_hasta, fletes_count, archivo_id");
if (liqErr) throw new Error(`Leyendo liquidaciones: ${liqErr.message}`);
console.log(`Liquidaciones archivadas a borrar: ${(liqs ?? []).length}`);
for (const l of liqs ?? []) console.log(`  · ${l.periodo_desde} → ${l.periodo_hasta} (${l.fletes_count} fletes)`);

if (!CONFIRM) {
  console.log("\nDRY-RUN: no se borró nada. Ejecutar con --confirm para aplicar.");
  process.exit(0);
}

// ── 4) Borrado real ──────────────────────────────────────────────────────────
let borrados = 0;
for (let i = 0; i < ids.length; i += 200) {
  const lote = ids.slice(i, i + 200);
  const { error } = await sb.from("viajes").delete().in("id", lote);
  if (error) throw new Error(`Borrando viajes (lote ${i / 200 + 1}): ${error.message}`);
  borrados += lote.length;
}
console.log(`Viajes borrados: ${borrados}`);

for (const l of liqs ?? []) {
  const { error } = await sb.from("compliance_liq_loma").delete().eq("id", l.id);
  if (error) { console.log(`  ⚠️ liq ${l.id}: ${error.message}`); continue; }
  if (l.archivo_id) {
    const { data: arch } = await sb
      .from("documentos_archivos")
      .select("bucket, path")
      .eq("id", l.archivo_id)
      .maybeSingle();
    if (arch) {
      await sb.storage.from(arch.bucket).remove([arch.path]);
      await sb.from("documentos_archivos").delete().eq("id", l.archivo_id);
    }
  }
  console.log(`  Liquidación ${l.periodo_desde} → ${l.periodo_hasta} borrada (registro + archivo).`);
}

await sb.from("audit_log").insert({
  usuario_id: null,
  accion: "cleanup_import_loma",
  entidad_tipo: "viaje",
  entidad_id: null,
  valores_nuevos: { viajes_borrados: borrados, liquidaciones_borradas: (liqs ?? []).length, motivo: "acuerdo con cliente 03/07/2026: sin viajes de mayo/junio hasta cerrar su hoja de ruta" },
});
console.log("Listo. Auditoría registrada.");
