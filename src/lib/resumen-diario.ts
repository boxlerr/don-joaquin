import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CurrentUser } from "@/lib/auth";
import type { Database } from "@/types/database";
import { DOC_LIVE } from "@/lib/alertas-lecturas";
import { getChequeAlertasLive, getDocAlertasLive } from "@/lib/alertas-live";
import {
  alertaColumnaDe,
  AUSENCIAS_COL,
  caducaAlPasar,
  esAvisoEnGracia,
  esEfemeride,
  RRHH_EVENTOS_COL,
} from "@/lib/alertas-routing";
import { visiblePara } from "@/lib/alertas-visibilidad";
import { hoyArgentina } from "@/lib/fecha-ar";
import { novedadesRecientes, novedadesVisibles, type Novedad } from "@/lib/novedades";
import { alertaHref, porUrgencia, type Severidad } from "@/app/(dashboard)/notificaciones/utils";
import { ALERTA_COLUMNAS } from "@/app/(dashboard)/configuracion/notificaciones/constants";

/**
 * Digest del día: lo mismo que ve el usuario en /notificaciones, pero AGRUPADO
 * por categoría y recortado, para el pop-up que aparece al entrar.
 *
 * Cuatro decisiones que no son obvias:
 *
 *  1. NO se filtra por la matriz de notificaciones
 *     (`notificaciones_matriz_por_usuario`). Esa matriz decide qué le llega a
 *     cada uno POR MAIL — es una preferencia de correo, no un permiso. En la web
 *     se ve todo lo que la persona tenga permiso de ver; si acá se aplicara,
 *     quien nunca configuró la matriz abriría el sistema y no vería nada.
 *
 *     Lo que sí viaja es lo que cada uno eligió APAGAR en el pop-up (`ocultas`),
 *     que es otra cosa: nace todo prendido y lo decide la persona desde el mismo
 *     cartel. Pedido de Nico (27/08/2026): a él no le sirven los avisos de
 *     documentación y a Anabela no le sirven los de cheques ni préstamos, y por
 *     permisos son indistinguibles — tienen el mismo rol.
 *
 *  2. Documentos y cheques se piden EN VIVO (`alertas-live`) y se excluyen de la
 *     tabla vía DOC_LIVE, igual que en la pantalla: su fila se escribe una sola
 *     vez y el texto queda congelado en "vence en 6 días" para siempre.
 *     `soloHitos: false` porque acá mostramos el ESTADO completo — los hitos son
 *     la cadencia del mail, no de la pantalla.
 *
 *  3. Los nombres de las categorías salen de ALERTA_COLUMNAS (la config de
 *     notificaciones) y el ruteo de `alertaColumnaDe`: si mañana se abre una
 *     categoría nueva, el pop-up la muestra sola. Hay precedente de que lib
 *     importe de app (lib/notificaciones.ts importa de notificaciones/utils).
 *
 *  4. Las efemérides (cumpleaños, aniversarios, fin del período de prueba) se
 *     muestran todos los días MIENTRAS FALTEN (los hitos 14/7/0 son la cadencia
 *     del mail, no la de la pantalla) y desaparecen apenas la fecha pasa. La
 *     asimetría es a propósito: un documento vencido se sigue reclamando porque
 *     hay algo que hacer; una efeméride que pasó no se avisa más en ningún lado.
 *
 * Hoy son ~48 avisos y pueden ser 200: por eso cada grupo viaja recortado a
 * MAX_ITEMS y con `restantes` para que la UI diga "y 13 más".
 */

type AlertaTipo = Database["public"]["Enums"]["alerta_tipo"];

/**
 * Ítems por grupo. Es EL corte, no una sugerencia: el pop-up dibuja lo que le
 * llega y muestra `restantes` como "y N más". Si el recorte se hiciera también
 * del lado del cliente, `restantes` mentiría por la diferencia.
 */
const MAX_ITEMS = 5;
// Cinco y no tres: con tres, los cuatro cumpleaños del mes mostraban tres y un
// "y 1 más" al lado de un casillero vacío, y Julián lo pidió directo (27/08/2026):
// *"en cumpleaños que entren todos los que haya, y lo mismo en vacaciones, ¿por
// qué se cortan ahí?"*. Con cinco entran enteras las categorías de personas —que
// son pocas y se leen de a una— y las de volumen (impuestos, préstamos) siguen
// mostrando su cabeza y el resto en el "y N más".
//
// Vale para TODAS por igual: cada categoría es una tarjeta de la misma grilla y
// la que muestre una fila de más estira su renglón entero, dejando a las vecinas
// con un hueco blanco abajo.


const SEV_ORDER: Record<Severidad, number> = { critica: 0, advertencia: 1, info: 2 };

/**
 * Una fila del pop-up: título, cuándo y a dónde ir. Nada más.
 *
 * Queda afuera `mensaje` a propósito: el título ya identifica el aviso
 * ("Vencimiento: VTV — AF696CR") y el mensaje de los préstamos lleva montos —
 * si no se dibuja, no tiene por qué cruzar el cable. `severidad` y
 * `fecha_vencimiento` se usan acá adentro para ordenar y tampoco viajan.
 */
export type ItemResumen = {
  id: string;
  titulo: string;
  /**
   * Negativo = vencido hace N días; 0 = vence hoy; null = el aviso no tiene fecha.
   * En una efeméride nunca es negativo: la que ya pasó no viaja, y el 0 quiere
   * decir "es hoy", no "venció hoy".
   */
  diasRestantes: number | null;
  /**
   * El día del evento (YYYY-MM-DD). Viaja además de `diasRestantes` porque en un
   * cumpleaños la fecha ES el dato: "en 4 días" no sirve para anotarlo en la
   * agenda, "lun 11/8" sí.
   */
  fecha: string | null;
  href: string | null;
  /** Id de la persona/entidad del aviso. Lo usa el pop-up para su silueta. */
  entidadId: string | null;
  /**
   * Rol de la persona (chofer / administrativo / mantenimiento / fletero). Sólo
   * se completa en las efemérides, que es donde el pop-up dibuja la silueta;
   * en el resto queda `undefined`.
   */
  rol?: string | null;
};

export type GrupoResumen = {
  /** Key de la columna de la matriz (`vencimiento_docs`, `rrhh_eventos`…). */
  key: string;
  nombre: string;
  total: number;
  vencidos: number;
  items: ItemResumen[];
  /** Cuántos quedaron fuera de `items` (total - items.length). */
  restantes: number;
  /**
   * De los VENCIDOS, cuántos quedaron fuera de `items`.
   *
   * Va aparte de `restantes` porque son dos preguntas distintas y mezclarlas se
   * leía mal: Compliance mostraba "4 vencidos" arriba y "y 11 más" abajo, y la
   * lectura natural era "11 vencidos más" —o sea, ¿no eran 4?—. Los 11 eran
   * todos los otros avisos de la categoría, vencidos o no. Con este número el
   * pie puede hablar de lo mismo que el título.
   */
  restantesVencidos: number;
};

/**
 * No viaja la fecha del día: el pop-up se muestra una vez por día y esa marca la
 * lleva el cliente con SU fecha local. El server no sirve para eso — en Vercel
 * corre en UTC (por eso existe lib/fecha-ar.ts), así que a partir de las 21hs de
 * Argentina ya devuelve el día siguiente y el pop-up quedaría marcado como visto
 * para mañana antes de que amanezca.
 */
export type ResumenDiario = {
  total: number;
  vencidos: number;
  grupos: GrupoResumen[];
  /**
   * Qué cambió en el sistema, ya filtrado por lo que esta persona puede abrir.
   * Viaja con el resumen (y no se lee de `@/lib/novedades` en el cliente) porque
   * el filtro es de permisos: ver `getResumenDiario`.
   */
  novedades: Novedad[];
  /**
   * Categorías que ESTA persona eligió no ver en el pop-up. Los grupos viajan
   * igual (el filtro lo aplica la pantalla, para que tildar sea instantáneo) y
   * también hacen falta para poder volver a prenderlas: una categoría apagada
   * que hoy no tiene avisos no aparecería en ningún lado sin esta lista.
   */
  ocultas: string[];
};

/** Parámetro donde vive, por usuario, lo que eligió apagar del pop-up. */
export const RESUMEN_OCULTAS_CLAVE = "resumen_dia_ocultas_por_usuario";

/**
 * Lo que apagó un usuario, leído del JSON del parámetro.
 *
 * Guarda lo APAGADO y no lo prendido a propósito: una categoría nueva le aparece
 * a todo el mundo sin que nadie tenga que ir a tildarla — el mismo criterio con
 * el que `tipoHabilitado` falla abierto. Y si el JSON viene roto, se devuelve
 * vacío: peor que mostrar de más es esconder sin que nadie lo haya pedido.
 */
export function ocultasDeUsuario(valor: string | null | undefined, usuarioId: string): string[] {
  if (!valor) return [];
  try {
    const parsed = JSON.parse(valor);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];
    const propias = (parsed as Record<string, unknown>)[usuarioId];
    if (!Array.isArray(propias)) return [];
    return propias.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

/** Fila ya normalizada: tabla y "live" tienen forma distinta, acá se emparejan. */
type Fila = {
  id: string;
  tipo: AlertaTipo;
  severidad: Severidad;
  titulo: string;
  fecha_vencimiento: string | null;
  entidad_tipo: string | null;
  entidad_id: string | null;
};

/**
 * La severidad ordena los ítems de cada grupo y `noVence` los deja afuera del
 * contador de vencidos. Ninguno de los dos se dibuja: no viajan.
 *
 * `noVence` son las dos cosas que tienen fecha pasada sin ser un atraso: una
 * efeméride (el cumpleaños de hoy no "venció") y la cuota en período de gracia
 * (venció ayer y el débito puede no verse todavía en el banco).
 */
export type ItemOrden = ItemResumen & { severidad: Severidad; noVence: boolean };

const NOMBRE_POR_COLUMNA = new Map(ALERTA_COLUMNAS.map((c) => [c.key, c.nombre]));

/**
 * Ordena una categoría, la recorta a MAX_ITEMS y cuenta lo que quedó afuera.
 *
 * Sale de `getResumenDiario` —y se exporta— porque es EL punto donde un aviso
 * puede desaparecer del cartel sin que nadie se entere: acá se decide cuáles
 * cinco de veinte se ven.
 */
export function armarGrupo(key: string, items: ItemOrden[]): GrupoResumen {
  // Una efeméride NUNCA es "vencida". Ojo que sí tienen `fecha_vencimiento`
  // (lib/alertas.ts la carga con el día del evento), así que mirar sólo la
  // fecha no alcanza: la de ayer ya se filtró antes, pero el cumpleaños de HOY
  // llega con 0 y hay que dejarlo explícito — está siendo hoy, no vencido. El
  // contador es lo que el modal pinta de rojo y lo que empuja al grupo arriba
  // de todo: contaminarlo abría el pop-up con los cumpleaños primero.
  const esVencido = (i: ItemOrden) =>
    !i.noVence && i.diasRestantes !== null && i.diasRestantes < 0;
  const vencidosGrupo = items.filter(esVencido).length;

  // El MISMO orden con el que la pantalla los dibuja (`porUrgencia`): elegir con
  // un criterio y mostrar con otro fue exactamente el bug. La severidad quedó de
  // desempate —y no arriba de todo, como estaba— porque dentro de una categoría
  // es casi siempre función de la fecha (vencido o a menos de 7 días = crítica),
  // y cuando mandaba ella lo que vencía hoy entraba último entre los críticos.
  items.sort((a, b) => porUrgencia(a, b) || SEV_ORDER[a.severidad] - SEV_ORDER[b.severidad]);

  // `restantes` se deriva de lo que REALMENTE se recortó: si el grupo tiene
  // menos ítems que el corte, restar la constante dibujaría un "y 1 más" que
  // no corresponde a nadie.
  const visibles = items.slice(0, MAX_ITEMS);

  return {
    key,
    nombre: NOMBRE_POR_COLUMNA.get(key) ?? "Otros avisos",
    total: items.length,
    vencidos: vencidosGrupo,
    items: visibles.map((i) => ({
      id: i.id,
      titulo: i.titulo,
      diasRestantes: i.diasRestantes,
      fecha: i.fecha,
      entidadId: i.entidadId,
      href: i.href,
    })),
    restantes: items.length - visibles.length,
    restantesVencidos: Math.max(0, vencidosGrupo - visibles.filter(esVencido).length),
  };
}

/**
 * Días hasta la fecha, medidos contra HOY EN ARGENTINA.
 *
 * El `diasRestantes` de la pantalla mide contra `new Date()` y ahí está bien:
 * corre en el navegador, que está en hora local. Acá corre en el server, que en
 * Vercel es UTC, así que de las 21hs ART a medianoche el pop-up entero se corría
 * un día: lo que vencía HOY salía "Vencido hace 1 día" en rojo, y el cumpleaños
 * de hoy se apagaba tres horas antes de que terminara el día. La resta es entre
 * días calendario armados en UTC, así no la mueve el huso ni el horario de verano.
 */
function diasHasta(fechaVencimiento: string | null, hoyMs: number): number | null {
  if (!fechaVencimiento) return null;
  // slice(0, 10) porque la columna es `date` pero las alertas live podrían traer
  // un timestamp: sin el corte, Number("04T00:00:00") es NaN y el aviso quedaba
  // "sin fecha" (ni vencido ni ordenado) en vez de fallar a la vista.
  const [y, m, d] = fechaVencimiento.slice(0, 10).split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return Math.round((Date.UTC(y, m - 1, d) - hoyMs) / 86400000);
}

export async function getResumenDiario(user: CurrentUser): Promise<ResumenDiario> {
  const supabase = createAdminClient();

  const [{ data: pendientes }, docLive, chequeLive, { data: prefResumen }] = await Promise.all([
    supabase
      .from("alertas")
      .select("id, tipo, severidad, titulo, fecha_vencimiento, entidad_tipo, entidad_id")
      .eq("estado", "pendiente")
      .not("tipo", "in", `(${DOC_LIVE.join(",")})`)
      // Tope explícito (Supabase corta en 1000 igual): el orden por severidad
      // asegura que si algún día se llega al corte, lo que se pierda sea lo menos
      // urgente y no un vencimiento crítico.
      .order("severidad", { ascending: false })
      .order("fecha_disparo", { ascending: false })
      .limit(1000),
    getDocAlertasLive(supabase, { soloHitos: false }),
    getChequeAlertasLive(supabase, { soloHitos: false }),
    supabase
      .from("parametros_sistema")
      .select("valor")
      .eq("clave", RESUMEN_OCULTAS_CLAVE)
      .maybeSingle(),
  ]);

  // Los ids sintéticos llevan adentro el id real de la entidad, que es lo que
  // necesita `alertaHref` para abrir el documento o el cheque desde el pop-up.
  const filas: Fila[] = [
    ...((pendientes ?? []) as Fila[]),
    ...docLive.map((a) => ({ ...a, entidad_id: a.id.replace(/^docvenc-/, "") })),
    ...chequeLive.map((a) => ({ ...a, entidad_id: a.id.replace(/^chequevenc-/, "") })),
  ];

  // Confidencialidad antes que nada: el título viaja al cliente y el de los
  // préstamos nombra el banco y la cuota.
  const puedeVer = visiblePara(user);

  // Una sola lectura del día para todas las filas: si "hoy" se recalculara por
  // ítem, un resumen que cruce la medianoche mezclaría dos días.
  const [hy, hm, hd] = hoyArgentina().split("-").map(Number);
  const hoyMs = Date.UTC(hy, hm - 1, hd);

  const porColumna = new Map<string, ItemOrden[]>();
  for (const a of filas) {
    if (!puedeVer(a)) continue;
    const noVence = esEfemeride(a) || esAvisoEnGracia(a);
    const dias = diasHasta(a.fecha_vencimiento, hoyMs);
    // La efeméride que ya pasó no se avisa más en ningún lado. Las apaga
    // `resolverEfemeridesPasadas`, pero eso corre dentro de `generarAlertas()` y
    // lo dispara el cron de las 8 AR: quien entraba antes se comía el cumpleaños
    // de ayer pintado de rojo como "Vencido hace 1 día" — y encima el modal
    // marcaba el día como visto, así que el pop-up corregido ya no volvía. Si el
    // cron no corre, era todas las mañanas. Mismo corte que el mail
    // (`efemerideEnMail` en lib/notificaciones.ts): acá no se puede depender de
    // que un proceso de fondo haya limpiado la tabla.
    // Incluye las ausencias programadas: el aviso sirve para saber que alguien
    // no va a estar, así que apenas arranca deja de servir. Una del 13 de julio
    // seguía apareciendo el 5 de agosto, en rojo.
    if (caducaAlPasar(a) && dias !== null && dias < 0) continue;
    const columna = alertaColumnaDe(a);
    const item: ItemOrden = {
      id: a.id,
      titulo: a.titulo,
      severidad: a.severidad,
      noVence,
      diasRestantes: dias,
      fecha: a.fecha_vencimiento ? a.fecha_vencimiento.slice(0, 10) : null,
      entidadId: a.entidad_id,
      href: alertaHref({ tipo: a.tipo, entidad_tipo: a.entidad_tipo, entidad_id: a.entidad_id }),
    };
    const acc = porColumna.get(columna);
    if (acc) acc.push(item);
    else porColumna.set(columna, [item]);
  }

  const grupos: GrupoResumen[] = [];
  let total = 0;
  let vencidos = 0;

  for (const [key, items] of porColumna) {
    const grupo = armarGrupo(key, items);
    grupos.push(grupo);
    total += grupo.total;
    vencidos += grupo.vencidos;
  }

  // Los grupos que se dibujan por PERSONA (cumpleaños y ausencias) llevan la
  // silueta de cada uno, así que hace falta su rol. Va DESPUÉS del recorte a
  // propósito: se piden los que el pop-up va a mostrar, no los treinta del mes.
  // Si la consulta falla, el pop-up dibuja la silueta de oficina y sigue.
  const dePersonas = grupos.filter((g) => g.key === RRHH_EVENTOS_COL || g.key === AUSENCIAS_COL);
  const idsPersonas = [
    ...new Set(
      dePersonas.flatMap((g) => g.items.map((i) => i.entidadId).filter((v): v is string => !!v)),
    ),
  ];
  if (idsPersonas.length > 0) {
    const { data: personas } = await supabase
      .from("choferes")
      .select("id, rol")
      .in("id", idsPersonas);
    const rolPorId = new Map((personas ?? []).map((p) => [p.id, p.rol]));
    for (const grupo of dePersonas) {
      for (const item of grupo.items) {
        item.rol = item.entidadId ? (rolPorId.get(item.entidadId) ?? null) : null;
      }
    }
  }

  // Urgencia: primero lo que ya se venció (y cuanto más vencido haya, más arriba),
  // después por volumen. El nombre desempata para que el orden no baile entre
  // recargas cuando dos grupos empatan.
  grupos.sort((a, b) => {
    if ((a.vencidos > 0) !== (b.vencidos > 0)) return a.vencidos > 0 ? -1 : 1;
    if (a.vencidos !== b.vencidos) return b.vencidos - a.vencidos;
    if (a.total !== b.total) return b.total - a.total;
    return a.nombre.localeCompare(b.nombre, "es");
  });

  // Qué cambió en el sistema. El filtro por permisos se hace ACÁ y no en el
  // navegador: los permisos viven en el server, y así al cliente no le viaja ni
  // el título de una pantalla que esta persona no puede abrir. La ventana es de
  // días; cuáles de esas ya vio cada uno lo decide el pop-up, que es el que
  // guarda la marca (ver `novedadesNuevas` en ResumenDiarioModal).
  const novedades = novedadesVisibles(novedadesRecientes(hoyArgentina()), {
    secciones: user.secciones,
    areas: user.permisos,
  });

  return {
    total,
    vencidos,
    grupos,
    novedades,
    ocultas: ocultasDeUsuario(prefResumen?.valor, user.id),
  };
}
