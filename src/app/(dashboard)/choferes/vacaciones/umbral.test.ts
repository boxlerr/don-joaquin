import { describe, it, expect } from "vitest";
import {
  mergeUmbral,
  umbralBase,
  umbralDeMes,
  umbralDeSemana,
  mesDeSemana,
  UMBRAL_DEFAULT,
} from "./umbral";

describe("mergeUmbral", () => {
  it("sin config guardada cae al comportamiento de siempre (10%, piso 4)", () => {
    expect(mergeUmbral(undefined)).toEqual(UMBRAL_DEFAULT);
    expect(mergeUmbral(null)).toEqual(UMBRAL_DEFAULT);
    expect(mergeUmbral("no es json")).toEqual(UMBRAL_DEFAULT);
  });

  it("acepta el snake_case por si la fila vieja lo guardó así", () => {
    expect(mergeUmbral({ por_mes: { "12": 12 } }).porMes).toEqual({ 12: 12 });
  });

  it("descarta meses fuera de rango y valores vacíos", () => {
    const c = mergeUmbral({ porMes: { "0": 5, "13": 5, "7": 9, "8": null, "9": "" } });
    expect(c.porMes).toEqual({ 7: 9 });
  });

  it("acota los números a rangos sanos", () => {
    const c = mergeUmbral({ modo: "fijo", porcentaje: 999, minimo: -3, fijo: 6.7 });
    expect(c.modo).toBe("fijo");
    expect(c.porcentaje).toBe(100);
    expect(c.minimo).toBe(0);
    expect(c.fijo).toBe(6);
  });
});

describe("umbralBase", () => {
  it("modo auto: porcentaje de la flota con piso", () => {
    const cfg = mergeUmbral({ modo: "auto", porcentaje: 10, minimo: 4 });
    expect(umbralBase(cfg, 60)).toBe(6); // el 6 que veía Bárbara
    expect(umbralBase(cfg, 20)).toBe(4); // 2 → pisado por el mínimo
  });

  it("modo fijo ignora la flota", () => {
    const cfg = mergeUmbral({ modo: "fijo", fijo: 8 });
    expect(umbralBase(cfg, 60)).toBe(8);
    expect(umbralBase(cfg, 5)).toBe(8);
  });
});

describe("umbral por mes", () => {
  const cfg = mergeUmbral({ modo: "auto", porcentaje: 10, minimo: 4, porMes: { 12: 15, 1: 15 } });

  it("diciembre y enero admiten más gente junta", () => {
    expect(umbralDeMes(cfg, 12, 60)).toBe(15);
    expect(umbralDeMes(cfg, 1, 60)).toBe(15);
  });

  it("los meses sin override usan la base", () => {
    expect(umbralDeMes(cfg, 7, 60)).toBe(6);
  });

  it("un override de 0 es válido y no cae a la base", () => {
    expect(umbralDeMes(mergeUmbral({ porMes: { 3: 0 } }), 3, 60)).toBe(0);
  });
});

describe("mesDeSemana", () => {
  it("una semana partida cuenta para el mes que se lleva más días", () => {
    // Lun 29/06/2026 → jue 02/07: 2 días de junio, 5 de julio ⇒ julio
    expect(mesDeSemana("2026-06-29")).toBe(7);
    // Lun 27/07/2026 → jueves 30/07 ⇒ julio
    expect(mesDeSemana("2026-07-27")).toBe(7);
    // Lun 31/08/2026 → jue 03/09 ⇒ septiembre
    expect(mesDeSemana("2026-08-31")).toBe(9);
  });

  it("umbralDeSemana usa ese mes", () => {
    const cfg = mergeUmbral({ modo: "fijo", fijo: 6, porMes: { 12: 15 } });
    expect(umbralDeSemana(cfg, "2026-12-07", 60)).toBe(15);
    expect(umbralDeSemana(cfg, "2026-07-06", 60)).toBe(6);
    // Lun 30/11/2026 → jue 03/12 ⇒ ya cuenta como diciembre
    expect(umbralDeSemana(cfg, "2026-11-30", 60)).toBe(15);
  });
});
