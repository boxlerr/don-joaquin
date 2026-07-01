import { describe, it, expect } from "vitest";
import { proximoPeriodoF931 } from "./periodo";

// new Date(año, mesIdx0, día) → hora local; proximoPeriodoF931 lee getFullYear/
// getMonth/getDate (local), así que los casos son deterministas.
describe("proximoPeriodoF931", () => {
  it("antes del día 20: apunta a la fecha límite de este mes (período = mes anterior)", () => {
    expect(proximoPeriodoF931(new Date(2026, 6, 10))).toEqual({
      periodo: "2026-06",
      fechaLimite: "2026-07-20",
    });
  });

  it("el mismo día 20 todavía cuenta como este mes", () => {
    expect(proximoPeriodoF931(new Date(2026, 6, 20))).toEqual({
      periodo: "2026-06",
      fechaLimite: "2026-07-20",
    });
  });

  it("después del día 20: rota al mes siguiente (período = mes en curso)", () => {
    expect(proximoPeriodoF931(new Date(2026, 6, 21))).toEqual({
      periodo: "2026-07",
      fechaLimite: "2026-08-20",
    });
  });

  it("enero antes del 20: el período es diciembre del año anterior", () => {
    expect(proximoPeriodoF931(new Date(2026, 0, 10))).toEqual({
      periodo: "2025-12",
      fechaLimite: "2026-01-20",
    });
  });

  it("fin de diciembre: rota a enero del año siguiente", () => {
    expect(proximoPeriodoF931(new Date(2026, 11, 25))).toEqual({
      periodo: "2026-12",
      fechaLimite: "2027-01-20",
    });
  });
});
