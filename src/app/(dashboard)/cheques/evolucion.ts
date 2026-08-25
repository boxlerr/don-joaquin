/**
 * Cómo estaba la cartera al cierre de cada mes.
 *
 * Pedido de Julián (25/08/2026): las cuatro líneas del mockup —En cartera, Por
 * vencer, Vencidos, Nuestros— mes a mes.
 *
 * **Se reconstruye con `cheque_historial_estado`, que registra cada transición
 * con su fecha.** El estado de un cheque a una fecha es el `estado_nuevo` de su
 * última transición anterior a esa fecha; si no tuvo ninguna, sigue en el
 * estado con el que nació: en cartera si lo recibimos, emitido si es nuestro.
 *
 * El límite honesto: la historia arranca cuando arrancó el sistema. Un cheque
 * cargado en agosto no tiene transiciones de marzo, así que antes de existir en
 * el sistema no suma en ningún mes — por eso los meses previos a la carga
 * aparecen vacíos, y no por un error de la cuenta.
 */

import type { ChequeEstado, ChequeOrigen } from "./transiciones";

export type ChequeParaEvolucion = {
  id: string;
  origen: ChequeOrigen;
  estado: ChequeEstado;
  importe: number;
  fecha_vencimiento: string;
  /** Desde cuándo el sistema sabe de este cheque ("YYYY-MM-DD"). */
  desde: string;
};

export type TransicionCheque = {
  cheque_id: string;
  estado_nuevo: ChequeEstado;
  /** "YYYY-MM-DD". */
  fecha: string;
};

/** Estados en los que el cheque ya no debe ni le deben nada. */
const CERRADOS: ChequeEstado[] = ["acreditado", "debitado", "rechazado", "anulado"];

/** Con el que nace cada cheque, antes de cualquier transición. */
function estadoInicial(origen: ChequeOrigen): ChequeEstado {
  return origen === "propio" ? "emitido" : "cartera";
}

/**
 * En qué estado estaba el cheque al cierre de `hastaISO`.
 *
 * `transiciones` puede venir en cualquier orden: se toma la de fecha más alta
 * que no pase el corte. Ante dos el mismo día gana la última del arreglo, que
 * es el orden en que se insertaron.
 */
export function estadoEnFecha(
  cheque: Pick<ChequeParaEvolucion, "origen">,
  transiciones: TransicionCheque[],
  hastaISO: string,
): ChequeEstado {
  let mejor: TransicionCheque | null = null;
  for (const t of transiciones) {
    if (t.fecha > hastaISO) continue;
    if (!mejor || t.fecha >= mejor.fecha) mejor = t;
  }
  return mejor ? mejor.estado_nuevo : estadoInicial(cheque.origen);
}

export type MesCartera = {
  /** "YYYY-MM". */
  mes: string;
  label: string;
  /** Recibidos sin cobrar que a esa altura todavía no vencían. */
  enCartera: number;
  /** Recibidos sin cobrar que vencían dentro de ese mes. */
  porVencer: number;
  /** Recibidos sin cobrar que ya habían vencido. */
  vencidos: number;
  /** Nuestros sin debitar que todavía no vencían. */
  nuestros: number;
};

const MES_CORTO = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

/** Último día del mes, en ISO. */
export function finDeMes(mesISO: string): string {
  const [y, m] = mesISO.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m, 0));
  return d.toISOString().slice(0, 10);
}

function etiqueta(mesISO: string, anioRef: number): string {
  const [y, m] = mesISO.split("-").map(Number) as [number, number];
  const corto = MES_CORTO[m - 1]!;
  return y === anioRef ? corto : `${corto} ${String(y).slice(2)}`;
}

/** Los `cantidad` meses que terminan en el mes de `hastaISO`, del más viejo al más nuevo. */
export function ultimosMeses(hastaISO: string, cantidad: number): string[] {
  const [y, m] = hastaISO.slice(0, 7).split("-").map(Number) as [number, number];
  const out: string[] = [];
  for (let i = cantidad - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    out.push(d.toISOString().slice(0, 7));
  }
  return out;
}

/**
 * Las cuatro series, un punto por mes.
 *
 * Un cheque sólo cuenta en los meses en que el sistema ya lo conocía: antes de
 * `desde` no existía y sumarlo inventaría cartera que nadie tenía.
 */
export function evolucionCartera(
  cheques: ChequeParaEvolucion[],
  transiciones: TransicionCheque[],
  meses: string[],
  anioRef: number,
): MesCartera[] {
  const porCheque = new Map<string, TransicionCheque[]>();
  for (const t of transiciones) {
    const arr = porCheque.get(t.cheque_id);
    if (arr) arr.push(t);
    else porCheque.set(t.cheque_id, [t]);
  }

  return meses.map((mes) => {
    const cierre = finDeMes(mes);
    const inicio = `${mes}-01`;
    const punto: MesCartera = {
      mes,
      label: etiqueta(mes, anioRef),
      enCartera: 0,
      porVencer: 0,
      vencidos: 0,
      nuestros: 0,
    };

    for (const c of cheques) {
      if (c.desde > cierre) continue;

      const estado = estadoEnFecha(c, porCheque.get(c.id) ?? [], cierre);
      if (CERRADOS.includes(estado)) continue;
      // Un recibido endosado dejó de ser nuestro problema; uno propio entregado
      // todavía no se debitó. El mismo estado, adentro y afuera de la cuenta.
      if (c.origen === "recibido" && estado === "entregado") continue;

      const importe = Number(c.importe) || 0;

      if (c.origen === "propio") {
        punto.nuestros += importe;
        continue;
      }

      if (c.fecha_vencimiento < inicio) punto.vencidos += importe;
      else if (c.fecha_vencimiento <= cierre) punto.porVencer += importe;
      else punto.enCartera += importe;
    }

    return punto;
  });
}
