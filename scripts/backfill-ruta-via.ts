/**
 * Backfill de la vía (Ruta 5 / Ruta 22) en viajes YA cargados.
 *
 * Antes, el importador de la HOJA DE RUTA dejaba la marca "RUTA 5"/"RUTA 22"
 * pegada dentro de la columna `material` ("YPF LAJE RUTA 5") y no seteaba
 * `ruta_via`. Eso mezclaba las distancias del mismo par (IBICUY→LAJE 20 va ~1360
 * por Ruta 5 y ~1480 sin marcar) y dejaba al autocompletado de km sin datos por
 * vía. Este script recorre los viajes cuyo `material` todavía trae la marca, la
 * separa a `ruta_via` y deja el material limpio.
 *
 * - Idempotente: al limpiar el material, una segunda corrida no encuentra nada.
 * - No pisa una vía ya cargada a mano (solo completa `ruta_via` si está en NULL).
 *
 * Uso:
 *   npx tsx scripts/backfill-ruta-via.ts            # DRY-RUN (no escribe)
 *   npx tsx scripts/backfill-ruta-via.ts --apply    # aplica los cambios
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { extraerVia } from "../src/app/(dashboard)/viajes/import-hoja-ruta/parser-hoja-ruta";

const APPLY = process.argv.includes("--apply");
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Env: preferimos .env.local, caemos a .env.
function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const file of [".env.local", ".env"]) {
    const p = path.join(__dirname, "..", file);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m && env[m[1]] === undefined) env[m[1]] = m[2].trim();
    }
  }
  return env;
}
const env = loadEnv();
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env(.local)");
  process.exit(1);
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any; // cliente admin: solo usamos .from/.select/.update/.insert
const sb: Db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

type ViajeRow = {
  id: string;
  codigo: string | null;
  material: string | null;
  ruta_via: string | null;
};

async function main() {
  console.log(APPLY ? "== BACKFILL ruta_via (APLICANDO) ==" : "== BACKFILL ruta_via (DRY-RUN) ==");

  // Candidatos: material con la palabra RUTA, o terminado en " 5" / " 22" (la marca
  // abreviada tipo "YPF TORO 5"). extraerVia decide después cuáles son vía real.
  const candidatos: ViajeRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from("viajes")
      .select("id, codigo, material, ruta_via")
      .or("material.ilike.%RUTA%,material.ilike.% 5,material.ilike.% 22")
      .order("codigo")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    candidatos.push(...((data ?? []) as ViajeRow[]));
    if (!data || data.length < 1000) break;
  }
  console.log(`Candidatos (material con "RUTA" o número de vía al final): ${candidatos.length}`);

  const cambios: { row: ViajeRow; via: string; materialLimpio: string | null }[] = [];
  for (const row of candidatos) {
    const { via, material } = extraerVia(row.material);
    if (!via) continue; // "YPF TORO 5", "RUTA 3", etc.: no es vía válida, se deja igual
    // No pisar una vía cargada a mano; sí limpiar el material siempre.
    const viaFinal = row.ruta_via ?? via;
    if (row.ruta_via === viaFinal && material === row.material) continue; // ya normalizado
    cambios.push({ row, via: viaFinal, materialLimpio: material });
  }

  const porVia = cambios.reduce<Record<string, number>>((acc, c) => {
    acc[c.via] = (acc[c.via] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`A normalizar: ${cambios.length}`, porVia);
  console.log("\nMuestra (hasta 15):");
  for (const c of cambios.slice(0, 15)) {
    console.log(
      `  ${c.row.codigo ?? c.row.id}  via=${c.via}  material: ${JSON.stringify(c.row.material)} → ${JSON.stringify(c.materialLimpio)}`,
    );
  }

  if (!APPLY) {
    console.log("\nDRY-RUN: no se escribió nada. Corré con --apply para aplicar.");
    return;
  }
  if (cambios.length === 0) {
    console.log("\nNada para aplicar.");
    return;
  }

  let ok = 0;
  for (const c of cambios) {
    const { error } = await sb
      .from("viajes")
      .update({ ruta_via: c.via, material: c.materialLimpio })
      .eq("id", c.row.id);
    if (error) {
      console.error(`  ERROR ${c.row.codigo ?? c.row.id}: ${error.message}`);
      continue;
    }
    ok++;
  }
  console.log(`\nActualizados: ${ok}/${cambios.length}`);

  await sb.from("audit_log").insert({
    accion: "backfill_ruta_via",
    entidad_tipo: "viaje",
    entidad_id: null,
    valores_nuevos: { normalizados: ok, por_via: porVia },
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
