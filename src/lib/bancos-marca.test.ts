import { describe, it, expect } from "vitest";
import { marcaDeBanco } from "./bancos-marca";

describe("marcaDeBanco", () => {
  it("reconoce al banco escrito de cualquiera de sus formas", () => {
    // En la base conviven las tres, porque se cargan como vienen del cheque.
    const formas = ["Banco Nación", "Banco de la Nación Argentina", "BANCO NACION"];
    const siglas = new Set(formas.map((f) => marcaDeBanco(f).sigla));
    expect(siglas).toEqual(new Set(["BNA"]));
  });

  it("cada banco conocido tiene su color de marca", () => {
    expect(marcaDeBanco("Banco Galicia").sigla).toBe("GAL");
    expect(marcaDeBanco("Banco Provincia de Buenos Aires").sigla).toBe("BAP");
    expect(marcaDeBanco("Santander Río").sigla).toBe("SAN");
  });

  it("no le importan los acentos ni las mayúsculas", () => {
    expect(marcaDeBanco("BANCO ITAÚ").sigla).toBe(marcaDeBanco("banco itau").sigla);
  });

  it("un banco desconocido igual recibe sigla y color", () => {
    const m = marcaDeBanco("Banco Cooperativo del Litoral");
    expect(m.sigla).toMatch(/^[A-Z]{2,4}$/);
    expect(m.color).toMatch(/^#[0-9A-F]{6}$/i);
  });

  it("el color de un desconocido es SIEMPRE el mismo", () => {
    // Si dependiera del orden de la lista, dar de alta otro banco le cambiaría
    // el color a este.
    const a = marcaDeBanco("Banco Cooperativo del Litoral").color;
    const b = marcaDeBanco("banco  cooperativo del litoral  ").color;
    expect(a).toBe(b);
  });

  it("saltea las palabras que no distinguen nada", () => {
    // "Banco de la Comarca" no puede dar "BD": "banco", "de" y "la" no
    // distinguen a ningún banco de otro. Queda una sola palabra útil y de ahí
    // salen tres letras.
    expect(marcaDeBanco("Banco de la Comarca").sigla).toBe("COM");
    // Con dos palabras útiles, una inicial de cada una.
    expect(marcaDeBanco("Banco del Sol Naciente").sigla).toBe("SN");
  });

  it("sin nombre no rompe", () => {
    expect(marcaDeBanco(null).sigla).toBe("—");
    expect(marcaDeBanco("").sigla).toBe("—");
  });
});

describe("los colores tienen que separar", () => {
  it("ningún par de bancos conocidos comparte color, salvo los que SON el mismo banco", () => {
    const nombres = [
      "Banco Galicia", "Banco Nación", "Banco Provincia", "Santander", "BBVA",
      "Banco Macro", "Credicoop", "Supervielle", "Patagonia", "ICBC", "HSBC",
      "Comafi", "Banco Ciudad", "Hipotecario", "Itaú", "Banco Santa Fe",
      "Banco de Córdoba", "Banco Entre Ríos", "Brubank", "Mercado Pago",
    ];
    const colores = nombres.map((n) => marcaDeBanco(n).color);
    expect(new Set(colores).size).toBe(nombres.length);
  });

  it("BBVA y Frances son el mismo banco y comparten marca", () => {
    expect(marcaDeBanco("BBVA Argentina")).toEqual(marcaDeBanco("Banco Francés"));
  });
});
