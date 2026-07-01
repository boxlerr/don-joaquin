import { describe, it, expect } from "vitest";
import { evaluarOdometro } from "./combustible-eficiencia";

describe("evaluarOdometro", () => {
  it("ok si no hay cargas vecinas (primera carga del camión)", () => {
    expect(evaluarOdometro({ km: 150000, kmPrevio: null, kmSiguiente: null })).toEqual({ ok: true });
  });

  it("ok cuando el km queda entre el anterior y el siguiente", () => {
    expect(
      evaluarOdometro({ km: 150000, kmPrevio: 149000, kmSiguiente: 151000 }),
    ).toEqual({ ok: true });
  });

  it("avisa si el km es MENOR al de la carga anterior (el caso 120.000 → 5.000)", () => {
    expect(evaluarOdometro({ km: 5000, kmPrevio: 120000, kmSiguiente: null })).toEqual({
      ok: false,
      motivo: "menor_al_anterior",
      kmVecino: 120000,
    });
  });

  it("avisa si el km es MAYOR al de una carga posterior (backfill de una fecha vieja)", () => {
    expect(evaluarOdometro({ km: 200000, kmPrevio: 149000, kmSiguiente: 151000 })).toEqual({
      ok: false,
      motivo: "mayor_al_siguiente",
      kmVecino: 151000,
    });
  });

  it("igualar el km del anterior o del siguiente se permite (no es un retroceso)", () => {
    expect(evaluarOdometro({ km: 149000, kmPrevio: 149000, kmSiguiente: 151000 })).toEqual({ ok: true });
    expect(evaluarOdometro({ km: 151000, kmPrevio: 149000, kmSiguiente: 151000 })).toEqual({ ok: true });
  });
});
