/**
 * Carga en el Taller los cuatro mensajes reales del grupo "Costos insumos" del
 * 24/08/2026, con su hora, para ver cómo quedan en la pantalla.
 *
 * Los textos son EXACTAMENTE los del grupo, tal como los mandaron. Se pasan por
 * el mismo parser que usa la pantalla (`taller/parseo`), así esto también sirve
 * de prueba contra los datos reales de la base y no contra un mock.
 *
 * Sin argumentos hace un DRY-RUN: dice qué insertaría y no toca nada.
 * Con `--commit` escribe.
 *
 * Es idempotente: si el mensaje ya está cargado con esa fecha, lo saltea. Se
 * puede correr dos veces sin duplicar.
 *
 *   npx tsx --env-file=.env scripts/cargar-taller-24-08.ts
 *   npx tsx --env-file=.env scripts/cargar-taller-24-08.ts --commit
 */

import { createClient } from "@supabase/supabase-js";
import { leerMensaje, type PersonaTaller, type UnidadTaller } from "../src/app/(dashboard)/taller/parseo";

const COMMIT = process.argv.includes("--commit");
const FECHA = "2026-08-24";

/** Los cuatro mensajes, con la hora que figura en el chat. */
const MENSAJES: { hora: string; texto: string }[] = [
  {
    hora: "10:50",
    texto: "Emilio Ramos\nCambio de hoja cortada Eje n 5\n*AE-576-DK",
  },
  {
    hora: "15:30",
    texto: "Baja 2 x línea sin precurar\n27 bajas",
  },
  {
    hora: "16:28",
    texto: "Baja-casco tracción Goodyear kmax\n28 bajas",
  },
  {
    hora: "16:29",
    texto: "*Refuerzo en balancín\n*AF-112-ON\nSola y Brusa 3 Ejes\n*Albornoz Matías",
  },
];

function bajasDe(texto: string): number | null {
  const m = /(\d{1,4})\s*bajas?\b/i.exec(texto);
  return m ? Number(m[1]) : null;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env");
    process.exit(1);
  }
  const sb = createClient(url, key);

  const [camiones, acoplados, choferes] = await Promise.all([
    sb.from("camiones").select("id, patente"),
    sb.from("acoplados").select("id, patente"),
    sb.from("choferes").select("id, nombre, apellido").neq("estado", "baja"),
  ]);

  const unidades: UnidadTaller[] = [
    ...((camiones.data ?? []) as { id: string; patente: string }[]).map((c) => ({
      id: c.id, patente: c.patente, tipo: "camion" as const,
    })),
    ...((acoplados.data ?? []) as { id: string; patente: string }[]).map((a) => ({
      id: a.id, patente: a.patente, tipo: "acoplado" as const,
    })),
  ];
  const personas: PersonaTaller[] = ((choferes.data ?? []) as PersonaTaller[]).map((c) => ({
    id: c.id, nombre: c.nombre ?? "", apellido: c.apellido ?? "",
  }));

  console.log(`\nBase: ${unidades.length} unidades · ${personas.length} personas activas`);
  console.log(COMMIT ? "\n>>> ESCRIBIENDO en la base\n" : "\n>>> DRY-RUN: no se escribe nada\n");

  for (const m of MENSAJES) {
    const l = leerMensaje(m.texto, unidades, personas);
    const bajas = bajasDe(m.texto);

    // Idempotencia: mismo texto y misma fecha = ya está cargado.
    const { data: yaEsta } = await sb
      .from("roturas_gomas")
      .select("id")
      .eq("fecha", FECHA)
      .eq("observaciones", m.texto)
      .maybeSingle();

    const resumen = [
      `${m.hora}`,
      l.unidad ? `unidad ${l.unidad.patente}` : l.patenteDesconocida ? `patente ${l.patenteDesconocida} NO está en el sistema` : "sin unidad",
      l.persona ? `persona ${l.persona.apellido} ${l.persona.nombre}` : "sin persona",
      bajas != null ? `baja n° ${bajas} → tipo goma` : "tipo taller",
    ].join(" · ");

    if (yaEsta) {
      console.log(`= YA ESTABA  ${resumen}`);
      continue;
    }

    console.log(`${COMMIT ? "+ INSERTO   " : "· insertaría"} ${resumen}`);
    console.log(`             "${m.texto.replace(/\n/g, " / ")}"`);

    if (!COMMIT) continue;

    const { error } = await sb.from("roturas_gomas").insert({
      camion_id: l.unidad?.tipo === "camion" ? l.unidad.id : null,
      acoplado_id: l.unidad?.tipo === "acoplado" ? l.unidad.id : null,
      chofer_id: l.persona?.id ?? null,
      tipo: bajas != null ? "goma" : "taller",
      gravedad: "leve",
      fecha: FECHA,
      cantidad: 1,
      moneda: "ARS",
      observaciones: m.texto,
      created_at: `${FECHA}T${m.hora}:00-03:00`,
    });
    if (error) console.error(`  ! ERROR: ${error.message}`);
  }

  console.log(
    COMMIT
      ? "\nListo. Miralo en /taller\n"
      : "\nNada se escribió. Para cargarlos de verdad: agregá --commit\n",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
