import { describe, it, expect } from "vitest";
import { cortesUltimos12Meses, serieDotacion } from "./dotacion";

describe("cortesUltimos12Meses", () => {
  it("da 12 cortes y el último es hoy", () => {
    const cortes = cortesUltimos12Meses(new Date(2026, 7, 6)); // 06/08/2026
    expect(cortes).toHaveLength(12);
    expect(cortes[11]).toBe("2026-08-06");
    expect(cortes[10]).toBe("2026-07-31");
    expect(cortes[0]).toBe("2025-09-30");
  });

  it("no se corre de día por zona horaria (UTC−3)", () => {
    // A las 00:30 de Argentina, `toISOString()` devolvería el día anterior.
    const cortes = cortesUltimos12Meses(new Date(2026, 7, 1, 0, 30));
    expect(cortes[11]).toBe("2026-08-01");
  });

  it("cruza el fin de año hacia atrás", () => {
    const cortes = cortesUltimos12Meses(new Date(2026, 1, 15)); // 15/02/2026
    expect(cortes[0]).toBe("2025-03-31");
    expect(cortes[11]).toBe("2026-02-15");
  });
});

describe("serieDotacion", () => {
  const cortes = ["2025-12-31", "2026-01-31", "2026-02-28"];

  it("suma a cada uno desde el mes en que ingresó", () => {
    const serie = serieDotacion(
      [
        { fecha_ingreso: "2020-05-01", estado: "activo" },
        { fecha_ingreso: "2026-01-10", estado: "activo" },
        { fecha_ingreso: "2026-02-20", estado: "inactivo" },
      ],
      cortes,
    );
    expect(serie).toEqual([1, 2, 3]);
  });

  it("resta al egresado desde su fecha de egreso", () => {
    const serie = serieDotacion(
      [
        { fecha_ingreso: "2020-05-01", estado: "activo" },
        { fecha_ingreso: "2019-01-01", fecha_egreso: "2026-01-15", estado: "baja" },
      ],
      cortes,
    );
    expect(serie).toEqual([2, 1, 1]);
  });

  it("no cuenta nunca al egresado sin fecha de egreso, en vez de inventarle una", () => {
    const serie = serieDotacion(
      [
        { fecha_ingreso: "2020-05-01", estado: "activo" },
        { fecha_ingreso: "2019-01-01", fecha_egreso: null, estado: "baja" },
      ],
      cortes,
    );
    expect(serie).toEqual([1, 1, 1]);
  });

  it("cuenta siempre a quien está en plantilla sin fecha de ingreso, así el último punto da el total", () => {
    const personas = [
      { fecha_ingreso: null, estado: "activo" },
      { fecha_ingreso: "2026-02-01", estado: "activo" },
    ];
    const serie = serieDotacion(personas, cortes);
    expect(serie).toEqual([1, 1, 2]);
    expect(serie[serie.length - 1]).toBe(personas.filter((p) => p.estado !== "baja").length);
  });

  it("tolera fechas con hora pegada", () => {
    const serie = serieDotacion(
      [{ fecha_ingreso: "2026-01-31T00:00:00", estado: "activo" }],
      cortes,
    );
    expect(serie).toEqual([0, 1, 1]);
  });
});
