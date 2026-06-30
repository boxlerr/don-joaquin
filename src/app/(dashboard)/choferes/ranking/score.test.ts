import { describe, it, expect } from "vitest";
import {
  calcularScore,
  mergeCriterios,
  RANKING_CRITERIOS_DEFAULT,
  descuentoKm,
  descuentoToneladas,
  descuentoCombustible,
  descuentoGomas,
  descuentoRoturasVarias,
  descuentoSeguridad,
  descuentoConducta,
  type ScoreInputs,
} from "./criterios";

const C = RANKING_CRITERIOS_DEFAULT;

const PERFECTO: ScoreInputs = {
  meses: 1,
  km_mensual: 14000,
  ton_pct: 1.0,
  combustible_lp100: 30,
  gomas: 0,
  roturas_leves: 0,
  roturas_graves: 0,
  seguridad: 0,
  siniestros: 0,
  conducta: 0,
};

describe("tramos (escalas del Excel, con % de la config)", () => {
  it("km: ≥100% sin descuento, baja por tramos", () => {
    expect(descuentoKm(1.0, C.tramos.km)).toBe(0);
    expect(descuentoKm(0.9, C.tramos.km)).toBe(0.35);
    expect(descuentoKm(0.75, C.tramos.km)).toBe(0.7);
    expect(descuentoKm(0.5, C.tramos.km)).toBe(1);
  });

  it("toneladas: penaliza sub Y sobrecarga", () => {
    expect(descuentoToneladas(1.0, C.tramos.toneladas)).toBe(0);
    expect(descuentoToneladas(0.9, C.tramos.toneladas)).toBe(0.4);
    expect(descuentoToneladas(1.1, C.tramos.toneladas)).toBe(0.4);
    expect(descuentoToneladas(0.8, C.tramos.toneladas)).toBe(0.7);
    expect(descuentoToneladas(1.2, C.tramos.toneladas)).toBe(0.7);
    expect(descuentoToneladas(0.5, C.tramos.toneladas)).toBe(1);
    expect(descuentoToneladas(1.4, C.tramos.toneladas)).toBe(1);
  });

  it("combustible: peor cuanto más consume", () => {
    expect(descuentoCombustible(33.6, 33.6, C.tramos.combustible)).toBe(0);
    expect(descuentoCombustible(35, 33.6, C.tramos.combustible)).toBe(0.35);
    expect(descuentoCombustible(37, 33.6, C.tramos.combustible)).toBe(0.7);
    expect(descuentoCombustible(40, 33.6, C.tramos.combustible)).toBe(1);
  });

  it("eventos: gomas / roturas / seguridad / conducta", () => {
    expect(descuentoGomas(0, C.tramos.gomas)).toBe(0);
    expect(descuentoGomas(1, C.tramos.gomas)).toBe(0.3);
    expect(descuentoGomas(3, C.tramos.gomas)).toBe(1);
    expect(descuentoRoturasVarias(0, 0, C.tramos.roturas_varias)).toBe(0);
    expect(descuentoRoturasVarias(1, 0, C.tramos.roturas_varias)).toBe(0.3);
    expect(descuentoRoturasVarias(0, 1, C.tramos.roturas_varias)).toBe(0.7);
    expect(descuentoRoturasVarias(0, 2, C.tramos.roturas_varias)).toBe(1);
    expect(descuentoSeguridad(0, C.tramos.seguridad)).toBe(0);
    expect(descuentoSeguridad(1, C.tramos.seguridad)).toBe(0.7);
    expect(descuentoSeguridad(2, C.tramos.seguridad)).toBe(1);
    expect(descuentoConducta(1, C.tramos.conducta)).toBe(0);
    expect(descuentoConducta(2, C.tramos.conducta)).toBe(0.35);
    expect(descuentoConducta(4, C.tramos.conducta)).toBe(1);
  });
});

describe("calcularScore", () => {
  it("chofer perfecto → 100, sin penalizaciones", () => {
    const r = calcularScore(PERFECTO, C);
    expect(r.score).toBe(100);
    expect(r.desglose).toHaveLength(0);
  });

  it("reproduce el ejemplo del simulador del Excel (topes finales = 64)", () => {
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
    expect(r.score).toBe(64); // 100 - (6+4+5+3+14+4)
  });

  it("el desglose siempre suma al score (100 − Σdescuentos)", () => {
    const r = calcularScore({ ...PERFECTO, km_mensual: 9000, seguridad: 1, gomas: 2 }, C);
    const totalDesc = r.desglose.reduce((s, d) => s + Math.abs(d.puntos), 0);
    expect(100 - totalDesc).toBe(r.score);
  });

  it("ausencia de datos NO penaliza (km/ton/combustible en null)", () => {
    const r = calcularScore(
      { meses: 1, km_mensual: null, ton_pct: null, combustible_lp100: null, gomas: 0, roturas_leves: 0, roturas_graves: 0, seguridad: 0, siniestros: 0, conducta: 0 },
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
    expect(unMes.score).toBeLessThan(tresMeses.score);
    expect(tresMeses.conceptos.find((c) => c.key === "gomas")!.descuento).toBe(3); // 30% de 9
  });

  it("el score nunca baja de 0", () => {
    const r = calcularScore(
      { meses: 1, km_mensual: 1000, ton_pct: 0.3, combustible_lp100: 60, gomas: 5, roturas_leves: 0, roturas_graves: 3, seguridad: 5, siniestros: 5, conducta: 9 },
      C,
    );
    expect(r.score).toBe(0);
  });

  it("editar el % de un nivel cambia el score (config personalizada)", () => {
    const inputs = { ...PERFECTO, seguridad: 1 }; // 1 acta
    const base = calcularScore(inputs, C); // 70% de 20 = -14 → 86
    expect(base.score).toBe(86);
    // El admin baja "1 acta" al 35%
    const custom = mergeCriterios({ ...C, tramos: { ...C.tramos, seguridad: { uno: 0.35, dos_mas: 1 } } });
    const r = calcularScore(inputs, custom); // 35% de 20 = -7 → 93
    expect(r.score).toBe(93);
  });

  it("los topes por defecto suman 100", () => {
    expect(Object.values(C.topes).reduce((a, b) => a + b, 0)).toBe(100);
  });
});

describe("mergeCriterios", () => {
  it("config vacía → defaults completos", () => {
    expect(mergeCriterios({})).toEqual(C);
    expect(mergeCriterios(null)).toEqual(C);
    expect(mergeCriterios("basura")).toEqual(C);
  });

  it("completa campos faltantes y clampa % a [0,1]", () => {
    const r = mergeCriterios({ topes: { km: 25 }, tramos: { seguridad: { uno: 5 } } });
    expect(r.topes.km).toBe(25); // respeta el editado
    expect(r.topes.seguridad).toBe(20); // default para el resto
    expect(r.tramos.seguridad.uno).toBe(1); // 5 clampeado a 1
    expect(r.tramos.seguridad.dos_mas).toBe(1); // default
    expect(r.km_ref_mensual).toBe(13500); // default
  });
});
