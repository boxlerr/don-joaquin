import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { alertaHref, type AlertaItem, type Severidad } from "@/app/(dashboard)/notificaciones/utils";
import type { CurrentUser } from "@/lib/auth";
import { getChequeAlertasLive } from "@/lib/alertas-live";
import { visiblePara } from "@/lib/alertas-visibilidad";

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

// Tipos calculados EN VIVO en /notificaciones (ids sintéticos `docvenc-*` /
// `chequevenc-*`, no están en la tabla `alertas`). No son "marcables", así que
// se los deja afuera del conteo para que el badge pueda llegar a 0 cuando el
// usuario marca todo leído.
//
// La excepción es el cheque en cartera que vence hoy o que ya venció: ése sí
// entra al conteo y al toaster (ver `chequesEnLaCampana` más abajo). No rompe la
// regla del badge en cero porque se apaga solo apenas el cheque se deposita o se
// cede — no hace falta que nadie lo marque.
//
// Los cheques entraron acá porque su fila de la tabla se escribe UNA vez y el
// texto queda congelado: el dedup impide regenerarla, así que la campana decía
// "vence en 6 días" para siempre — incluso el día que vencía. Calculado en vivo
// escala solo a "vence hoy" y "venció hace N", y se apaga al salir de cartera.
export const DOC_LIVE = [
  "vencimiento_doc_camion",
  "vencimiento_doc_chofer",
  "vencimiento_cheque",
] as const;

export type ResumenItem = {
  id: string;
  severidad: Severidad;
  titulo: string;
  mensaje: string;
  href: string | null;
  /**
   * `false` en los avisos calculados en vivo: no son filas de `alertas`, así que
   * no se pueden marcar leídos. Se apagan haciendo lo que piden. La campana los
   * dibuja sin el tilde para no ofrecer un botón que no hace nada (mismo criterio
   * que `AlertaItem.marcable` en /notificaciones).
   */
  marcable?: boolean;
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
export async function getPendientesNoLeidasIds(usuario: CurrentUser): Promise<string[]> {
  const supabase = createAdminClient();
  const [{ data: alertas }, lecturas] = await Promise.all([
    supabase
      .from("alertas")
      // tipo y entidad_tipo hacen falta para descartar las de secciones
      // confidenciales: si el badge las cuenta y la lista no las muestra,
      // queda un contador que nunca baja.
      .select("id, tipo, entidad_tipo")
      .eq("estado", "pendiente")
      .not("tipo", "in", `(${DOC_LIVE.join(",")})`),
    getLecturasMap(supabase, usuario.id),
  ]);
  const puedeVer = visiblePara(usuario);
  return ((alertas ?? []) as { id: string; tipo: string; entidad_tipo: string | null }[])
    .filter(puedeVer)
    .map((a) => a.id)
    .filter((id) => noLeida(lecturas.get(id)));
}

/** IDs de alertas que el usuario ya ocultó (leídas o descartadas). */
export async function getOcultasPorUsuario(usuarioId: string): Promise<Set<string>> {
  const supabase = createAdminClient();
  const lecturas = await getLecturasMap(supabase, usuarioId);
  const ocultas = new Set<string>();
  for (const [id, l] of lecturas) {
    if (l.leida_en || l.descartada_en) ocultas.add(id);
  }
  return ocultas;
}

/**
 * Resumen para el badge y el polling: `count` de no leídas + top-`limit` ítems con
 * el `href` ya resuelto server-side (el cliente sólo navega). Orden severidad↓, fecha↓.
 * `allIds` trae TODAS las no leídas (no sólo el top-`limit`) para que el cliente
 * pueda marcar como "ya avisadas" todas en el primer load y no toastear viejas.
 */
export async function getResumenUsuario(
  usuario: CurrentUser,
  limit = 8,
): Promise<{ count: number; items: ResumenItem[]; allIds: string[] }> {
  const supabase = createAdminClient();
  const [{ data: alertas }, lecturas, chequesLive] = await Promise.all([
    supabase
      .from("alertas")
      .select("id, tipo, severidad, titulo, mensaje, fecha_disparo, entidad_tipo, entidad_id")
      .eq("estado", "pendiente")
      .not("tipo", "in", `(${DOC_LIVE.join(",")})`)
      .order("fecha_disparo", { ascending: false }),
    getLecturasMap(supabase, usuario.id),
    // La ÚNICA excepción a "en la campana sólo entran filas de la tabla": el
    // cheque en cartera que vence hoy o que ya venció. Ver `chequesEnLaCampana`.
    getChequeAlertasLive(supabase, { soloHitos: false }),
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

  // El título y el mensaje viajan al cliente, y los de préstamos traen montos:
  // se descartan acá, no en la pantalla.
  const puedeVer = visiblePara(usuario);
  const noLeidas: Row[] = (alertas ?? []).filter(
    (a: Row) => puedeVer(a) && noLeida(lecturas.get(a.id)),
  );

  const ordenadas = [...noLeidas].sort((a, b) => {
    const s = SEV_ORDER[a.severidad] - SEV_ORDER[b.severidad];
    if (s !== 0) return s;
    return b.fecha_disparo.localeCompare(a.fecha_disparo);
  });

  const cheques = chequesEnLaCampana(chequesLive, puedeVer);

  // Los cheques van PRIMERO y no se recortan: son uno o dos, y son lo único de
  // esta lista que se pierde si el día pasa sin que nadie lo mire.
  const items: ResumenItem[] = [
    ...cheques,
    ...ordenadas.slice(0, Math.max(0, limit - cheques.length)).map((a) => ({
      id: a.id,
      severidad: a.severidad,
      titulo: a.titulo,
      mensaje: a.mensaje,
      href: alertaHref({ tipo: a.tipo, entidad_tipo: a.entidad_tipo, entidad_id: a.entidad_id }),
      marcable: true,
    })),
  ];

  return {
    count: noLeidas.length + cheques.length,
    items,
    allIds: [...cheques.map((c) => c.id), ...ordenadas.map((a) => a.id)],
  };
}

/**
 * Los cheques que SÍ suenan la campana.
 *
 * Pedido de Nico (27/08/2026): *"hay cargado en sistema un echeq que vence y no
 * sale una alerta como para acordarnos que hay que depositarlo. Y esa alerta
 * estaría bueno que siga saliendo hasta que nosotros le pongamos que lo
 * depositamos o lo cedimos"*. Tenía razón por partida doble: los avisos de
 * cheque se calculan en vivo y por eso estaban excluidos de la campana (ver
 * DOC_LIVE arriba), y en el pop-up del día quedaban reducidos a un número.
 *
 * Entra sólo lo que cumple las dos condiciones que hacen que valga la pena
 * insistir:
 *
 *  1. Es un cheque RECIBIDO todavía EN CARTERA: hay una acción concreta —
 *     depositarlo o cederlo— y no la va a hacer nadie más.
 *  2. Ya no tiene margen: vence hoy o se pasó de fecha.
 *
 * Lo demás (el que vence en cinco días, los nuestros por debitarse) sigue como
 * estaba: en la pantalla, en el pop-up y en el mail, pero sin campana.
 *
 * No son marcables —no existen en la tabla `alertas`— y eso acá es la
 * característica, no una limitación: el aviso se apaga cuando el cheque cambia
 * de estado, que es exactamente lo que se pidió. Por eso el badge puede seguir
 * llegando a cero: cuando el cheque se deposita, este aviso desaparece solo.
 */
function chequesEnLaCampana(
  live: Awaited<ReturnType<typeof getChequeAlertasLive>>,
  puedeVer: (a: { tipo: string; entidad_tipo?: string | null }) => boolean,
): ResumenItem[] {
  return live
    .filter((a) => a.depositoPendiente && puedeVer(a))
    .map((a) => ({
      id: a.id,
      severidad: a.severidad,
      titulo: a.titulo,
      mensaje: a.mensaje,
      href: alertaHref({
        tipo: a.tipo,
        entidad_tipo: a.entidad_tipo,
        entidad_id: a.id.replace(/^chequevenc-/, ""),
      }),
      marcable: false,
    }));
}

/**
 * Historial de leídas del usuario: alertas `pendiente` (sin docvenc-*) que el
 * usuario marcó leídas y todavía no borró de su historial.
 *
 * Toma el `CurrentUser` y no un id suelto —como sus dos hermanas de este archivo—
 * porque devuelve `mensaje`, que en las de préstamos trae los montos: con sólo el
 * id no hay forma de aplicar el filtro acá adentro y quedaba en manos del llamador
 * acordarse. Hoy el único se acordaba; el segundo no tenía por qué.
 */
export async function getHistorialLeidas(
  usuario: CurrentUser,
  limit = 200,
): Promise<AlertaItem[]> {
  const supabase = createAdminClient();
  const usuarioId = usuario.id;

  // 1) IDs que el usuario marcó leídos (acotado por lo que marcó a mano).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lecturas } = (await (supabase as any)
    .from("alerta_lecturas")
    .select("alerta_id, leida_en, descartada_en")
    .eq("usuario_id", usuarioId)
    .not("leida_en", "is", null)
    .is("descartada_en", null)
    .order("leida_en", { ascending: false })
    .limit(limit)) as { data: LecturaRow[] | null };

  const ids = (lecturas ?? []).map((l) => l.alerta_id);
  if (ids.length === 0) return [];

  const ordenLeida = new Map<string, number>();
  ids.forEach((id, i) => ordenLeida.set(id, i));

  // 2) Traer SÓLO esas alertas (no todas las pendientes) → no depende del tope de filas.
  const { data: alertas } = await supabase
    .from("alertas")
    .select("id, tipo, severidad, titulo, mensaje, fecha_disparo, fecha_vencimiento, entidad_tipo, entidad_id")
    .eq("estado", "pendiente")
    .not("tipo", "in", `(${DOC_LIVE.join(",")})`)
    .in("id", ids);

  return ((alertas ?? []) as AlertaItem[])
    .filter(visiblePara(usuario))
    .sort((a, b) => (ordenLeida.get(a.id) ?? 0) - (ordenLeida.get(b.id) ?? 0));
}
