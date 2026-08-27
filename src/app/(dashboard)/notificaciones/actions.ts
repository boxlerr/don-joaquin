"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { generarAlertas } from "@/lib/alertas";
import { getPendientesNoLeidasIds } from "@/lib/alertas-lecturas";
import { RESUMEN_OCULTAS_CLAVE } from "@/lib/resumen-diario";
import { ALERTA_COLUMNAS } from "@/app/(dashboard)/configuracion/notificaciones/constants";
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

// Las alertas en vivo de documentos y cheques (`docvenc-*` / `chequevenc-*`) no
// existen en la tabla `alertas`; no son marcables. Filtrarlas evita una violación
// de FK en el upsert.
function esMarcable(alertaId: string): boolean {
  return !alertaId.startsWith("docvenc-") && !alertaId.startsWith("chequevenc-");
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

/**
 * Qué categorías NO quiere ver esta persona en el resumen del día.
 *
 * Pedido de Nico (27/08/2026): "a él no le importan los documentos, pero a
 * Anabela no le importan los cheques o préstamos". Los dos tienen el mismo rol,
 * así que por permisos son la misma persona: esto no es un permiso, es una
 * preferencia, y la elige cada uno desde el propio pop-up.
 *
 * Se guarda lo APAGADO (no lo prendido) en un solo parámetro con forma
 * `{ usuarioId: ["cheques_vencidos", …] }`, igual que la matriz del mail. Así una
 * categoría nueva le aparece a todos sin que nadie tenga que ir a tildarla.
 *
 * Va con el cliente admin —y no con la sesión— a propósito: `parametros_sistema`
 * es tabla de configuración y por RLS sólo la escriben los administradores. Acá
 * cada uno escribe SU renglón, que se toma de `requireUser()`; del cliente sólo
 * llega la lista de categorías, y se descarta cualquier clave que no exista.
 */
export async function guardarCategoriasResumen(ocultas: string[]): Promise<void> {
  const user = await requireUser();
  const validas = new Set(ALERTA_COLUMNAS.map((c) => c.key));
  const limpias = [...new Set((ocultas ?? []).filter((k) => validas.has(k)))];

  const supabase = createAdminClient();
  const { data: actual } = await supabase
    .from("parametros_sistema")
    .select("id, valor")
    .eq("clave", RESUMEN_OCULTAS_CLAVE)
    .maybeSingle();

  let mapa: Record<string, string[]> = {};
  if (actual?.valor) {
    try {
      const parsed = JSON.parse(actual.valor);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        mapa = parsed as Record<string, string[]>;
      }
    } catch {
      /* JSON roto: se reescribe entero, y de paso queda arreglado */
    }
  }

  // Sin nada apagado no se deja el renglón vacío: "ve todo" es la ausencia de fila.
  if (limpias.length === 0) delete mapa[user.id];
  else mapa[user.id] = limpias;

  const valor = JSON.stringify(mapa);
  const ahora = new Date().toISOString();

  if (actual?.id) {
    await supabase
      .from("parametros_sistema")
      .update({ valor, updated_by: user.id, updated_at: ahora })
      .eq("id", actual.id);
  } else {
    await supabase.from("parametros_sistema").insert({
      clave: RESUMEN_OCULTAS_CLAVE,
      valor,
      tipo_dato: "json",
      categoria: "notificaciones",
      // No editable a mano: son preferencias de cada persona, no un ajuste del
      // sistema. Se cambian desde el resumen del día, con los nombres a la vista.
      editable: false,
      descripcion:
        "Resumen del día: categorías que cada persona eligió no ver en el pop-up.",
      updated_by: user.id,
      updated_at: ahora,
    });
  }
}
