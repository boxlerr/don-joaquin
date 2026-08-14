import { describe, expect, it } from "vitest";
import { formatMientrasEscribe, formatMonto, parseMonto } from "./monto";

describe("parseMonto", () => {
  it("lee lo que se pega del Excel", () => {
    expect(parseMonto("$ 116.181.206,20")).toBe(116181206.2);
    expect(parseMonto("1.234.567")).toBe(1234567);
  });

  it("lee lo que devuelve la base, con el punto como decimal", () => {
    // El caso del reclamo: la cuota se mostraba `116181206.2`.
    expect(parseMonto("116181206.2")).toBe(116181206.2);
    expect(parseMonto("4500000.55")).toBe(4500000.55);
  });

  it("trata tres cifras detrás del punto como separador de miles", () => {
    expect(parseMonto("4.500")).toBe(4500);
    expect(parseMonto("4.500,50")).toBe(4500.5);
  });

  it("acepta el punto del teclado numérico como coma", () => {
    expect(parseMonto("4.5")).toBe(4.5);
  });

  it("no inventa un número cuando no hay ninguna cifra", () => {
    expect(parseMonto("")).toBeNull();
    expect(parseMonto("  $  ")).toBeNull();
  });

  it("ignora los centavos de más en vez de correr la coma", () => {
    expect(parseMonto("4500,999")).toBe(4500.99);
  });
});

describe("formatMonto", () => {
  it("pone los puntos de miles", () => {
    expect(formatMonto(4500000)).toBe("4.500.000");
  });

  it("completa los centavos cuando los hay", () => {
    // Sin esto se leía `116.181.206,2`, como si faltara una cifra.
    expect(formatMonto(116181206.2)).toBe("116.181.206,20");
  });

  it("no escribe `,00` cuando el importe es redondo", () => {
    expect(formatMonto(1000)).toBe("1.000");
  });

  it("devuelve vacío para lo que no es un número", () => {
    expect(formatMonto(Number.NaN)).toBe("");
  });
});

describe("formatMientrasEscribe", () => {
  it("agrupa de a tres a medida que se tipea", () => {
    expect(formatMientrasEscribe("4")).toBe("4");
    expect(formatMientrasEscribe("450")).toBe("450");
    expect(formatMientrasEscribe("4500")).toBe("4.500");
    expect(formatMientrasEscribe("4500000")).toBe("4.500.000");
  });

  it("deja viva la coma recién puesta", () => {
    // Si la coma desapareciera, apretarla no haría nada visible.
    expect(formatMientrasEscribe("4500000,")).toBe("4.500.000,");
    expect(formatMientrasEscribe("4500000,0")).toBe("4.500.000,0");
  });

  it("reescribe con puntos lo que se pega con otro formato", () => {
    expect(formatMientrasEscribe("116181206.2")).toBe("116.181.206,2");
    expect(formatMientrasEscribe("$ 116.181.206,20")).toBe("116.181.206,20");
  });

  it("no deja ceros a la izquierda", () => {
    expect(formatMientrasEscribe("007")).toBe("7");
    expect(formatMientrasEscribe("0")).toBe("0");
  });

  it("queda vacío cuando se borra todo", () => {
    expect(formatMientrasEscribe("")).toBe("");
  });
});
