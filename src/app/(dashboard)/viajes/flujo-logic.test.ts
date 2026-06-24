import { describe, it, expect } from "vitest";
import {
  computeCierre,
  computeRendicion,
  movimientosCuentaCorriente,
  esFacturable,
  esCobrable,
  type ViajeParaCuenta,
} from "./flujo-logic";

// ── Flujo: cerrar / facturar / cobrar un viaje ───────────────────────────────
describe("computeCierre (cerrar viaje)", () => {
  it("con monto ingresado y sin cobrar: queda facturado pero no cobrado", () => {
    const r = computeCierre({ montoActual: null, montoIngresado: 1000, esVacio: false, cobrado: false });
    expect(r).toEqual({ montoFinal: 1000, facturado: true, cobrado: false });
  });

  it("monto ingresado null: usa el monto actual del viaje", () => {
    const r = computeCierre({ montoActual: 500, montoIngresado: null, esVacio: false, cobrado: false });
    expect(r.montoFinal).toBe(500);
    expect(r.facturado).toBe(true);
  });

  it("viaje vacío: nunca queda facturado aunque tenga monto", () => {
    const r = computeCierre({ montoActual: null, montoIngresado: 1000, esVacio: true, cobrado: true });
    expect(r.facturado).toBe(false);
    expect(r.cobrado).toBe(false);
  });

  it("'ya cobré' con factura: queda cobrado", () => {
    const r = computeCierre({ montoActual: null, montoIngresado: 800, esVacio: false, cobrado: true });
    expect(r).toEqual({ montoFinal: 800, facturado: true, cobrado: true });
  });

  it("'ya cobré' sin monto: NO queda cobrado (no hay factura)", () => {
    const r = computeCierre({ montoActual: 0, montoIngresado: null, esVacio: false, cobrado: true });
    expect(r.facturado).toBe(false);
    expect(r.cobrado).toBe(false);
  });

  it("monto negativo se normaliza a 0 (no facturado)", () => {
    const r = computeCierre({ montoActual: null, montoIngresado: -50, esVacio: false, cobrado: false });
    expect(r.montoFinal).toBe(0);
    expect(r.facturado).toBe(false);
  });
});

// ── Flujo: rendición de viático ──────────────────────────────────────────────
describe("computeRendicion (viáticos)", () => {
  it("gastado + devuelto cubren lo entregado: rendido, diferencia 0", () => {
    expect(computeRendicion(1000, 600, 400)).toEqual({
      diferencia: 0,
      estado: "rendido",
      rendido: 600,
      devuelto: 400,
    });
  });

  it("solo parte: parcialmente_rendido con diferencia pendiente", () => {
    const r = computeRendicion(1000, 600, 0);
    expect(r.estado).toBe("parcialmente_rendido");
    expect(r.diferencia).toBe(400);
  });

  it("gastó de más: rendido con diferencia negativa", () => {
    const r = computeRendicion(1000, 1200, 0);
    expect(r.estado).toBe("rendido");
    expect(r.diferencia).toBe(-200);
  });

  it("normaliza valores negativos a 0", () => {
    const r = computeRendicion(500, -100, -20);
    expect(r.rendido).toBe(0);
    expect(r.devuelto).toBe(0);
    expect(r.estado).toBe("parcialmente_rendido");
  });
});

// ── Flujo: cuenta corriente del cliente (derivada de viajes) ─────────────────
const viaje = (over: Partial<ViajeParaCuenta>): ViajeParaCuenta => ({
  id: "v1",
  codigo: "VJ-1",
  fecha_viaje: "2026-04-10",
  fecha_cobro: null,
  monto_flete: 1000,
  moneda: "ARS",
  cobrado: false,
  es_vacio: false,
  ...over,
});

describe("movimientosCuentaCorriente", () => {
  it("viaje facturado sin cobrar: un debe, saldo = monto", () => {
    const r = movimientosCuentaCorriente([viaje({})]);
    expect(r.totalDebe).toBe(1000);
    expect(r.totalHaber).toBe(0);
    expect(r.saldo).toBe(1000);
    expect(r.movimientos).toHaveLength(1);
    expect(r.movimientos[0].tipo).toBe("debe");
  });

  it("viaje cobrado: debe + haber, saldo 0", () => {
    const r = movimientosCuentaCorriente([viaje({ cobrado: true, fecha_cobro: "2026-04-20" })]);
    expect(r.totalDebe).toBe(1000);
    expect(r.totalHaber).toBe(1000);
    expect(r.saldo).toBe(0);
    expect(r.movimientos).toHaveLength(2);
  });

  it("ignora vacíos y montos en 0", () => {
    const r = movimientosCuentaCorriente([
      viaje({ id: "a", es_vacio: true }),
      viaje({ id: "b", monto_flete: 0 }),
      viaje({ id: "c", monto_flete: null }),
    ]);
    expect(r.movimientos).toHaveLength(0);
    expect(r.saldo).toBe(0);
  });

  it("ordena por fecha descendente", () => {
    const r = movimientosCuentaCorriente([
      viaje({ id: "viejo", fecha_viaje: "2026-01-01" }),
      viaje({ id: "nuevo", fecha_viaje: "2026-06-01" }),
    ]);
    expect(r.movimientos[0].fecha).toBe("2026-06-01");
  });

  it("dos clientes/viajes: suma el saldo neto correcto", () => {
    const r = movimientosCuentaCorriente([
      viaje({ id: "1", monto_flete: 1000, cobrado: false }),
      viaje({ id: "2", monto_flete: 500, cobrado: true, fecha_cobro: "2026-04-15" }),
    ]);
    expect(r.totalDebe).toBe(1500);
    expect(r.totalHaber).toBe(500);
    expect(r.saldo).toBe(1000);
  });
});

// ── Predicados de estado ─────────────────────────────────────────────────────
describe("esFacturable / esCobrable", () => {
  it("facturable: no facturado, no vacío, no cancelado", () => {
    expect(esFacturable({ facturado: false, cobrado: false, es_vacio: false, estado: "cerrado" })).toBe(true);
    expect(esFacturable({ facturado: true, cobrado: false, es_vacio: false, estado: "cerrado" })).toBe(false);
    expect(esFacturable({ facturado: false, cobrado: false, es_vacio: true, estado: "cerrado" })).toBe(false);
    expect(esFacturable({ facturado: false, cobrado: false, es_vacio: false, estado: "cancelado" })).toBe(false);
  });

  it("cobrable: facturado, no cobrado, no vacío, no cancelado", () => {
    expect(esCobrable({ facturado: true, cobrado: false, es_vacio: false, estado: "cerrado" })).toBe(true);
    expect(esCobrable({ facturado: true, cobrado: true, es_vacio: false, estado: "cerrado" })).toBe(false);
    expect(esCobrable({ facturado: false, cobrado: false, es_vacio: false, estado: "cerrado" })).toBe(false);
  });
});
