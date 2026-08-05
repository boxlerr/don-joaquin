import { describe, it, expect } from "vitest";
import {
  formatNombrePersona,
  nombreCompletoPersona,
  normalizarParaBuscar,
} from "./nombres";

describe("formatNombrePersona", () => {
  it("pasa los nombres en mayúsculas al formato del resto de la lista", () => {
    expect(formatNombrePersona("TOMAS ARIEL")).toBe("Tomas Ariel");
    expect(formatNombrePersona("CEPEDA")).toBe("Cepeda");
    expect(formatNombrePersona("MARCELO DAMIAN")).toBe("Marcelo Damian");
  });

  it("levanta los que vinieron todo en minúscula", () => {
    expect(formatNombrePersona("prueba")).toBe("Prueba");
  });

  it("no toca los que ya estaban bien", () => {
    expect(formatNombrePersona("Pablo Maximo")).toBe("Pablo Maximo");
    expect(formatNombrePersona("Asteazarán")).toBe("Asteazarán");
  });

  it("respeta los acentos: sólo cambia la caja, nunca las letras", () => {
    expect(formatNombrePersona("JULIÁN")).toBe("Julián");
    expect(formatNombrePersona("MARTÍNEZ")).toBe("Martínez");
  });

  it("deja las partículas del apellido compuesto en minúscula, salvo al inicio", () => {
    expect(formatNombrePersona("DE LIBANO")).toBe("De Libano");
    expect(formatNombrePersona("RAMOS DE LA CRUZ")).toBe("Ramos de la Cruz");
  });

  it("mantiene la mayúscula de cada parte en guiones y apóstrofos", () => {
    expect(formatNombrePersona("O'BRIEN")).toBe("O'Brien");
    expect(formatNombrePersona("saint-denis")).toBe("Saint-Denis");
  });

  it("deja las iniciales sueltas como iniciales", () => {
    expect(formatNombrePersona("juan c. perez")).toBe("Juan C. Perez");
  });

  it("limpia espacios de más y tolera vacío", () => {
    expect(formatNombrePersona("  JOSE   LUIS  ")).toBe("Jose Luis");
    expect(formatNombrePersona("")).toBe("");
    expect(formatNombrePersona(null)).toBe("");
    expect(formatNombrePersona(undefined)).toBe("");
  });
});

describe("nombreCompletoPersona", () => {
  it("arma 'Apellido, Nombre' normalizado", () => {
    expect(nombreCompletoPersona("CEPEDA", "TOMAS ARIEL")).toBe("Cepeda, Tomas Ariel");
  });

  it("no deja la coma colgando si falta una parte", () => {
    expect(nombreCompletoPersona("CEPEDA", "")).toBe("Cepeda");
    expect(nombreCompletoPersona(null, "TOMAS")).toBe("Tomas");
  });
});

describe("normalizarParaBuscar", () => {
  it("encuentra sin escribir los acentos", () => {
    expect(normalizarParaBuscar("Asteazarán")).toBe("asteazaran");
    expect(normalizarParaBuscar("  JULIÁN  ")).toBe("julian");
  });
});
