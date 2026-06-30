import { describe, it, expect } from "vitest";
import { normPuntoNombre, buscarPuntoEnMapa } from "./puntos";

describe("normPuntoNombre", () => {
  it("ignora acentos, mayúsculas y espacios de más", () => {
    expect(normPuntoNombre("Añelo")).toBe("anelo");
    expect(normPuntoNombre("AÑELO")).toBe("anelo");
    expect(normPuntoNombre("  añelo ")).toBe("anelo");
    expect(normPuntoNombre("Anelo")).toBe("anelo");
  });

  it("colapsa signos y espacios internos", () => {
    expect(normPuntoNombre("Loc. ADLA-6")).toBe("loc adla 6");
    expect(normPuntoNombre("Canteras   Ibicuy")).toBe("canteras ibicuy");
  });

  it("tolera null/undefined/vacío", () => {
    expect(normPuntoNombre(null)).toBe("");
    expect(normPuntoNombre(undefined)).toBe("");
    expect(normPuntoNombre("   ")).toBe("");
  });
});

describe("buscarPuntoEnMapa", () => {
  const mapa = new Map<string, string>([
    [normPuntoNombre("Añelo"), "id-anelo"],
    [normPuntoNombre("Canteras Ibicuy"), "id-ibicuy"],
  ]);

  it("matchea aunque cambien acentos/mayúsculas/espacios", () => {
    expect(buscarPuntoEnMapa(mapa, "AÑELO")).toBe("id-anelo");
    expect(buscarPuntoEnMapa(mapa, "anelo")).toBe("id-anelo");
    expect(buscarPuntoEnMapa(mapa, "  Canteras  Ibicuy ")).toBe("id-ibicuy");
  });

  it("devuelve null si no está o el nombre es vacío", () => {
    expect(buscarPuntoEnMapa(mapa, "Ramallo")).toBeNull();
    expect(buscarPuntoEnMapa(mapa, "")).toBeNull();
    expect(buscarPuntoEnMapa(mapa, null)).toBeNull();
  });
});
