import { describe, it, expect } from "vitest";
import {
  buscarTarifa,
  calcularLitros,
  destinosDe,
  origenesDe,
  redondearLitros,
  TONELADAS_MAX,
  type TarifaGasoil,
} from "./litros-por-tonelada";

/**
 * El cuadro que pasó Nico por WhatsApp el 31/08/2026, tal cual. Se usa como
 * fixture a propósito: si alguien cambia la cuenta, los números de acá tienen
 * que seguir dando lo que da la planilla de la oficina.
 */
const t = (origen: string, destino: string, ltn: number): TarifaGasoil => ({
  origenId: `${origen}|${destino}|o`.slice(0, 0) + origen,
  destinoId: destino,
  origen,
  destino,
  litrosPorTonelada: ltn,
});

const CUADRO: TarifaGasoil[] = [
  t("IBICUY", "Añelo", 22.76),
  t("IBICUY", "SAND POINT", 24.93),
  t("IBICUY", "LAJE9", 26.88),
  t("IBICUY", "LAJE41", 26.88),
  t("SAN NICOLAS", "Añelo", 21.67),
  t("SAN NICOLAS", "SAND POINT", 23.5),
  t("SAN NICOLAS", "LAJE9", 26.51),
  t("SAN NICOLAS", "LAJE41", 26.51),
  t("SAN PEDRO", "Añelo", 21.9),
  t("SAN PEDRO", "SAND POINT", 23.74),
  t("SAN PEDRO", "LAJE9", 26.51),
  t("SAN PEDRO", "LAJE41", 26.51),
];

describe("calcularLitros", () => {
  it("la cuenta de la planilla: 35 tn de Ibicuy a LAJE9", () => {
    // 35 × 26,88 = 940,8. Es el caso típico: 35 tn es la mediana de los 1.015
    // viajes con tonelaje cargado en el sistema.
    const r = calcularLitros(buscarTarifa(CUADRO, "IBICUY", "LAJE9"), 35);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.litros).toBe(940.8);
  });

  it("los doce tramos del cuadro dan un número", () => {
    for (const tar of CUADRO) {
      const r = calcularLitros(tar, 30);
      expect(r.ok).toBe(true);
    }
  });

  it("los dos LAJE rinden lo mismo desde cada origen", () => {
    // Es lo que salta de mirar el cuadro y conviene que quede fijado: si algún
    // día se separan, que sea a propósito.
    for (const origen of ["IBICUY", "SAN NICOLAS", "SAN PEDRO"]) {
      const a = buscarTarifa(CUADRO, origen, "LAJE9")!;
      const b = buscarTarifa(CUADRO, origen, "LAJE41")!;
      expect(a.litrosPorTonelada).toBe(b.litrosPorTonelada);
    }
  });

  it("un tramo que no está en el cuadro no devuelve cero: lo dice", () => {
    // "0 litros" sería la peor respuesta posible, porque parece una respuesta.
    const r = calcularLitros(buscarTarifa(CUADRO, "IBICUY", "LAJE 20"), 35);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("sin_tramo");
  });

  it("sin toneladas pide las toneladas", () => {
    const tar = buscarTarifa(CUADRO, "IBICUY", "LAJE9");
    for (const v of [null, undefined, 0, -5, NaN]) {
      const r = calcularLitros(tar, v as number);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toBe("toneladas_invalidas");
    }
  });

  it("frena el dedo resbalado: 3500 son kilos, no toneladas", () => {
    const r = calcularLitros(buscarTarifa(CUADRO, "IBICUY", "LAJE9"), 3500);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toBe("toneladas_fuera_de_rango");
      expect(r.mensaje).toContain("kilos");
    }
  });

  it("el tope deja pasar cualquier equipo real", () => {
    // El viaje más cargado del sistema son 38 tn.
    expect(calcularLitros(buscarTarifa(CUADRO, "IBICUY", "LAJE9"), 38).ok).toBe(true);
    expect(calcularLitros(buscarTarifa(CUADRO, "IBICUY", "LAJE9"), TONELADAS_MAX).ok).toBe(true);
  });

  it("redondea a un decimal, que es como se pide en el surtidor", () => {
    expect(redondearLitros(940.7999999)).toBe(940.8);
    expect(redondearLitros(1.04)).toBe(1);
    expect(redondearLitros(1.05)).toBe(1.1);
    // 27,5 × 23,74 = 652,85 → 652,9 (y no 652,8 por punto flotante)
    const r = calcularLitros(buscarTarifa(CUADRO, "SAN PEDRO", "SAND POINT"), 27.5);
    if (r.ok) expect(r.litros).toBe(652.9);
  });

  it("acepta media tonelada", () => {
    const r = calcularLitros(buscarTarifa(CUADRO, "SAN NICOLAS", "SAND POINT"), 30.5);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.litros).toBe(716.8); // 30,5 × 23,5 = 716,75
  });
});

describe("buscarTarifa", () => {
  it("no cruza tramos: el par tiene que coincidir entero", () => {
    expect(buscarTarifa(CUADRO, "IBICUY", "Añelo")?.litrosPorTonelada).toBe(22.76);
    expect(buscarTarifa(CUADRO, "SAN PEDRO", "Añelo")?.litrosPorTonelada).toBe(21.9);
    expect(buscarTarifa(CUADRO, "Añelo", "IBICUY")).toBeNull();
  });

  it("sin origen o sin destino no devuelve nada", () => {
    expect(buscarTarifa(CUADRO, null, "LAJE9")).toBeNull();
    expect(buscarTarifa(CUADRO, "IBICUY", undefined)).toBeNull();
  });
});

describe("las listas de la pantalla", () => {
  it("los orígenes salen del cuadro, sin repetir y ordenados", () => {
    expect(origenesDe(CUADRO).map((o) => o.nombre)).toEqual([
      "IBICUY",
      "SAN NICOLAS",
      "SAN PEDRO",
    ]);
  });

  it("los destinos se acotan al origen elegido", () => {
    // Ofrecer un destino sin valor es ofrecer un camino a un error.
    expect(destinosDe(CUADRO, "IBICUY").map((d) => d.nombre)).toEqual([
      "Añelo",
      "LAJE41",
      "LAJE9",
      "SAND POINT",
    ]);
  });

  it("sin origen elegido no hay destinos que ofrecer", () => {
    expect(destinosDe(CUADRO, null)).toEqual([]);
  });
});
