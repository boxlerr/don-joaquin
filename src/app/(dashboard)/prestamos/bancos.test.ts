import { describe, it, expect } from "vitest";
import { canonizarBanco, inicialesBanco, listaBancos, marcaBanco, normalizarBanco } from "./bancos";

describe("normalizarBanco", () => {
  it("ignora acentos, mayúsculas y el 'Banco' de adelante", () => {
    expect(normalizarBanco("Nación")).toBe("nacion");
    expect(normalizarBanco("NACION")).toBe("nacion");
    expect(normalizarBanco("Banco  Galicia")).toBe("galicia");
    expect(normalizarBanco("  galicia ")).toBe("galicia");
  });

  it("no rompe con nombres de una sola palabra ni vacíos", () => {
    expect(normalizarBanco("")).toBe("");
    expect(normalizarBanco("AFIP")).toBe("afip");
  });

  it("no se come un 'banco' que es parte del nombre", () => {
    expect(normalizarBanco("Bancor")).toBe("bancor");
  });
});

describe("canonizarBanco", () => {
  const existentes = ["Nación", "Santander", "Galicia"];

  it("usa la grafía que ya está cargada", () => {
    expect(canonizarBanco("nacion", existentes)).toBe("Nación");
    expect(canonizarBanco("BANCO GALICIA", existentes)).toBe("Galicia");
    expect(canonizarBanco("  santander  ", existentes)).toBe("Santander");
  });

  it("deja pasar un banco nuevo tal como se escribió", () => {
    expect(canonizarBanco("Macro", existentes)).toBe("Macro");
    expect(canonizarBanco("Banco Nuevo   SA", existentes)).toBe("Banco Nuevo SA");
  });

  it("devuelve vacío si no se escribió nada", () => {
    expect(canonizarBanco("   ", existentes)).toBe("");
  });
});

describe("listaBancos", () => {
  it("pone primero los que ya se usan y después el resto de los conocidos", () => {
    const lista = listaBancos(["Santander", "Nación"]);
    expect(lista.slice(0, 2)).toEqual(["Nación", "Santander"]);
    expect(lista).toContain("Macro");
  });

  it("no repite un banco por diferencia de grafía", () => {
    const lista = listaBancos(["galicia"]);
    expect(lista.filter((b) => normalizarBanco(b) === "galicia")).toEqual(["galicia"]);
  });

  it("no repite si el mismo banco viene dos veces", () => {
    expect(listaBancos(["Nación", "NACION"]).filter((b) => normalizarBanco(b) === "nacion")).toHaveLength(1);
  });
});

describe("marcaBanco", () => {
  it("encuentra la marca sin importar la grafía", () => {
    expect(marcaBanco("Nación").color).toBe(marcaBanco("banco nacion").color);
  });

  it("le da un color por defecto a un banco desconocido", () => {
    expect(marcaBanco("Banco Inventado").color).toBe("#0088D1");
    expect(marcaBanco("Banco Inventado").logo).toBeUndefined();
  });
});

describe("inicialesBanco", () => {
  it("saca dos letras razonables", () => {
    expect(inicialesBanco("Nación")).toBe("NA");
    expect(inicialesBanco("Banco Galicia")).toBe("GA");
    expect(inicialesBanco("Scania Credit")).toBe("SC");
    expect(inicialesBanco("Tarjeta Corpo")).toBe("TC");
  });
});
