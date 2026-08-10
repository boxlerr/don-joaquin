import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CurrentUser } from "@/lib/auth";
import type { Database } from "@/types/database";
import { DOC_LIVE } from "@/lib/alertas-lecturas";
import { getChequeAlertasLive, getDocAlertasLive } from "@/lib/alertas-live";
import { alertaColumnaDe, caducaAlPasar, esEfemeride, RRHH_EVENTOS_COL } from "@/lib/alertas-routing";
import { visiblePara } from "@/lib/alertas-visibilidad";
import { hoyArgentina } from "@/lib/fecha-ar";
import { alertaHref, type Severidad } from "@/app/(dashboard)/notificaciones/utils";
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
const MAX_ITEMS = 3;

/**
 * Excepciones al corte, por razones de DIBUJO y no de volumen.
 *
 * Los cumpleaños se muestran en una banda con las personas en grilla de DOS
 * columnas: con tres quedaba un casillero vacío al lado de un cartel que decía
 * "+1 más" — el cuarto estaba ahí y no entraba. Cuatro llena la grilla justa.
 */
const MAX_ITEMS_POR_COLUMNA: Record<string, number> = {
  [RRHH_EVENTOS_COL]: 4,
};

const maxItemsDe = (key: string): number => MAX_ITEMS_POR_COLUMNA[key] ?? MAX_ITEMS;

/** Semanas del mini gráfico de cada categoría. */
const SEMANAS_ATRASO = 12;

/**
 * Cómo se fue acumulando el atraso que HOY sigue abierto: para cada una de las
 * últimas 12 semanas, cuántos de estos avisos ya estaban vencidos en ese momento.
 *
 * Es lo único honesto que se puede dibujar. NO hay historial de alertas en la
 * base —resolver una alerta pisa `estado` y no deja fecha; no hay snapshots ni
 * `resuelta_en`— así que "cuántos vencidos había cada semana" no se puede saber.
 * Esto se reconstruye desde `fecha_vencimiento`, que es una fecha del negocio y
 * no depende de que ningún proceso haya corrido (el cron de alertas estuvo caído
 * meses: cualquier serie armada sobre `fecha_disparo` dibujaría los días en que
 * alguien apretó un botón).
 *
 * Dos propiedades que hay que tener presentes al mostrarla:
 *
 *  - El último punto ES `vencidos`: mismo predicado, corrido en el tiempo. El
 *    gráfico explica el número que tiene al lado, no agrega otro.
 *  - NUNCA baja. Está armada sobre los que siguen abiertos, así que lo que se
 *    venció y se resolvió en el medio no está. Es la ANTIGÜEDAD DEL ATRASO VIVO,
 *    no una tendencia: rotularla como "mejora/empeora" sería mentir.
 */
export function serieAtraso(
  items: { diasRestantes: number | null; efemeride: boolean }[],
): number[] | null {
  const serie: number[] = [];
  for (let k = 0; k < SEMANAS_ATRASO; k++) {
    // Corte de la semana k: hoy − 7·(11−k) días. En k = 11 el corte es hoy.
    const offset = 7 * (SEMANAS_ATRASO - 1 - k);
    let n = 0;
    for (const i of items) {
      // vencido al corte ⟺ fecha_venc < hoy − offset ⟺ diasRestantes < −offset.
      if (i.efemeride) continue; // un cumpleaños no vence nunca
      if (i.diasRestantes === null) continue; // sin fecha no cae en ninguna semana
      if (i.diasRestantes < -offset) n++;
    }
    serie.push(n);
  }
  // Sin nada vencido hoy no hay atraso que contar: los cumpleaños y todo lo que
  // es 100% a futuro caen acá y no llevan gráfico.
  return serie[SEMANAS_ATRASO - 1] === 0 ? null : serie;
}

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
   * 12 puntos semanales con la antigüedad del atraso vivo. El último ES
   * `vencidos`. `null` cuando no hay nada vencido. Ver `serieAtraso`.
   */
  atraso: number[] | null;
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
};

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
 * La severidad ordena los ítems de cada grupo y `efemeride` los deja afuera del
 * contador de vencidos. Ninguno de los dos se dibuja: no viajan.
 */
type ItemOrden = ItemResumen & { severidad: Severidad; efemeride: boolean };

const NOMBRE_POR_COLUMNA = new Map(ALERTA_COLUMNAS.map((c) => [c.key, c.nombre]));

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

  const [{ data: pendientes }, docLive, chequeLive] = await Promise.all([
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
    const efemeride = esEfemeride(a);
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
      efemeride,
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
    // Una efeméride NUNCA es "vencida". Ojo que sí tienen `fecha_vencimiento`
    // (lib/alertas.ts la carga con el día del evento), así que mirar sólo la
    // fecha no alcanza: la de ayer ya se filtró arriba, pero el cumpleaños de HOY
    // llega con 0 y hay que dejarlo explícito — está siendo hoy, no vencido. El
    // contador es lo que el modal pinta de rojo y lo que empuja al grupo arriba
    // de todo: contaminarlo abría el pop-up con los cumpleaños primero.
    const vencidosGrupo = items.filter(
      (i) => !i.efemeride && i.diasRestantes !== null && i.diasRestantes < 0,
    ).length;

    items.sort((a, b) => {
      const s = SEV_ORDER[a.severidad] - SEV_ORDER[b.severidad];
      if (s !== 0) return s;
      // Sin fecha van al final: no compiten con algo que vence pasado mañana.
      if (a.diasRestantes === null) return b.diasRestantes === null ? 0 : 1;
      if (b.diasRestantes === null) return -1;
      return a.diasRestantes - b.diasRestantes;
    });

    // `restantes` se deriva de lo que REALMENTE se recortó, no de la constante:
    // con un corte por columna, restar el número fijo dibujaba un "+1 más" que
    // no correspondía a nadie.
    const visibles = items.slice(0, maxItemsDe(key));

    grupos.push({
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
      // La serie se computa sobre TODOS los ítems del grupo, no sobre los que se
      // dibujan: si no, contaría otra cosa que el número que tiene al lado.
      atraso: serieAtraso(items),
    });

    total += items.length;
    vencidos += vencidosGrupo;
  }

  // Los cumpleaños se dibujan con la silueta de cada persona (chofer, oficina o
  // taller), así que hace falta su rol. Va DESPUÉS del recorte a propósito: se
  // piden los tres que el pop-up va a mostrar, no los treinta del mes. Si la
  // consulta falla, el pop-up dibuja la silueta de oficina y sigue.
  const efemerides = grupos.find((g) => g.key === RRHH_EVENTOS_COL);
  if (efemerides) {
    const ids = efemerides.items.map((i) => i.entidadId).filter((v): v is string => !!v);
    if (ids.length > 0) {
      const { data: personas } = await supabase.from("choferes").select("id, rol").in("id", ids);
      const rolPorId = new Map((personas ?? []).map((p) => [p.id, p.rol]));
      for (const item of efemerides.items) {
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

  return { total, vencidos, grupos };
}
