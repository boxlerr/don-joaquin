import { describe, it, expect } from "vitest";
import { inicialesBanco, marcaBanco, normalizarBanco } from "./bancos";

describe("marcaBanco — el nombre viene escrito de mil formas", () => {
  it("encuentra el banco aunque el nombre no coincida letra por letra", () => {
    // Préstamos escribe "Provincia"; la tabla de bancos de Cheques escribe el
    // nombre largo. Los dos son el mismo banco y llevan el mismo logo.
    const corto = marcaBanco("Provincia");
    const largo = marcaBanco("Banco Provincia de Buenos Aires");
    expect(largo.logo).toBe(corto.logo);
    expect(largo.logo).toBe("/bancos/provincia.svg");
  });

  it("Nación, en sus tres formas", () => {
    for (const n of ["Nación", "Banco de la Nación Argentina", "BNA"]) {
      expect(marcaBanco(n).logo).toBe("/bancos/nacion.svg");
    }
  });

  it("Galicia y Credicoop con el 'Banco' adelante", () => {
    expect(marcaBanco("Banco Galicia").logo).toBe("/bancos/galicia.svg");
    expect(marcaBanco("Banco Credicoop").logo).toBe("/bancos/credicoop.svg");
  });

  it("Francés es BBVA: el nombre viejo sigue en la planilla", () => {
    expect(marcaBanco("Banco Francés").logo).toBe("/bancos/bbva.svg");
    expect(marcaBanco("BBVA Argentina").logo).toBe("/bancos/bbva.svg");
  });

  it("un banco conocido sin logo igual trae su color", () => {
    const m = marcaBanco("Banco Macro");
    expect(m.logo).toBeUndefined();
    expect(m.color).toBe("#00A9E0");
  });

  it("uno que no está en ninguna lista no rompe", () => {
    expect(marcaBanco("Banco Cooperativo del Litoral").color).toBe("#0088D1");
  });
});

describe("inicialesBanco", () => {
  it("saca dos letras del nombre, sin el 'Banco' de adelante", () => {
    expect(inicialesBanco("Banco Macro")).toBe("MA");
    expect(inicialesBanco("Nación")).toBe("NA");
  });
});

describe("normalizarBanco", () => {
  it("saca acentos, mayúsculas, el 'banco' de adelante y los espacios de más", () => {
    expect(normalizarBanco("  Banco  GALICIA ")).toBe("galicia");
    expect(normalizarBanco("Itaú")).toBe("itau");
  });
});
