import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { alertaHref, type AlertaItem, type Severidad } from "@/app/(dashboard)/notificaciones/utils";

/**
 * Capa de estado leído/descartado POR USUARIO.
 *
 * `alertas` es global (lo comparten todos y el generador depende de su `estado`
 * para deduplicar). El estado "leída/descartada" de cada usuario vive en la tabla
 * join `alerta_lecturas (alerta_id, usuario_id, leida_en, descartada_en)`:
 *
 *   - no leída   = no hay fila, o (leida_en IS NULL AND descartada_en IS NULL)
 *   - leída      = leida_en IS NOT NULL AND descartada_en IS NULL
 *   - descartada = descartada_en IS NOT NULL  (sale del historial de ese usuario)
 *
 * Nunca tocamos `alertas.estado`, así marcar leída no afecta a los demás usuarios
 * ni rompe el dedup de `generarAlertas`.
 *
 * `alerta_lecturas` es tabla nueva: aún no está en `database.ts`, por eso usamos
 * el patrón `(supabase as any)` que ya emplea `lib/alertas.ts` para tablas nuevas.
 */

// Tipos calculados EN VIVO en /notificaciones (ids sintéticos `docvenc-*`, no están
// en la tabla `alertas`). No son "marcables" y por construcción no entran al conteo
// ni al toaster: así el badge puede llegar a 0 cuando el usuario marca todo leído.
export const DOC_LIVE = ["vencimiento_doc_camion", "vencimiento_doc_chofer"] as const;

export type ResumenItem = {
  id: string;
  severidad: Severidad;
  titulo: string;
  mensaje: string;
  href: string | null;
};

type LecturaRow = { alerta_id: string; leida_en: string | null; descartada_en: string | null };

const SEV_ORDER: Record<Severidad, number> = { critica: 0, advertencia: 1, info: 2 };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = any;

/** Lecturas del usuario, indexadas por alerta_id. */
async function getLecturasMap(supabase: Supabase, usuarioId: string): Promise<Map<string, LecturaRow>> {
  const { data } = await supabase
    .from("alerta_lecturas")
    .select("alerta_id, leida_en, descartada_en")
    .eq("usuario_id", usuarioId);
  return new Map<string, LecturaRow>((data ?? []).map((r: LecturaRow) => [r.alerta_id, r]));
}

function noLeida(l: LecturaRow | undefined): boolean {
  // Sin fila → no leída. Con fila → no leída sólo si no tiene leida_en ni descartada_en.
  return !l || (!l.leida_en && !l.descartada_en);
}

/**
 * IDs de alertas globales `pendiente` (sin las docvenc-* en vivo) que el usuario
 * todavía NO marcó como leídas ni descartó. Es la definición canónica de "no leída"
 * que comparten el badge del layout, el endpoint y `marcarTodasVistas`.
 */
export async function getPendientesNoLeidasIds(usuarioId: string): Promise<string[]> {
  const supabase = createAdminClient();
  const [{ data: alertas }, lecturas] = await Promise.all([
    supabase
      .from("alertas")
      .select("id")
      .eq("estado", "pendiente")
      .not("tipo", "in", `(${DOC_LIVE.join(",")})`),
    getLecturasMap(supabase, usuarioId),
  ]);
  return (alertas ?? []).map((a: { id: string }) => a.id).filter((id: string) => noLeida(lecturas.get(id)));
}

/**
 * Resumen para el badge y el polling: `count` de no leídas + top-`limit` ítems con
 * el `href` ya resuelto server-side (el cliente sólo navega). Orden severidad↓, fecha↓.
 */
export async function getResumenUsuario(
  usuarioId: string,
  limit = 8,
): Promise<{ count: number; items: ResumenItem[] }> {
  const supabase = createAdminClient();
  const [{ data: alertas }, lecturas] = await Promise.all([
    supabase
      .from("alertas")
      .select("id, tipo, severidad, titulo, mensaje, fecha_disparo, entidad_tipo, entidad_id")
      .eq("estado", "pendiente")
      .not("tipo", "in", `(${DOC_LIVE.join(",")})`)
      .order("fecha_disparo", { ascending: false }),
    getLecturasMap(supabase, usuarioId),
  ]);

  type Row = {
    id: string;
    tipo: string;
    severidad: Severidad;
    titulo: string;
    mensaje: string;
    fecha_disparo: string;
    entidad_tipo: string | null;
    entidad_id: string | null;
  };

  const noLeidas: Row[] = (alertas ?? []).filter((a: Row) => noLeida(lecturas.get(a.id)));

  const items: ResumenItem[] = [...noLeidas]
    .sort((a, b) => {
      const s = SEV_ORDER[a.severidad] - SEV_ORDER[b.severidad];
      if (s !== 0) return s;
      return b.fecha_disparo.localeCompare(a.fecha_disparo);
    })
    .slice(0, limit)
    .map((a) => ({
      id: a.id,
      severidad: a.severidad,
      titulo: a.titulo,
      mensaje: a.mensaje,
      href: alertaHref({ tipo: a.tipo, entidad_tipo: a.entidad_tipo, entidad_id: a.entidad_id }),
    }));

  return { count: noLeidas.length, items };
}

/**
 * Historial de leídas del usuario: alertas `pendiente` (sin docvenc-*) que el
 * usuario marcó leídas y todavía no borró de su historial.
 */
export async function getHistorialLeidas(usuarioId: string, limit = 200): Promise<AlertaItem[]> {
  const supabase = createAdminClient();
  const [{ data: alertas }, { data: lecturas }] = await Promise.all([
    supabase
      .from("alertas")
      .select("id, tipo, severidad, titulo, mensaje, fecha_disparo, fecha_vencimiento, entidad_tipo, entidad_id")
      .eq("estado", "pendiente")
      .not("tipo", "in", `(${DOC_LIVE.join(",")})`),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("alerta_lecturas")
      .select("alerta_id, leida_en, descartada_en")
      .eq("usuario_id", usuarioId)
      .not("leida_en", "is", null)
      .is("descartada_en", null)
      .order("leida_en", { ascending: false }) as { data: LecturaRow[] | null },
  ]);

  const ordenLeida = new Map<string, number>();
  (lecturas ?? []).forEach((l: LecturaRow, i: number) => ordenLeida.set(l.alerta_id, i));

  return ((alertas ?? []) as AlertaItem[])
    .filter((a) => ordenLeida.has(a.id))
    .sort((a, b) => (ordenLeida.get(a.id)! - ordenLeida.get(b.id)!))
    .slice(0, limit);
}
