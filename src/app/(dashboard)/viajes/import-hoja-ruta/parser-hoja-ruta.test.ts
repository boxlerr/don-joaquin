import { describe, it, expect } from "vitest";
import { extraerVia } from "./parser-hoja-ruta";

// La vía (Ruta 5 / Ruta 22) se marca a mano pegada al material en la columna
// MATERIAL del Excel. extraerVia la separa en su propia columna y deja el
// material limpio, para que el par origen→destino aprenda la distancia de cada
// vía por separado (IBICUY→LAJE 20 va ~1360 por Ruta 5 y ~1480 sin marcar).
describe("extraerVia", () => {
  it("separa 'RUTA 5' pegada al material", () => {
    expect(extraerVia("YPF LAJE RUTA 5")).toEqual({ via: "ruta_5", material: "YPF LAJE" });
  });

  it("separa 'RUTA 22' pegada al material", () => {
    expect(extraerVia("YPF LAJE RUTA 22")).toEqual({ via: "ruta_22", material: "YPF LAJE" });
  });

  it("marca sola (vacío) deja el material en null", () => {
    expect(extraerVia("RUTA 5")).toEqual({ via: "ruta_5", material: null });
    expect(extraerVia("RUTA 22")).toEqual({ via: "ruta_22", material: null });
  });

  it("tolera doble espacio y minúsculas", () => {
    expect(extraerVia("YPF RUTA  5")).toEqual({ via: "ruta_5", material: "YPF" });
    expect(extraerVia("ypf ruta 22")).toEqual({ via: "ruta_22", material: "ypf" });
  });

  it("tolera 'RUTA5' sin espacio", () => {
    expect(extraerVia("YPF RUTA5")).toEqual({ via: "ruta_5", material: "YPF" });
  });

  it("número de vía suelto al final: 'YPF TORO 5' es Ruta 5 (confirmado por el cliente)", () => {
    expect(extraerVia("YPF TORO 5")).toEqual({ via: "ruta_5", material: "YPF TORO" });
    expect(extraerVia("YPF TORO 22")).toEqual({ via: "ruta_22", material: "YPF TORO" });
  });

  it("NO toma por vía una celda que es solo un número ('10000', '7000')", () => {
    expect(extraerVia("10000")).toEqual({ via: null, material: "10000" });
    expect(extraerVia("7000")).toEqual({ via: null, material: "7000" });
  });

  it("un número al principio no es vía ('1 CLIENTE')", () => {
    expect(extraerVia("1 CLIENTE")).toEqual({ via: null, material: "1 CLIENTE" });
  });

  it("NO marca vías que no son 5 ni 22 (ej. 'RUTA 3' o 'TORO 3')", () => {
    expect(extraerVia("YPF RUTA 3")).toEqual({ via: null, material: "YPF RUTA 3" });
    expect(extraerVia("YPF TORO 3")).toEqual({ via: null, material: "YPF TORO 3" });
  });

  it("material común sin vía queda igual", () => {
    expect(extraerVia("CLINKER")).toEqual({ via: null, material: "CLINKER" });
    expect(extraerVia("228007.73")).toEqual({ via: null, material: "228007.73" });
  });

  it("null / vacío no rompen", () => {
    expect(extraerVia(null)).toEqual({ via: null, material: null });
    expect(extraerVia("")).toEqual({ via: null, material: "" });
  });
});
