"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { generarAlertas } from "@/lib/alertas";
import { getPendientesNoLeidasIds } from "@/lib/alertas-lecturas";
import { revalidatePath } from "next/cache";

// El estado leído/descartado es POR USUARIO: vive en `alerta_lecturas`, NO en
// `alertas.estado` (que es global y lo usa el generador para deduplicar). Por eso
// marcar leída acá no afecta a Nicolás, Bárbara ni a ningún otro usuario.
//
// Seguridad: el usuario SIEMPRE se deriva de requireUser(); el cliente sólo manda
// el/los alertaId. Nunca confiamos en un usuario_id que venga del browser.
//
// `alerta_lecturas` es tabla nueva (todavía no está en database.ts) → usamos el
// patrón `(supabase as any)`, igual que lib/alertas.ts para tablas nuevas.

// Las alertas en vivo de documentos (`docvenc-*`) no existen en la tabla `alertas`;
// no son marcables. Filtrarlas evita una violación de FK en el upsert.
function esMarcable(alertaId: string): boolean {
  return !alertaId.startsWith("docvenc-");
}

export async function marcarAlertaVista(alertaId: string) {
  if (!esMarcable(alertaId)) return;
  const user = await requireUser();
  const supabase = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("alerta_lecturas")
    .upsert(
      { alerta_id: alertaId, usuario_id: user.id, leida_en: new Date().toISOString(), descartada_en: null },
      { onConflict: "alerta_id,usuario_id" },
    );

  revalidatePath("/notificaciones");
  revalidatePath("/");
}

export async function marcarAlertasVistas(alertaIds: string[]) {
  if (!alertaIds || alertaIds.length === 0) return;
  const ids = alertaIds.filter(esMarcable);
  if (ids.length === 0) return;

  const user = await requireUser();
  const supabase = createAdminClient();
  const ahora = new Date().toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("alerta_lecturas")
    .upsert(
      ids.map((id) => ({ alerta_id: id, usuario_id: user.id, leida_en: ahora, descartada_en: null })),
      { onConflict: "alerta_id,usuario_id" },
    );

  revalidatePath("/notificaciones");
  revalidatePath("/");
}

export async function marcarTodasVistas() {
  const user = await requireUser();
  const ids = await getPendientesNoLeidasIds(user);
  if (ids.length === 0) return;

  const supabase = createAdminClient();
  const ahora = new Date().toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("alerta_lecturas")
    .upsert(
      ids.map((id) => ({ alerta_id: id, usuario_id: user.id, leida_en: ahora, descartada_en: null })),
      { onConflict: "alerta_id,usuario_id" },
    );

  revalidatePath("/notificaciones");
  revalidatePath("/");
}

export async function actualizarAlertas() {
  await requireUser();
  await generarAlertas();
  revalidatePath("/notificaciones");
  revalidatePath("/");
}

// Borra (saca del historial de ESTE usuario) una alerta ya leída. No afecta a los
// demás: marca descartada_en sólo en la fila del usuario.
export async function borrarAlerta(alertaId: string) {
  if (!esMarcable(alertaId)) return;
  const user = await requireUser();
  const supabase = createAdminClient();
  const ahora = new Date().toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("alerta_lecturas")
    .upsert(
      { alerta_id: alertaId, usuario_id: user.id, leida_en: ahora, descartada_en: ahora },
      { onConflict: "alerta_id,usuario_id" },
    );

  revalidatePath("/notificaciones");
  revalidatePath("/");
}

// Borra de una todas las notificaciones leídas del usuario (las saca de su historial).
export async function borrarTodasLeidas() {
  const user = await requireUser();
  const supabase = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("alerta_lecturas")
    .update({ descartada_en: new Date().toISOString() })
    .eq("usuario_id", user.id)
    .not("leida_en", "is", null)
    .is("descartada_en", null);

  revalidatePath("/notificaciones");
  revalidatePath("/");
}
