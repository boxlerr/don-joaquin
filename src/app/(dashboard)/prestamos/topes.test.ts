import { describe, it, expect } from "vitest";
import { carga, excedeTope, hayAlgunTope, mergeTopes, nivel, TOPES_DEFAULT } from "./topes";

describe("mergeTopes", () => {
  it("acepta números y strings del formulario", () => {
    expect(mergeTopes({ dia: 1000, semana: "300000000", mes: 5 })).toEqual({
      dia: 1000,
      semana: 300_000_000,
      mes: 5,
    });
  });

  it("cero, negativo y basura quedan sin tope", () => {
    expect(mergeTopes({ dia: 0, semana: -5, mes: "hola" })).toEqual(TOPES_DEFAULT);
  });

  it("no rompe con null ni con lo que sea", () => {
    expect(mergeTopes(null)).toEqual(TOPES_DEFAULT);
    expect(mergeTopes("x")).toEqual(TOPES_DEFAULT);
    expect(mergeTopes(undefined)).toEqual(TOPES_DEFAULT);
  });

  it("redondea", () => {
    expect(mergeTopes({ mes: 1000.6 }).mes).toBe(1001);
  });
});

describe("hayAlgunTope", () => {
  it("distingue configurado de vacío", () => {
    expect(hayAlgunTope(TOPES_DEFAULT)).toBe(false);
    expect(hayAlgunTope({ dia: null, semana: 1, mes: null })).toBe(true);
  });
});

describe("excedeTope", () => {
  it("el caso del audio: 300 millones por semana", () => {
    const e = excedeTope(345_000_000, 300_000_000)!;
    expect(e.exceso).toBe(45_000_000);
    expect(e.porcentaje).toBeCloseTo(15, 5);
  });

  it("justo en el tope no avisa", () => {
    expect(excedeTope(300, 300)).toBeNull();
  });

  it("sin tope no avisa nunca", () => {
    expect(excedeTope(999_999_999, null)).toBeNull();
  });
});

describe("nivel / carga", () => {
  it("verde, ámbar y rojo", () => {
    expect(nivel(100, 1000)).toBe("ok");
    expect(nivel(900, 1000)).toBe("cerca"); // 90%
    expect(nivel(1001, 1000)).toBe("excedido");
  });

  it("el umbral de 'cerca' arranca en 85%", () => {
    expect(nivel(849, 1000)).toBe("ok");
    expect(nivel(850, 1000)).toBe("cerca");
  });

  it("sin tope siempre está ok", () => {
    expect(nivel(999, null)).toBe("ok");
    expect(carga(999, null)).toBeNull();
  });
});
