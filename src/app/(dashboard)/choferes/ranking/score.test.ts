import { describe, it, expect } from "vitest";
import {
  calcularScore,
  RANKING_CRITERIOS_DEFAULT,
  tramoKm,
  tramoToneladas,
  tramoCombustible,
  tramoGomas,
  tramoRoturasVarias,
  tramoSeguridad,
  tramoConducta,
  type ScoreInputs,
} from "./criterios";

const C = RANKING_CRITERIOS_DEFAULT;

// Inputs "todo bien" — base para variar un solo concepto por test.
const PERFECTO: ScoreInputs = {
  meses: 1,
  km_mensual: 14000, // ≥ objetivo
  ton_pct: 1.0, // en capacidad
  combustible_lp100: 30, // ≤ referencia
  gomas: 0,
  roturas_leves: 0,
  roturas_graves: 0,
  seguridad: 0,
  siniestros: 0,
  conducta: 0,
};

describe("tramos (escalas del Excel)", () => {
  it("km: ≥100% sin descuento, baja por tramos", () => {
    expect(tramoKm(1.0)).toBe(0);
    expect(tramoKm(0.9)).toBe(0.35);
    expect(tramoKm(0.75)).toBe(0.7);
    expect(tramoKm(0.5)).toBe(1);
  });

  it("toneladas: penaliza sub Y sobrecarga", () => {
    expect(tramoToneladas(1.0)).toBe(0);
    expect(tramoToneladas(0.9)).toBe(0.4); // -10%
    expect(tramoToneladas(1.1)).toBe(0.4); // +10%
    expect(tramoToneladas(0.8)).toBe(0.7);
    expect(tramoToneladas(1.2)).toBe(0.7);
    expect(tramoToneladas(0.5)).toBe(1);
    expect(tramoToneladas(1.4)).toBe(1); // sobrecarga grave
  });

  it("combustible: peor cuanto más consume", () => {
    expect(tramoCombustible(33.6, 33.6)).toBe(0);
    expect(tramoCombustible(35, 33.6)).toBe(0.35); // +4%
    expect(tramoCombustible(37, 33.6)).toBe(0.7); // +10%
    expect(tramoCombustible(40, 33.6)).toBe(1); // +19%
  });

  it("eventos: gomas / roturas / seguridad / conducta", () => {
    expect(tramoGomas(0)).toBe(0);
    expect(tramoGomas(1)).toBe(0.3);
    expect(tramoGomas(3)).toBe(1);
    expect(tramoRoturasVarias(0, 0)).toBe(0);
    expect(tramoRoturasVarias(1, 0)).toBe(0.3); // 1 leve
    expect(tramoRoturasVarias(0, 1)).toBe(0.7); // 1 grave
    expect(tramoRoturasVarias(0, 2)).toBe(1);
    expect(tramoSeguridad(0)).toBe(0);
    expect(tramoSeguridad(1)).toBe(0.7); // criterio "detectar desvíos"
    expect(tramoSeguridad(2)).toBe(1);
    expect(tramoConducta(1)).toBe(0); // 0-1 tolerable
    expect(tramoConducta(2)).toBe(0.35);
    expect(tramoConducta(4)).toBe(1);
  });
});

describe("calcularScore", () => {
  it("chofer perfecto → 100, sin penalizaciones", () => {
    const r = calcularScore(PERFECTO, C);
    expect(r.score).toBe(100);
    expect(r.desglose).toHaveLength(0);
  });

  it("reproduce el ejemplo del simulador del Excel (topes finales = 64)", () => {
    // Mismos datos de entrada que la solapa "3. Simulador de Ejemplo".
    const r = calcularScore(
      {
        meses: 1,
        km_mensual: 12100, // 90% → -35% de 18 = 6
        ton_pct: 33 / 35, // 94% → -40% de 10 = 4
        combustible_lp100: 35.2, // +4.8% → -35% de 13 = 5 (4.55→5)
        gomas: 1, // -30% de 9 = 3 (2.7→3)
        roturas_leves: 0,
        roturas_graves: 0,
        seguridad: 1, // -70% de 20 = 14
        siniestros: 0,
        conducta: 2, // -35% de 10 = 4 (3.5→4)
      },
      C,
    );
    expect(r.score).toBe(64); // 100 - (6+4+5+3+14+4) = 64
  });

  it("el desglose siempre suma al score (100 − Σdescuentos)", () => {
    const r = calcularScore(
      { ...PERFECTO, km_mensual: 9000, seguridad: 1, gomas: 2 },
      C,
    );
    const totalDesc = r.desglose.reduce((s, d) => s + Math.abs(d.puntos), 0);
    expect(100 - totalDesc).toBe(r.score);
  });

  it("ausencia de datos NO penaliza (km/ton/combustible en null)", () => {
    const r = calcularScore(
      {
        meses: 1,
        km_mensual: null,
        ton_pct: null,
        combustible_lp100: null,
        gomas: 0,
        roturas_leves: 0,
        roturas_graves: 0,
        seguridad: 0,
        siniestros: 0,
        conducta: 0,
      },
      C,
    );
    expect(r.score).toBe(100);
    const km = r.conceptos.find((c) => c.key === "km")!;
    expect(km.sinDatos).toBe(true);
    expect(km.descuento).toBe(0);
  });

  it("normaliza eventos por mes (3 gomas en 3 meses ≈ 1/mes)", () => {
    const unMes = calcularScore({ ...PERFECTO, meses: 1, gomas: 3 }, C);
    const tresMeses = calcularScore({ ...PERFECTO, meses: 3, gomas: 3 }, C);
    // 3 gomas en 1 mes = "muy malo" (tope completo); en 3 meses = 1/mes = leve.
    expect(unMes.score).toBeLessThan(tresMeses.score);
    const gomas3m = tresMeses.conceptos.find((c) => c.key === "gomas")!;
    expect(gomas3m.descuento).toBe(3); // 30% de 9
  });

  it("el score nunca baja de 0", () => {
    const r = calcularScore(
      {
        meses: 1,
        km_mensual: 1000,
        ton_pct: 0.3,
        combustible_lp100: 60,
        gomas: 5,
        roturas_leves: 0,
        roturas_graves: 3,
        seguridad: 5,
        siniestros: 5,
        conducta: 9,
      },
      C,
    );
    expect(r.score).toBe(0);
  });

  it("los topes por defecto suman 100", () => {
    const suma = Object.values(C.topes).reduce((a, b) => a + b, 0);
    expect(suma).toBe(100);
  });
});
