import { describe, it, expect } from "vitest";
import { formatoVariacion, variacionCuota } from "./variacion";

const c = (fecha: string, importe: number) => ({ fecha_vencimiento: fecha, importe });

describe("variacionCuota", () => {
  it("mide el salto contra el último importe distinto", () => {
    // Caso real: Nación $50.000.000 pasó de 5.314.423,72 a 5.865.943,45.
    const v = variacionCuota([
      c("2026-06-05", 5_314_423.72),
      c("2026-07-05", 5_314_423.72),
      c("2026-08-05", 5_865_943.45),
    ]);
    expect(v).not.toBeNull();
    expect(v!.anterior).toBe(5_314_423.72);
    expect(v!.actual).toBe(5_865_943.45);
    expect(v!.porcentaje).toBeCloseTo(10.38, 1);
  });

  it("salta los meses que repiten el importe nuevo", () => {
    const v = variacionCuota([c("2026-05-01", 100), c("2026-06-01", 120), c("2026-07-01", 120)]);
    expect(v!.anterior).toBe(100);
    expect(v!.actual).toBe(120);
    expect(v!.porcentaje).toBeCloseTo(20, 5);
  });

  it("detecta una baja", () => {
    const v = variacionCuota([c("2026-06-01", 200), c("2026-07-01", 150)]);
    expect(v!.diferencia).toBe(-50);
    expect(v!.porcentaje).toBeCloseTo(-25, 5);
  });

  it("null si nunca cambió", () => {
    expect(variacionCuota([c("2026-06-01", 100), c("2026-07-01", 100)])).toBeNull();
  });

  it("null si hay una sola cuota o ninguna", () => {
    expect(variacionCuota([c("2026-06-01", 100)])).toBeNull();
    expect(variacionCuota([])).toBeNull();
  });

  it("ignora las cuotas sin importe cargado", () => {
    expect(variacionCuota([c("2026-06-01", 0), c("2026-07-01", 100)])).toBeNull();
  });

  it("no ordena por el orden del array sino por fecha", () => {
    const v = variacionCuota([c("2026-08-01", 120), c("2026-06-01", 100)]);
    expect(v!.anterior).toBe(100);
    expect(v!.actual).toBe(120);
  });
});

describe("formatoVariacion", () => {
  it("usa signo y una decimal", () => {
    expect(formatoVariacion(10.38)).toBe("+10,4%");
    expect(formatoVariacion(-25)).toBe("−25,0%");
    expect(formatoVariacion(0)).toBe("+0,0%");
  });
});
