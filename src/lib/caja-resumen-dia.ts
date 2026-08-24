/**
 * El resumen de la caja de un día: lo que entró, lo que salió y con cuánto
 * quedó.
 *
 * Vive acá y sin `server-only` porque es la única parte del correo de cierre que
 * tiene cuentas adentro, y las cuentas de plata se testean. El correo en sí lo
 * arma `lib/aviso-caja.ts`.
 *
 * Por qué existe (Julián, 24/08/2026): la primera versión mandaba un mail por
 * cada movimiento. Con la caja cargándose todo el día eso es una bandeja
 * inutilizable — "sería súper molesto"—, así que ahora sale UNO solo, al cierre,
 * con todo junto.
 */

export type MovimientoDia = {
  tipo: "ingreso" | "egreso";
  monto: number;
  /** "diaria" (la chica) o "grande" (la general). */
  caja: string;
  concepto: string;
  /** Ya resuelto a texto: "Cubiertas", "Cobro a cliente", lo que se escribió… */
  tipoLabel: string;
  medio: string;
  /** Quién lo cargó, con nombre. */
  usuario: string | null;
  /** true = oculto: sólo va en la copia del administrador. */
  privado?: boolean | null;
  created_by?: string | null;
};

export type TotalesCaja = {
  ingresos: number;
  egresos: number;
  /** Ingresos − egresos del día. */
  neto: number;
  movimientos: number;
};

export type ResumenDia = TotalesCaja & {
  /** Los mismos totales, abiertos por caja. */
  porCaja: Record<"diaria" | "grande", TotalesCaja>;
};

const enCero = (): TotalesCaja => ({ ingresos: 0, egresos: 0, neto: 0, movimientos: 0 });

function sumar(acc: TotalesCaja, m: MovimientoDia): void {
  if (m.tipo === "ingreso") acc.ingresos += m.monto;
  else acc.egresos += m.monto;
  acc.neto = acc.ingresos - acc.egresos;
  acc.movimientos += 1;
}

/**
 * Totales del día, en total y caja por caja.
 *
 * Las transferencias entre cajas entran como cualquier otro movimiento: son un
 * egreso real de una caja y un ingreso real de la otra, y en el total del día se
 * cancelan solas. Sacarlas escondería que la plata se movió.
 */
export function resumirDia(movimientos: MovimientoDia[]): ResumenDia {
  const total = enCero();
  const porCaja: ResumenDia["porCaja"] = { diaria: enCero(), grande: enCero() };

  for (const m of movimientos) {
    sumar(total, m);
    sumar(porCaja[m.caja === "grande" ? "grande" : "diaria"], m);
  }

  return { ...total, porCaja };
}

/**
 * Qué movimientos le muestra el correo a cada destinatario.
 *
 * Lo mismo que ve en pantalla, ni más ni menos (ver caja/visibilidad.ts):
 *  · lo oculto es sólo del administrador;
 *  · la caja general (`grande`) es de quien tenga esa subsección.
 *
 * Los TOTALES no pasan por acá a propósito: son los reales, como las tarjetas de
 * la caja. Contra ese número se arquea el cajón, así que no puede depender de
 * quién esté mirando.
 */
export function movimientosParaDestinatario(
  movimientos: MovimientoDia[],
  quien: { esAdmin: boolean; veCajaGrande: boolean; direccion: Set<string> },
): MovimientoDia[] {
  return movimientos.filter((m) => {
    if (m.caja === "grande" && !quien.veCajaGrande) return false;
    if (quien.esAdmin) return true;
    if (m.privado === true) return false;
    if (m.privado === false) return true;
    // Sin decidir: la regla por autor, igual que en la caja chica.
    return !m.created_by || !quien.direccion.has(m.created_by);
  });
}
