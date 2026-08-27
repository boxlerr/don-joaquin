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

  it("vencidos también cuenta los NUESTROS sin debitar", () => {
    // La cifra miraba sólo los recibidos, así que el 27/08/2026 decía "0 sin
    // gestionar" con tres cheques nuestros pasados de fecha —uno de $3.000.000
    // de hacía 43 días—. Un cheque nuestro vencido y sin debitar es justo lo que
    // hay que ir a mirar al banco.
    expect(pertenece(ch("2026-08-24", 100, "entregado", "propio"), "vencidos", HOY, EN7)).toBe(true);
    expect(pertenece(ch("2026-08-24", 100, "emitido", "propio"), "vencidos", HOY, EN7)).toBe(true);
    // Ya debitado no reclama nada, aunque la fecha haya pasado.
    expect(pertenece(ch("2026-08-24", 100, "debitado", "propio"), "vencidos", HOY, EN7)).toBe(false);
    // Y un recibido ya cedido tampoco: se terminó.
    expect(pertenece(ch("2026-08-24", 100, "entregado"), "vencidos", HOY, EN7)).toBe(false);
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
  it("cartera y por vencer son de los recibidos; vencidos mezcla los dos lados", () => {
    expect(origenDeVista("cartera")).toBe("recibido");
    expect(origenDeVista("por_vencer")).toBe("recibido");
    expect(origenDeVista("nuestros")).toBe("propio");
    // Vencidos y avisos abren la solapa "Todos": hay de los dos lados adentro.
    expect(origenDeVista("vencidos")).toBe("todos");
    expect(origenDeVista("avisos")).toBe("todos");
  });
});

/**
 * La vista con la que se entra desde el resumen del día: los cheques que
 * todavía piden algo, de los dos lados. Es la que hace que tocar "Cheques 3
 * vencidos de 21" muestre esos 21 y no la cartera entera.
 */
describe("vista avisos", () => {
  const ch = (origen: "recibido" | "propio", estado: string) =>
    ({ origen, estado, importe: 100, fecha_vencimiento: "2026-09-10" }) as never;

  it("trae lo que reclama de los dos lados", () => {
    expect(pertenece(ch("recibido", "cartera"), "avisos", HOY, EN7)).toBe(true);
    expect(pertenece(ch("propio", "emitido"), "avisos", HOY, EN7)).toBe(true);
    expect(pertenece(ch("propio", "entregado"), "avisos", HOY, EN7)).toBe(true);
  });

  it("deja afuera lo que ya se resolvió", () => {
    // Un recibido entregado es uno cedido: no hay nada que hacer con él.
    expect(pertenece(ch("recibido", "entregado"), "avisos", HOY, EN7)).toBe(false);
    expect(pertenece(ch("recibido", "depositado"), "avisos", HOY, EN7)).toBe(false);
    expect(pertenece(ch("propio", "debitado"), "avisos", HOY, EN7)).toBe(false);
  });

  it("no recorta por fecha: el número del aviso incluye lo que vence más adelante", () => {
    const lejano = { origen: "recibido", estado: "cartera", importe: 1, fecha_vencimiento: "2027-01-01" } as never;
    expect(pertenece(lejano, "avisos", HOY, EN7)).toBe(true);
  });
});
