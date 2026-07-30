import { describe, it, expect } from "vitest";
import {
  formatCuil,
  normalizarDni,
  validarCuil,
  validarDni,
  validarFechasLegajo,
} from "./chofer-validation";

describe("formatCuil", () => {
  it("arma NN-NNNNNNNN-N a medida que se escribe", () => {
    expect(formatCuil("2")).toBe("2");
    expect(formatCuil("20")).toBe("20");
    expect(formatCuil("2026157850")).toBe("20-26157850");
    expect(formatCuil("20261578507")).toBe("20-26157850-7");
  });

  it("ignora lo que no sean dígitos y no pasa de 11", () => {
    expect(formatCuil("20-26157850-7")).toBe("20-26157850-7");
    expect(formatCuil("20 26157850 7 999")).toBe("20-26157850-7");
  });
});

describe("normalizarDni", () => {
  // La columna es UNIQUE: "20.393.903" y "20393903" serían dos legajos de la
  // misma persona.
  it("deja solo dígitos", () => {
    expect(normalizarDni("20.393.903")).toBe("20393903");
    expect(normalizarDni(" 20393903 ")).toBe("20393903");
  });
});

describe("validarDni / validarCuil", () => {
  it("acepta vacío: el legajo se puede guardar incompleto", () => {
    expect(validarDni("")).toBeNull();
    expect(validarDni(null)).toBeNull();
    expect(validarCuil("")).toBeNull();
    expect(validarCuil(undefined)).toBeNull();
  });

  it("acepta los datos reales de la flota", () => {
    expect(validarDni("20393903")).toBeNull();
    expect(validarCuil("20-20393903-6")).toBeNull();
  });

  it("rechaza un DNI corto y un CUIL incompleto o con prefijo inventado", () => {
    expect(validarDni("123")).toMatch(/7 u 8 dígitos/);
    expect(validarCuil("20-2039390")).toMatch(/11 dígitos/);
    expect(validarCuil("99-20393903-6")).toMatch(/Prefijo/);
  });
});

describe("validarFechasLegajo", () => {
  it("no se mete cuando las fechas son coherentes (o faltan)", () => {
    expect(validarFechasLegajo({})).toBeNull();
    expect(
      validarFechasLegajo({ fecha_nacimiento: "1977-07-17", fecha_ingreso: "2023-08-16" }),
    ).toBeNull();
    // Sin nacimiento no hay con qué comparar el ingreso.
    expect(validarFechasLegajo({ fecha_ingreso: "2023-08-16" })).toBeNull();
  });

  it("marca la fecha de nacimiento futura", () => {
    const mañana = new Date(Date.now() + 86_400_000).toISOString().split("T")[0]!;
    expect(validarFechasLegajo({ fecha_nacimiento: mañana })?.campo).toBe("fecha_nacimiento");
  });

  it("marca el ingreso anterior al nacimiento y el egreso anterior al ingreso", () => {
    expect(
      validarFechasLegajo({ fecha_nacimiento: "1977-07-17", fecha_ingreso: "1970-01-01" })?.campo,
    ).toBe("fecha_ingreso");
    expect(
      validarFechasLegajo({ fecha_ingreso: "2023-08-16", fecha_egreso: "2020-01-01" })?.campo,
    ).toBe("fecha_egreso");
  });
});
