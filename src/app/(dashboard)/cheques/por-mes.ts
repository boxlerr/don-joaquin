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
