/**
 * Los impuestos cortados por período — cuánto se pagó en cada mes.
 *
 * Pedido de la mamá de Bárbara (27/08/2026), hermano del de los cheques mes a
 * mes: la pantalla contestaba *"¿lo presenté?"* y nunca *"¿cuánto pagué?"*.
 * `impuesto_vencimientos` no tenía una sola columna de plata, así que para saber
 * cuánto se fue en impuestos en el mes había que sumarlo afuera del sistema.
 *
 * **La regla que hace que el número sirva: lo que no está cargado se cuenta
 * aparte, no como cero.** Un total que se come en silencio los que todavía no
 * tienen importe se lee como el gasto del mes y no lo es — es el gasto de la
 * parte que alguien alcanzó a cargar. Por eso cada período devuelve también
 * `sinImporte`, y la tira lo dice cuando hay alguno.
 */

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export type ImpuestoParaTotal = {
  /** Texto libre, tal como se cargó. Lo normal es "2026-06". */
  periodo: string | null;
  importe: number | null;
};

export type TotalPeriodo = {
  /** El período tal cual está en la base; `null` es "sin período". */
  periodo: string | null;
  /** Cómo se muestra: "Junio 2026", el texto crudo, o "Sin período". */
  label: string;
  /** Suma de los importes CARGADOS. */
  total: number;
  conImporte: number;
  sinImporte: number;
};

/**
 * "2026-06" → "Junio 2026". Cualquier otra cosa se muestra tal cual: `periodo`
 * es texto libre y alguien puede haber escrito "1er trimestre". Inventarle un
 * mes a eso sería peor que mostrarlo como vino.
 */
export function etiquetaPeriodo(periodo: string | null): string {
  if (!periodo) return "Sin período";
  const m = /^(\d{4})-(\d{2})$/.exec(periodo.trim());
  if (!m) return periodo;
  const mes = MESES[Number(m[2]) - 1];
  return mes ? `${mes} ${m[1]}` : periodo;
}

/**
 * Un renglón por período, del más viejo al más nuevo. Los que no tienen período
 * van al final: son la excepción y no tienen dónde ordenarse.
 */
export function totalesPorPeriodo(rows: ImpuestoParaTotal[]): TotalPeriodo[] {
  const porPeriodo = new Map<string, TotalPeriodo>();

  for (const r of rows) {
    const periodo = r.periodo?.trim() || null;
    // La clave es texto para poder usar el Map; `\x00` marca el sin período,
    // que no puede chocar con ningún valor real.
    const clave = periodo ?? "\x00";
    let t = porPeriodo.get(clave);
    if (!t) {
      t = { periodo, label: etiquetaPeriodo(periodo), total: 0, conImporte: 0, sinImporte: 0 };
      porPeriodo.set(clave, t);
    }
    // `null` es "no se cargó" y 0 es "se pagó cero", que son cosas distintas.
    if (r.importe === null || r.importe === undefined || !Number.isFinite(Number(r.importe))) {
      t.sinImporte += 1;
    } else {
      t.total += Number(r.importe);
      t.conImporte += 1;
    }
  }

  return [...porPeriodo.values()].sort((a, b) => {
    if (a.periodo === null) return 1;
    if (b.periodo === null) return -1;
    return a.periodo.localeCompare(b.periodo);
  });
}

/** Lo pagado en todo lo que se está mirando, para el pie de la tira. */
export function totalGeneral(rows: ImpuestoParaTotal[]): { total: number; sinImporte: number } {
  let total = 0;
  let sinImporte = 0;
  for (const r of rows) {
    if (r.importe === null || r.importe === undefined || !Number.isFinite(Number(r.importe))) sinImporte += 1;
    else total += Number(r.importe);
  }
  return { total, sinImporte };
}
