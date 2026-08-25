import { describe, it, expect } from "vitest";
import { cifra, origenDeVista, pertenece, type ChequeParaResumen } from "./resumen";

const HOY = "2026-08-25";
const EN7 = "2026-09-01";

const ch = (
  fecha: string,
  importe: number,
  estado: ChequeParaResumen["estado"] = "cartera",
  origen: ChequeParaResumen["origen"] = "recibido",
): ChequeParaResumen => ({ origen, estado, importe, fecha_vencimiento: fecha });

describe("pertenece", () => {
  it("en cartera es SÓLO lo que nos deben", () => {
    expect(pertenece(ch("2026-09-10", 100), "cartera", HOY, EN7)).toBe(true);
    // Un cheque nuestro es plata que sale: se cuenta aparte.
    expect(pertenece(ch("2026-09-10", 100, "emitido", "propio"), "cartera", HOY, EN7)).toBe(false);
    // Y uno ya depositado dejó de estar en cartera.
    expect(pertenece(ch("2026-09-10", 100, "depositado"), "cartera", HOY, EN7)).toBe(false);
  });

  it("vencido es antes de hoy; hoy todavía no venció", () => {
    expect(pertenece(ch("2026-08-24", 100), "vencidos", HOY, EN7)).toBe(true);
    expect(pertenece(ch(HOY, 100), "vencidos", HOY, EN7)).toBe(false);
  });

  it("por vencer NO incluye los ya vencidos", () => {
    // Si los incluyera, el mismo cheque estaría en los dos cuadros y los
    // números de arriba sumarían más que la cartera.
    expect(pertenece(ch("2026-08-24", 100), "por_vencer", HOY, EN7)).toBe(false);
    expect(pertenece(ch(HOY, 100), "por_vencer", HOY, EN7)).toBe(true);
    expect(pertenece(ch(EN7, 100), "por_vencer", HOY, EN7)).toBe(true);
    expect(pertenece(ch("2026-09-02", 100), "por_vencer", HOY, EN7)).toBe(false);
  });

  it("nuestros son los emitidos y entregados, no los debitados", () => {
    expect(pertenece(ch("2026-09-10", 100, "emitido", "propio"), "nuestros", HOY, EN7)).toBe(true);
    expect(pertenece(ch("2026-09-10", 100, "entregado", "propio"), "nuestros", HOY, EN7)).toBe(true);
    expect(pertenece(ch("2026-09-10", 100, "debitado", "propio"), "nuestros", HOY, EN7)).toBe(false);
  });
});

describe("cifra", () => {
  const CHEQUES = [
    ch("2026-08-20", 195_526_000), // vencido
    ch("2026-08-28", 7_812_199), // por vencer
    ch("2026-09-30", 1_000_000), // en cartera, lejos
    ch("2026-09-10", 5_000_000, "emitido", "propio"),
    ch("2026-09-11", 3_000_000, "debitado", "propio"), // ya pagado
  ];

  it("cuenta plata y cantidad de cada cuadro", () => {
    expect(cifra(CHEQUES, "cartera", HOY, EN7)).toEqual({
      total: 204_338_199,
      cantidad: 3,
    });
    expect(cifra(CHEQUES, "vencidos", HOY, EN7)).toEqual({ total: 195_526_000, cantidad: 1 });
    expect(cifra(CHEQUES, "por_vencer", HOY, EN7)).toEqual({ total: 7_812_199, cantidad: 1 });
    expect(cifra(CHEQUES, "nuestros", HOY, EN7)).toEqual({ total: 5_000_000, cantidad: 1 });
  });

  it("vencidos y por vencer nunca se pisan, y los dos entran en la cartera", () => {
    const v = cifra(CHEQUES, "vencidos", HOY, EN7);
    const p = cifra(CHEQUES, "por_vencer", HOY, EN7);
    const c = cifra(CHEQUES, "cartera", HOY, EN7);
    expect(v.cantidad + p.cantidad).toBeLessThanOrEqual(c.cantidad);
  });

  it("sin cheques da cero y no rompe", () => {
    expect(cifra([], "cartera", HOY, EN7)).toEqual({ total: 0, cantidad: 0 });
  });
});

describe("origenDeVista", () => {
  it("las tres primeras cifras son del lado de los recibidos", () => {
    expect(origenDeVista("cartera")).toBe("recibido");
    expect(origenDeVista("por_vencer")).toBe("recibido");
    expect(origenDeVista("vencidos")).toBe("recibido");
    expect(origenDeVista("nuestros")).toBe("propio");
  });
});
