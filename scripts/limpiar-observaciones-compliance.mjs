// Limpia las observaciones que dejó la carga inicial en los documentos de
// Compliance. Son seis, ninguna la escribió una persona (`created_by` nulo) y
// casi todas repiten lo que la fila ya muestra al lado: el nombre del documento
// y la fecha de vencimiento. Pedido de Julián (26/08/2026): "no tiene sentido,
// no suma nada y ya hay fecha de vencimiento".
//
//   node scripts/limpiar-observaciones-compliance.mjs            → dry-run
//   node scripts/limpiar-observaciones-compliance.mjs --aplicar  → escribe
//
// No borra a ciegas: cada caso se reescribe con lo ÚNICO que agregaba (que la
// flota está en Nación, cada cuánto se renueva) y se vacía sólo cuando no
// agregaba nada. Es idempotente —sólo toca la fila si el texto es exactamente
// el que quedó del import— y guarda el valor anterior en `audit_log` para poder
// volver atrás.
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

// de → a (null = se borra). El "de" tiene que coincidir exacto.
const CAMBIOS = [
  ["Vence 31/12/2026 (PDF Jere 06/07)", null],
  ["Seguro de Vida Obligatorio — vence 01/06/2027", null],
  ["Seguro automotor de flota — vence 08/03/2027 (mayoría Nación)", "La mayoría de la flota está en Nación"],
  ["Certificado de cobertura mensual (renueva c/30 días)", "Renueva cada 30 días"],
  ["Libre deuda sindical (renueva c/120 días)", "Renueva cada 120 días"],
  // "Renovación automática — ajustá la fecha real si difiere." se deja: es lo
  // único que dice algo que la fila no dice.
];

const { data: docs, error } = await sb
  .from("compliance_documentos")
  .select("id, observaciones, fecha_vencimiento, requisito_id")
  .not("observaciones", "is", null);
if (error) throw new Error(error.message);

let tocados = 0;
for (const [de, a] of CAMBIOS) {
  const fila = (docs ?? []).find((d) => d.observaciones === de);
  if (!fila) {
    console.log(`· ya estaba limpio: "${de.slice(0, 50)}…"`);
    continue;
  }
  tocados++;
  console.log(`\n${a === null ? "BORRAR" : "REESCRIBIR"}`);
  console.log(`   antes:   "${fila.observaciones}"`);
  console.log(`   después: ${a === null ? "(sin observación)" : `"${a}"`}`);
  if (!APLICAR) continue;

  const { error: e1 } = await sb
    .from("compliance_documentos")
    .update({ observaciones: a })
    .eq("id", fila.id);
  if (e1) {
    console.error(`   ✗ ${e1.message}`);
    continue;
  }
  await sb.from("audit_log").insert({
    usuario_id: null,
    accion: "limpiar_observacion_import",
    entidad_tipo: "compliance_documentos",
    entidad_id: fila.id,
    valores_anteriores: { observaciones: de },
    valores_nuevos: { observaciones: a },
    metadata: { origen: "scripts/limpiar-observaciones-compliance.mjs" },
  });
}

console.log(
  APLICAR
    ? `\nListo: ${tocados} observaciones limpiadas (el valor anterior quedó en audit_log).`
    : `\nDry-run: ${tocados} a cambiar. Corré con --aplicar para escribir.`,
);
