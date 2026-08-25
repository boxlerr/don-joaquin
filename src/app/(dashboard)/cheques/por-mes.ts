/**
 * Los cheques, cortados por mes de vencimiento.
 *
 * Pedido de la mamá de Bárbara (25/08/2026): *"lo de los cheques no sé si se
 * puede hacer mensual, mes a mes. Porque yo voy cargando los cheques y los
 * cheques están todos, todos juntos. **No te dice: este mes tenés tanto de
 * cheques.** Ni se va descontando"*.
 *
 * Las dos mitades de esa frase son dos reglas distintas:
 *
 *  1. **Por mes** — la pantalla era una cartera entera sin corte. Para saber
 *     cuánto caía en septiembre había que mirar la lista y sumar a ojo.
 *  2. **Que se descuente** — un cheque ya cobrado o ya debitado no puede seguir
 *     sumando. El número tiene que bajar solo a medida que se cierran, o al mes
 *     siguiente sigue diciendo lo mismo y deja de servir.
 */

import type { ChequeEstado, ChequeOrigen } from "./transiciones";

export type ChequeParaMes = {
  origen: ChequeOrigen;
  estado: ChequeEstado;
  importe: number;
  fecha_vencimiento: string;
};

/** Estados en los que el cheque ya no debe ni le deben nada a nadie. */
const CERRADOS: ChequeEstado[] = ["acreditado", "debitado", "rechazado", "anulado"];

/**
 * Si el cheque todavía pesa en el mes.
 *
 * Ojo con `entregado`, que significa cosas opuestas según el lado: un cheque
 * que recibimos y endosamos ya salió de nuestras manos y no lo vamos a cobrar,
 * mientras que uno nuestro entregado todavía no se debitó y hay que tener la
 * plata. El mismo estado, adentro y afuera de la cuenta.
 */
export function siguePendiente(c: Pick<ChequeParaMes, "origen" | "estado">): boolean {
  if (CERRADOS.includes(c.estado)) return false;
  if (c.origen === "recibido" && c.estado === "entregado") return false;
  return true;
}

export type MesCheques = {
  /** "YYYY-MM". */
  mes: string;
  /** Cómo se muestra: "Septiembre" si es de este año, "Ene 2027" si no. */
  label: string;
  /** Suma de los que siguen pendientes. Es el número que pidió. */
  monto: number;
  cantidad: number;
  /** Mes ya pasado con cheques todavía sin cerrar. */
  atrasado: boolean;
  /** El mes en curso. */
  esteMes: boolean;
};

const MES_LARGO = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const MES_CORTO = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export function etiquetaMes(mesISO: string, hoyISO: string): string {
  const [y, m] = mesISO.split("-").map(Number);
  const anioHoy = Number(hoyISO.slice(0, 4));
  const i = (m ?? 1) - 1;
  return y === anioHoy ? MES_LARGO[i]! : `${MES_CORTO[i]} ${y}`;
}

/**
 * Un renglón por mes que tenga cheques pendientes, del más viejo al más nuevo.
 *
 * Los meses sin nada pendiente no aparecen: la tira es para decidir, y un mes
 * en cero no cambia ninguna decisión. Los meses ya pasados que todavía tienen
 * cheques sin cerrar SÍ aparecen, marcados — son justamente los que se pierden
 * de vista en una lista sin cortes.
 */
export function resumenPorMes(cheques: ChequeParaMes[], hoyISO: string): MesCheques[] {
  const mesHoy = hoyISO.slice(0, 7);
  const porMes = new Map<string, { monto: number; cantidad: number }>();

  for (const c of cheques) {
    if (!c.fecha_vencimiento || !siguePendiente(c)) continue;
    const mes = c.fecha_vencimiento.slice(0, 7);
    const acc = porMes.get(mes) ?? { monto: 0, cantidad: 0 };
    acc.monto += Number(c.importe) || 0;
    acc.cantidad += 1;
    porMes.set(mes, acc);
  }

  return [...porMes.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, v]) => ({
      mes,
      label: etiquetaMes(mes, hoyISO),
      monto: v.monto,
      cantidad: v.cantidad,
      atrasado: mes < mesHoy,
      esteMes: mes === mesHoy,
    }));
}

/** Total pendiente de todos los meses juntos. */
export function totalPendiente(meses: MesCheques[]): number {
  return meses.reduce((a, m) => a + m.monto, 0);
}

/** Un mes de la curva: lo que entra y lo que sale. */
export type MesEvolucion = {
  mes: string;
  label: string;
  /** Recibidos pendientes que vencen ese mes: plata que entra. */
  aCobrar: number;
  /** Nuestros sin debitar que vencen ese mes: plata que sale. */
  aPagar: number;
  /** La diferencia. Negativo = ese mes sale más de lo que entra. */
  neto: number;
};

/**
 * La curva del final de la pantalla: cuánto vence por mes de cada lado.
 *
 * **Grafica vencimientos, no el estado histórico de la cartera.** Es una
 * distinción que importa: no guardamos en qué estado estaba cada cheque hace
 * tres meses, así que una línea de "cuánta cartera había en marzo" habría que
 * inventarla. Esto, en cambio, sale del dato que sí tenemos y contesta la
 * pregunta que se hacen: en qué meses entra plata y en cuáles sale.
 *
 * Se incluyen los meses vacíos del medio: un hueco en el eje miente sobre la
 * distancia entre dos vencimientos.
 */
export function evolucionPorMes(cheques: ChequeParaMes[], hoyISO: string): MesEvolucion[] {
  const acc = new Map<string, { aCobrar: number; aPagar: number }>();

  for (const c of cheques) {
    if (!c.fecha_vencimiento || !siguePendiente(c)) continue;
    const mes = c.fecha_vencimiento.slice(0, 7);
    const v = acc.get(mes) ?? { aCobrar: 0, aPagar: 0 };
    if (c.origen === "propio") v.aPagar += Number(c.importe) || 0;
    else v.aCobrar += Number(c.importe) || 0;
    acc.set(mes, v);
  }

  if (acc.size === 0) return [];

  const claves = [...acc.keys()].sort();
  const meses = mesesEntre(claves[0]!, claves[claves.length - 1]!);

  return meses.map((mes) => {
    const v = acc.get(mes) ?? { aCobrar: 0, aPagar: 0 };
    return {
      mes,
      label: etiquetaMes(mes, hoyISO),
      aCobrar: v.aCobrar,
      aPagar: v.aPagar,
      neto: v.aCobrar - v.aPagar,
    };
  });
}

/** Todos los meses de un extremo al otro, ambos incluidos. */
function mesesEntre(desde: string, hasta: string): string[] {
  const out: string[] = [];
  let [y, m] = desde.split("-").map(Number) as [number, number];
  const [yf, mf] = hasta.split("-").map(Number) as [number, number];
  // Tope duro: un vencimiento mal cargado en el año 2200 no puede colgar la
  // pantalla generando miles de meses.
  while ((y < yf || (y === yf && m <= mf)) && out.length < 120) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}
