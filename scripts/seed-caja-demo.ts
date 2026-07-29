/**
 * Datos de demo para la caja diaria: movimientos de AYER y HOY cargados por
 * dirección (quien tiene caja_saldo) y por operadores (quien no lo tiene), para
 * ver funcionando el filtro por autor del "modo operador" — Bárbara opera la
 * caja estando de viaje sin que el operador del día vea sus movimientos.
 *
 * Todos llevan observaciones = 'DEMO-CAJA' y no se vinculan a viaje/cliente/
 * chofer/gasto/viático, así el borrado es exacto y no toca nada real.
 *
 * Uso:
 *   npx tsx --env-file=.env.local scripts/seed-caja-demo.ts
 *   npx tsx --env-file=.env.local scripts/seed-caja-demo.ts --limpiar
 */
import { createClient } from "@supabase/supabase-js";

const MARCA = "DEMO-CAJA";
const LIMPIAR = process.argv.includes("--limpiar");

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

// Usuarios reales del sistema (ver /usuarios). Dirección = tiene caja_saldo.
const BARBARA = "df06bc03-d894-4b42-bc80-d32efb1e0844"; // admin → dirección
const NICO_Q = "8f53af61-cfd6-402e-975e-0370544ac816"; // caja_saldo por override → dirección
const LUCAS = "7383c773-1cc5-4b46-ab78-faffe2cbfec0"; // operativo → operador
const PAULA = "4e1d644b-a616-4e39-878c-ec7838ecc0db"; // administrativo → operador

const hoy = new Date();
const iso = (d: Date) => d.toISOString().slice(0, 10);
const HOY = iso(hoy);
const AYER = iso(new Date(hoy.getTime() - 24 * 60 * 60 * 1000));

type Mov = {
  fecha: string;
  tipo: "ingreso" | "egreso";
  categoria: string;
  concepto: string;
  monto: number;
  medio: string;
  created_by: string;
};

const MOVIMIENTOS: Mov[] = [
  // --- Operadores: esto SÍ lo ve el que maneja la caja -----------------------
  { fecha: AYER, tipo: "ingreso", categoria: "cobro_cliente", concepto: "Cobro flete Loma Negra - remito 4471", monto: 380000, medio: "efectivo", created_by: PAULA },
  { fecha: AYER, tipo: "egreso", categoria: "entrega_viatico", concepto: "Viático Ruta 5 - salida 06:00", monto: 45000, medio: "efectivo", created_by: PAULA },
  { fecha: AYER, tipo: "egreso", categoria: "gasto_operativo", concepto: "Gomería - reparación cubierta", monto: 62000, medio: "efectivo", created_by: LUCAS },
  { fecha: HOY, tipo: "ingreso", categoria: "rendicion_vuelto", concepto: "Rendición vuelto viático - Ruta 22", monto: 8500, medio: "efectivo", created_by: LUCAS },
  { fecha: HOY, tipo: "egreso", categoria: "pago_proveedor", concepto: "Repuestos - filtros de aceite", monto: 94000, medio: "efectivo", created_by: PAULA },
  { fecha: HOY, tipo: "egreso", categoria: "entrega_viatico", concepto: "Viático YPF Bahía - salida 14:00", monto: 52000, medio: "efectivo", created_by: LUCAS },

  // --- Dirección: esto queda OCULTO para el operador -------------------------
  { fecha: AYER, tipo: "egreso", categoria: "otro", concepto: "Retiro dirección", monto: 500000, medio: "efectivo", created_by: BARBARA },
  { fecha: AYER, tipo: "ingreso", categoria: "cobro_cliente", concepto: "Cobro cuenta corriente - transferencia recibida", monto: 1250000, medio: "transferencia", created_by: BARBARA },
  { fecha: HOY, tipo: "egreso", categoria: "pago_proveedor", concepto: "Pago estudio contable", monto: 320000, medio: "transferencia", created_by: NICO_Q },
  { fecha: HOY, tipo: "egreso", categoria: "ajuste", concepto: "Ajuste de caja - conciliación banco", monto: 75000, medio: "otro", created_by: BARBARA },
];

async function limpiar() {
  const { data, error } = await sb
    .from("caja_movimientos")
    .select("id, concepto, viaje_id, cliente_id, chofer_id, gasto_id, viatico_id")
    .eq("observaciones", MARCA);
  if (error) {
    console.error(error);
    process.exit(1);
  }

  const borrables = (data ?? []).filter(
    (m) => !m.viaje_id && !m.cliente_id && !m.chofer_id && !m.gasto_id && !m.viatico_id,
  );
  if (borrables.length === 0) {
    console.log("No hay movimientos de demo para borrar.");
    return;
  }

  const { error: delError, count } = await sb
    .from("caja_movimientos")
    .delete({ count: "exact" })
    .in(
      "id",
      borrables.map((m) => m.id),
    );
  if (delError) {
    console.error(delError);
    process.exit(1);
  }
  console.log(`Borrados ${count} movimientos de demo.`);
}

async function sembrar() {
  const filas = MOVIMIENTOS.map((m) => ({
    ...m,
    moneda: "ARS",
    caja: "diaria",
    observaciones: MARCA,
  }));

  const { data, error } = await sb.from("caja_movimientos").insert(filas).select("id");
  if (error) {
    console.error(error);
    process.exit(1);
  }
  console.log(`Insertados ${data?.length ?? 0} movimientos de demo en la caja diaria.`);
  console.log(`  Visibles para el operador: ${MOVIMIENTOS.filter((m) => m.created_by === LUCAS || m.created_by === PAULA).length}`);
  console.log(`  Ocultos (dirección):       ${MOVIMIENTOS.filter((m) => m.created_by === BARBARA || m.created_by === NICO_Q).length}`);
}

async function main() {
  if (LIMPIAR) await limpiar();
  else await sembrar();
}

main();
