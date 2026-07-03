// Regla del cliente (03/07/2026): no hay flujo de cobro aparte — facturado
// implica cobrado. Este backfill alinea los viajes históricos: todo lo
// facturado queda marcado cobrado (espejo). Idempotente.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = readFileSync(join(root, ".env"), "utf8");
const sb = createClient(
  env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim(),
  env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim(),
);

const { count: antes } = await sb.from("viajes").select("id", { count: "exact", head: true }).eq("facturado", true).eq("cobrado", false);
console.log("facturados sin cobrado (a alinear):", antes);
const { error } = await sb.from("viajes").update({ cobrado: true }).eq("facturado", true).eq("cobrado", false);
if (error) throw new Error(error.message);
const { count: despues } = await sb.from("viajes").select("id", { count: "exact", head: true }).eq("facturado", true).eq("cobrado", false);
console.log("quedan sin alinear:", despues, "(esperado: 0)");
await sb.from("audit_log").insert({
  usuario_id: null,
  accion: "backfill_cobrado_espejo",
  entidad_tipo: "viaje",
  entidad_id: null,
  valores_nuevos: { alineados: antes, motivo: "cobrado = espejo de facturado (se eliminó el flujo de cobro, 03/07/2026)" },
});
console.log("Listo.");
