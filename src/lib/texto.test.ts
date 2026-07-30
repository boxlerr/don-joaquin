import { describe, expect, it } from "vitest";
import {
  coincideBusqueda,
  coincideEnAlguno,
  coincideTerminos,
  compararTexto,
  normalizarTexto,
} from "./texto";

describe("normalizarTexto", () => {
  it("saca acentos y pasa a minúsculas", () => {
    expect(normalizarTexto("Agustín")).toBe("agustin");
    expect(normalizarTexto("BENÍTEZ")).toBe("benitez");
    expect(normalizarTexto("Asteazarán")).toBe("asteazaran");
  });

  it("trata la ñ como n", () => {
    expect(normalizarTexto("Muñoz")).toBe("munoz");
    expect(normalizarTexto("Peña")).toBe("pena");
  });

  it("colapsa espacios y recorta", () => {
    expect(normalizarTexto("  Surra,   Agustin  ")).toBe("surra, agustin");
  });

  it("tolera null, undefined y no-strings", () => {
    expect(normalizarTexto(null)).toBe("");
    expect(normalizarTexto(undefined)).toBe("");
    expect(normalizarTexto(123)).toBe("123");
  });
});

describe("coincideBusqueda", () => {
  it("encuentra con y sin acento en cualquier dirección", () => {
    expect(coincideBusqueda("Asteazarán, Agustín", "agustin")).toBe(true);
    expect(coincideBusqueda("Asteazaran, Agustin", "agustín")).toBe(true);
    expect(coincideBusqueda("Benítez, Sergio Agustín", "benitez")).toBe(true);
    expect(coincideBusqueda("Fischer, Agustín", "AGUSTIN")).toBe(true);
  });

  it("una búsqueda vacía no filtra", () => {
    expect(coincideBusqueda("lo que sea", "")).toBe(true);
    expect(coincideBusqueda("lo que sea", "   ")).toBe(true);
  });

  it("sigue descartando lo que no coincide", () => {
    expect(coincideBusqueda("Goity, Agustin", "perez")).toBe(false);
  });

  it("no rompe con valores nulos", () => {
    expect(coincideBusqueda(null, "agustin")).toBe(false);
    expect(coincideBusqueda(null, "")).toBe(true);
  });
});

describe("coincideEnAlguno", () => {
  it("alcanza con que coincida un campo", () => {
    expect(coincideEnAlguno(["Benítez", "AB123CD", null], "ab123")).toBe(true);
    expect(coincideEnAlguno(["Benítez", "AB123CD"], "benitez")).toBe(true);
    expect(coincideEnAlguno(["Benítez", "AB123CD"], "zzz")).toBe(false);
  });
});

describe("coincideTerminos", () => {
  it("busca por palabras sueltas sin importar el orden", () => {
    expect(coincideTerminos(["Surra", "Agustín Lauriano"], "agustin surra")).toBe(true);
    expect(coincideTerminos(["Surra", "Agustín Lauriano"], "lauriano agustin")).toBe(true);
    expect(coincideTerminos(["Surra", "Agustín Lauriano"], "agustin perez")).toBe(false);
  });
});

describe("compararTexto", () => {
  it("ordena ignorando acentos", () => {
    const nombres = ["Ávila", "Benítez", "Álvarez"];
    expect([...nombres].sort(compararTexto)).toEqual(["Álvarez", "Ávila", "Benítez"]);
  });
});
