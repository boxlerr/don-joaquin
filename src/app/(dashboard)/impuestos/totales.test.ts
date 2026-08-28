import { describe, it, expect } from "vitest";
import { etiquetaPeriodo, totalesPorPeriodo, totalGeneral } from "./totales";

describe("etiquetaPeriodo", () => {
  it("muestra el mes en castellano", () => {
    expect(etiquetaPeriodo("2026-06")).toBe("Junio 2026");
    expect(etiquetaPeriodo("2026-01")).toBe("Enero 2026");
    expect(etiquetaPeriodo("2025-12")).toBe("Diciembre 2025");
  });

  it("deja pasar tal cual lo que no es un mes", () => {
    // `periodo` es texto libre: inventarle un mes sería peor que mostrarlo.
    expect(etiquetaPeriodo("1er trimestre")).toBe("1er trimestre");
    expect(etiquetaPeriodo("2026-13")).toBe("2026-13");
  });

  it("sin período lo dice", () => {
    expect(etiquetaPeriodo(null)).toBe("Sin período");
    expect(etiquetaPeriodo("")).toBe("Sin período");
  });
});

describe("totalesPorPeriodo", () => {
  it("suma por mes y ordena del más viejo al más nuevo", () => {
    const t = totalesPorPeriodo([
      { periodo: "2026-07", importe: 300 },
      { periodo: "2026-06", importe: 100 },
      { periodo: "2026-06", importe: 50 },
    ]);
    expect(t.map((x) => x.label)).toEqual(["Junio 2026", "Julio 2026"]);
    expect(t[0]!.total).toBe(150);
    expect(t[1]!.total).toBe(300);
  });

  it("lo que no está cargado se cuenta aparte, NO como cero", () => {
    // Es la regla que hace que el número sirva: si los sin cargar entraran como
    // cero, el total se leería como el gasto del mes sin serlo.
    const t = totalesPorPeriodo([
      { periodo: "2026-06", importe: 1000 },
      { periodo: "2026-06", importe: null },
      { periodo: "2026-06", importe: null },
    ]);
    expect(t[0]!.total).toBe(1000);
    expect(t[0]!.conImporte).toBe(1);
    expect(t[0]!.sinImporte).toBe(2);
  });

  it("un importe en 0 SÍ es un dato: se pagó cero", () => {
    const t = totalesPorPeriodo([{ periodo: "2026-06", importe: 0 }]);
    expect(t[0]!.conImporte).toBe(1);
    expect(t[0]!.sinImporte).toBe(0);
  });

  it("los que no tienen período van al final", () => {
    const t = totalesPorPeriodo([
      { periodo: null, importe: 10 },
      { periodo: "2026-06", importe: 20 },
      { periodo: "2026-05", importe: 30 },
    ]);
    expect(t.map((x) => x.label)).toEqual(["Mayo 2026", "Junio 2026", "Sin período"]);
  });

  it("los espacios de más no parten un mes en dos", () => {
    const t = totalesPorPeriodo([
      { periodo: "2026-06", importe: 1 },
      { periodo: " 2026-06 ", importe: 1 },
    ]);
    expect(t).toHaveLength(1);
    expect(t[0]!.total).toBe(2);
  });

  it("sin impuestos no devuelve nada", () => {
    expect(totalesPorPeriodo([])).toEqual([]);
  });
});

describe("totalGeneral", () => {
  it("suma lo cargado y cuenta lo que falta", () => {
    expect(
      totalGeneral([
        { periodo: "2026-06", importe: 100 },
        { periodo: "2026-07", importe: 250.5 },
        { periodo: "2026-07", importe: null },
      ]),
    ).toEqual({ total: 350.5, sinImporte: 1 });
  });

  it("los 11 impuestos de hoy: todos sin cargar, total en cero y once avisados", () => {
    const once = Array.from({ length: 11 }, () => ({ periodo: "2026-06", importe: null }));
    expect(totalGeneral(once)).toEqual({ total: 0, sinImporte: 11 });
  });
});
