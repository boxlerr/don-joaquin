// Lógica pura de los flujos de viaje (sin DB ni efectos): cierre/facturación,
// rendición de viáticos y derivación de la cuenta corriente del cliente.
// Es la fuente de verdad de las reglas — la usan las server actions y los
// diálogos del cliente, y se testea en flujo-logic.test.ts.

import type { ViajeBasico } from "./types";

// ── Cierre / facturación de un viaje ─────────────────────────────────────────
// Tener factura (monto > 0) y no ser vacío ⇒ facturado. Sólo se cobra (impacta
// caja) si hay factura y el usuario marcó "ya cobré".
export function computeCierre(opts: {
  montoActual: number | null;
  /** Monto ingresado ahora; null = no se tocó (se usa el actual). */
  montoIngresado: number | null;
  esVacio: boolean;
  cobrado: boolean;
}): { montoFinal: number; facturado: boolean; cobrado: boolean } {
  const montoFinal =
    opts.montoIngresado != null ? Math.max(0, opts.montoIngresado) : Number(opts.montoActual ?? 0);
  const facturado = montoFinal > 0 && !opts.esVacio;
  const cobrado = opts.cobrado && facturado;
  return { montoFinal, facturado, cobrado };
}

// ── Rendición de viático ─────────────────────────────────────────────────────
export type ViaticoEstadoRendido = "rendido" | "parcialmente_rendido";

export function computeRendicion(
  entregado: number,
  rendido: number,
  devuelto: number,
): { diferencia: number; estado: ViaticoEstadoRendido; rendido: number; devuelto: number } {
  const r = Math.max(0, Number(rendido) || 0);
  const d = Math.max(0, Number(devuelto) || 0);
  const e = Number(entregado ?? 0);
  const diferencia = e - r - d; // >0: falta justificar; <0: gastó de más
  const estado: ViaticoEstadoRendido = r + d >= e ? "rendido" : "parcialmente_rendido";
  return { diferencia, estado, rendido: r, devuelto: d };
}

// ── Cuenta corriente del cliente (derivada de los viajes) ────────────────────
export type CtaMovimiento = {
  id: string;
  fecha: string;
  tipo: "debe" | "haber";
  concepto: string;
  categoria: string;
  monto: number;
  moneda: string;
  observaciones: string | null;
};

export type ViajeParaCuenta = {
  id: string;
  codigo: string | null;
  fecha_viaje: string | null;
  fecha_cobro: string | null;
  monto_flete: number | null;
  moneda: string | null;
  cobrado: boolean;
  es_vacio: boolean;
};

export function movimientosCuentaCorriente(viajes: ViajeParaCuenta[]): {
  movimientos: CtaMovimiento[];
  totalDebe: number;
  totalHaber: number;
  saldo: number;
} {
  const movimientos: CtaMovimiento[] = [];
  let totalDebe = 0;
  let totalHaber = 0;

  for (const v of viajes) {
    const monto = Number(v.monto_flete ?? 0);
    if (!(monto > 0) || v.es_vacio) continue;
    const moneda = v.moneda ?? "ARS";
    totalDebe += monto;
    movimientos.push({
      id: `${v.id}-debe`,
      fecha: v.fecha_viaje ?? "",
      tipo: "debe",
      concepto: `Flete ${v.codigo ?? ""}`.trim(),
      categoria: "flete",
      monto,
      moneda,
      observaciones: null,
    });
    if (v.cobrado) {
      totalHaber += monto;
      movimientos.push({
        id: `${v.id}-haber`,
        fecha: v.fecha_cobro ?? v.fecha_viaje ?? "",
        tipo: "haber",
        concepto: `Cobro ${v.codigo ?? ""}`.trim(),
        categoria: "cobro",
        monto,
        moneda,
        observaciones: null,
      });
    }
  }

  movimientos.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
  return { movimientos, totalDebe, totalHaber, saldo: totalDebe - totalHaber };
}

// ── Predicados de estado de un viaje (para la grilla y los flujos en bloque) ──
type ViajeEstadoFlags = Pick<ViajeBasico, "facturado" | "cobrado" | "es_vacio" | "estado">;

/** Se puede facturar si no está facturado, no es vacío y no está cancelado. */
export function esFacturable(v: ViajeEstadoFlags): boolean {
  return !v.facturado && !v.es_vacio && v.estado !== "cancelado";
}

/** Se puede cobrar si está facturado, no cobrado, no vacío y no cancelado. */
export function esCobrable(v: ViajeEstadoFlags): boolean {
  return v.facturado && !v.cobrado && !v.es_vacio && v.estado !== "cancelado";
}
