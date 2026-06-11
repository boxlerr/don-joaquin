/**
 * Borra los movimientos de prueba de caja_movimientos (cargados a mano en
 * mayo 2026 durante el desarrollo: "prueba auditoria", "ganancias", etc.).
 * Solo toca movimientos SIN vínculo a viaje/cliente/chofer/gasto/viatico y
 * cuyo id esté en la lista blanca de abajo — no borra nada cargado después.
 *
 * Uso:
 *   npx tsx --env-file=.env scripts/cleanup-caja-prueba.ts --dry-run
 *   npx tsx --env-file=.env scripts/cleanup-caja-prueba.ts
 */
import { createClient } from "@supabase/supabase-js";

const DRY = process.argv.includes("--dry-run");
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) { console.error("Faltan envs"); process.exit(1); }
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

// Movimientos de prueba identificados el 10/06/2026 (todos de mayo 2026, sin vínculos)
const IDS_PRUEBA = [
  "c2db6685-a81a-4c58-b623-03eed0791fdc", // Descuento - prueba auditoria  (-100.000)
  "8953f9d5-cc61-4b72-95b6-324226f2a4b6", // ganancias                     (+200.000)
  "6199abf1-66e6-4c74-a11f-6ab821e0ac8a", // Cobro Flete                   (+10.000)
  "5848bb56-ac2f-4ad2-a8b3-7b4d9d3cf532", // Movimiento entre cuentass     (+50.000)
  "11e3f4e4-ef6d-43ee-9101-2e718cbe38b6", // Compra de insumos             (-25.000)
  "9d2adc2b-129c-40ea-bd0a-a5805d3e35b2", // prueba ingreso usuario        (+1.000)
];

async function main() {
  const { data: movs, error } = await sb
    .from("caja_movimientos")
    .select("id, fecha, tipo, concepto, monto, viaje_id, cliente_id, chofer_id, gasto_id, viatico_id")
    .in("id", IDS_PRUEBA);
  if (error) { console.error(error); process.exit(1); }

  // Un gasto_id propio (creado por el mismo diálogo de egreso) también se borra;
  // cualquier otro vínculo (viaje/cliente/chofer/viático) frena el borrado.
  const borrables = (movs ?? []).filter(
    (m) => !m.viaje_id && !m.cliente_id && !m.chofer_id && !m.viatico_id,
  );
  const conVinculo = (movs ?? []).filter((m) => !borrables.includes(m));
  const gastoIds = borrables.map((m) => m.gasto_id).filter(Boolean) as string[];

  console.log(`Encontrados: ${movs?.length ?? 0} de ${IDS_PRUEBA.length} en lista`);
  for (const m of borrables) {
    const extra = m.gasto_id ? " (+ gasto vinculado)" : "";
    console.log(`  ${DRY ? "[dry-run]" : "[BORRAR]"} ${String(m.fecha).slice(0, 10)} ${m.tipo.padEnd(7)} $${m.monto}  ${m.concepto}${extra}`);
  }
  for (const m of conVinculo) {
    console.log(`  [SKIP — vinculado a viaje/cliente/chofer/viático] ${m.concepto}`);
  }

  if (DRY || borrables.length === 0) {
    console.log(DRY ? "\nDry-run: no se borró nada." : "\nNada para borrar.");
    return;
  }

  const { error: delError, count } = await sb
    .from("caja_movimientos")
    .delete({ count: "exact" })
    .in("id", borrables.map((m) => m.id));
  if (delError) { console.error(delError); process.exit(1); }
  console.log(`\nBorrados: ${count} movimientos de prueba.`);

  if (gastoIds.length) {
    const { error: gastoError, count: gastosCount } = await sb
      .from("gastos")
      .delete({ count: "exact" })
      .in("id", gastoIds);
    if (gastoError) { console.error(gastoError); process.exit(1); }
    console.log(`Borrados: ${gastosCount} gastos de prueba vinculados.`);
  }
}

main();
