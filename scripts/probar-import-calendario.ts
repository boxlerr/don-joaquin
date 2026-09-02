/**
 * Comprobación del importador de calendarios contra el PDF de verdad.
 *
 *   npx tsx --env-file=.env scripts/probar-import-calendario.ts
 *   npx tsx --env-file=.env scripts/probar-import-calendario.ts "/ruta/otro.pdf"
 *
 * Recorre el mismo camino que la vista previa de la pantalla —parser, entidad
 * por CUIT, clasificación contra lo ya cargado— con los mismos módulos, y no
 * escribe nada. Sirve para ver qué va a pasar antes de subir el archivo, y para
 * probar un PDF nuevo del estudio sin tocar la base.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { extractText, getDocumentProxy } from "unpdf";
import { parseCalendarioSecondi } from "../src/domain/impuestos/calendario-secondi";
import { clasificarFilas, type CargadoPrevio } from "../src/domain/impuestos/import-calendario";
import { prefijoAlertaImpuesto, sufijoEntidadEnAviso } from "../src/domain/impuestos/entidades";

const ACCION: Record<string, string> = {
  nuevo: "se agenda",
  mueve_fecha: "cambia de fecha",
  ya_cargado: "ya estaba",
};

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const ruta = process.argv[2] ?? "/Users/julianboxler/Downloads/JOAQUIN NICOLAS.pdf";

  const bytes = new Uint8Array(readFileSync(ruta));
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  const calendario = parseCalendarioSecondi(Array.isArray(text) ? text.join("\n") : text);

  console.log("── LO QUE LEE DEL PDF ───────────────────────────────────");
  console.log("Contribuyente:", calendario.razonSocial);
  console.log("CUIT:", calendario.cuit);
  console.log("Advertencias:", calendario.advertencias.length ? calendario.advertencias : "ninguna");
  console.table(calendario.filas);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: ent } = await (sb as any)
    .from("impuesto_entidades")
    .select("codigo, nombre, cuit, columna_alerta")
    .eq("cuit", calendario.cuit ?? "___")
    .maybeSingle();

  console.log("\n── A QUIÉN LE AVISA ─────────────────────────────────────");
  if (!ent) {
    console.log("El CUIT no está dado de alta: la vista previa pide el alta antes de confirmar.");
  } else {
    console.log(`Contribuyente reconocido: ${ent.nombre} (${ent.codigo})`);
    console.log(`Casillero de la matriz:   ${ent.columna_alerta}`);
    console.log(`entidad_tipo de la alerta: ${prefijoAlertaImpuesto(ent.columna_alerta)}T15`);
    console.log(`Texto del aviso: El impuesto "IVA"${sufijoEntidadEnAviso(ent)} vence en 15 días.`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: ya } = await (sb as any)
    .from("impuesto_vencimientos")
    .select("id, nombre, fecha_vencimiento, organismo, presentado")
    .eq("entidad_codigo", ent?.codigo ?? "___")
    .in("nombre", [...new Set(calendario.filas.map((f) => f.nombre))]);

  console.log("\n── QUÉ HARÍA AL CONFIRMAR ───────────────────────────────");
  console.table(
    clasificarFilas(calendario.filas, (ya ?? []) as CargadoPrevio[]).map((f) => ({
      impuesto: f.nombre,
      vence: f.fechaVencimiento,
      organismo: f.organismo || "—",
      accion: ACCION[f.estado],
    })),
  );
  console.log("(sólo lectura: no se escribió nada)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
