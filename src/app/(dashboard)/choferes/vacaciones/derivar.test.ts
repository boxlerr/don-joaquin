import { describe, it, expect } from "vitest";
import {
  saldosPorAnio,
  anioParaImputar,
  diasPorAntiguedad,
  aniosCumplidos,
  semaforo,
  resumenSaldos,
} from "./derivar";

// Casos tomados de la conciliación real con la planilla de Bárbara (21/07/2026):
// los saldos por año del sistema tienen que reproducir su contabilidad.

describe("saldosPorAnio", () => {
  it("resta lo imputado a cada año (Saenz Buruaga: 28+28 con 21 usados de 2025)", () => {
    const s = saldosPorAnio(
      [
        { anio: 2025, dias: 28 },
        { anio: 2026, dias: 28 },
      ],
      new Map([[2025, 21]]),
    );
    expect(s).toHaveLength(2);
    expect(s[0]).toMatchObject({ anio: 2025, otorgados: 28, usados: 21, saldo: 7 });
    expect(s[1]).toMatchObject({ anio: 2026, otorgados: 28, usados: 0, saldo: 28 });
  });

  it("permite consumo repartido entre años (Jeremias: 7 de 2025 y 7 de 2026)", () => {
    const s = saldosPorAnio(
      [
        { anio: 2025, dias: 14 },
        { anio: 2026, dias: 28 },
      ],
      new Map([
        [2025, 7],
        [2026, 7],
      ]),
    );
    expect(s.find((x) => x.anio === 2025)?.saldo).toBe(7);
    expect(s.find((x) => x.anio === 2026)?.saldo).toBe(21);
    // adeudados (años < 2026) y disponibles como los deriva la vista
    expect(s.filter((x) => x.anio < 2026).reduce((a, x) => a + x.saldo, 0)).toBe(7);
    expect(s.reduce((a, x) => a + x.saldo, 0)).toBe(28);
  });

  it("un año puede quedar en cero y el resto intacto (Diaz: 2025 agotado, 2026 con 21)", () => {
    const s = saldosPorAnio(
      [
        { anio: 2025, dias: 28 },
        { anio: 2026, dias: 28 },
      ],
      new Map([
        [2025, 28],
        [2026, 7],
      ]),
    );
    expect(s.find((x) => x.anio === 2025)?.saldo).toBe(0);
    expect(s.find((x) => x.anio === 2026)?.saldo).toBe(21);
  });

  it("años usados sin fila otorgada quedan visibles con saldo negativo", () => {
    const s = saldosPorAnio([], new Map([[2026, 7]]));
    expect(s).toEqual([{ anio: 2026, otorgados: 0, usados: 7, saldo: -7, observaciones: null }]);
  });
});

describe("resumenSaldos", () => {
  // Casos reales de producción (27/07/2026). El legajo calculaba
  // `corresponden + adeudados − tomados`, que descuenta de nuevo días ya
  // imputados a otro año: 28 de 78 empleados mostraban disponibles de menos.
  const armar = (otorg: [number, number][], usados: [number, number][]) =>
    saldosPorAnio(
      otorg.map(([anio, dias]) => ({ anio, dias })),
      new Map(usados),
    );

  it("Heim: los 11 días imputados a 2025 no tocan los 14 del 2026", () => {
    const r = resumenSaldos(armar([[2025, 11], [2026, 14]], [[2025, 11]]), 2026);
    expect(r).toMatchObject({ corresponden: 14, adeudados: 0, disponibles: 14, diasVencidos: 0 });
    // lo que mostraba el legajo: 14 + 0 − 11 tomados = 3
  });

  it("Cejas: 21 días de 2025 consumidos, el 2026 sigue entero", () => {
    const r = resumenSaldos(armar([[2025, 21], [2026, 28]], [[2025, 21]]), 2026);
    expect(r.disponibles).toBe(28); // el legajo mostraba 7
  });

  it("Cancela: consumo repartido entre 2025 y 2026", () => {
    const r = resumenSaldos(armar([[2025, 7], [2026, 14]], [[2025, 7], [2026, 7]]), 2026);
    expect(r).toMatchObject({ corresponden: 14, adeudados: 0, disponibles: 7 });
  });

  it("el saldo del año anterior es lo adeudado y suma a disponibles", () => {
    const r = resumenSaldos(armar([[2025, 21], [2026, 28]], [[2025, 14]]), 2026);
    expect(r).toMatchObject({ corresponden: 28, adeudados: 7, disponibles: 35, total: 35 });
  });

  it("lo anterior al año pasado ya venció: no suma a disponibles", () => {
    const r = resumenSaldos(armar([[2024, 14], [2025, 21], [2026, 28]], [[2025, 21]]), 2026);
    expect(r).toMatchObject({ adeudados: 0, disponibles: 28, diasVencidos: 14 });
  });

  it("un año cargado por adelantado no cuenta como disponible todavía", () => {
    // Se puede dejar cargado el 2027, pero esos días no están disponibles en 2026.
    const r = resumenSaldos(armar([[2025, 14], [2026, 14], [2027, 14]], [[2025, 14]]), 2026);
    expect(r).toMatchObject({ corresponden: 14, adeudados: 0, disponibles: 14, total: 14 });
  });

  it("un año usado de más deja disponibles en negativo (no lo oculta)", () => {
    const r = resumenSaldos(armar([[2026, 14]], [[2026, 21]]), 2026);
    expect(r.disponibles).toBe(-7);
  });

  it("sin ninguna fila cargada, todo en cero", () => {
    expect(resumenSaldos([], 2026)).toEqual({
      corresponden: 0,
      adeudados: 0,
      disponibles: 0,
      diasVencidos: 0,
      total: 0,
    });
  });
});

describe("anioParaImputar", () => {
  const saldos = (v: [number, number][]) =>
    saldosPorAnio(
      v.map(([anio, dias]) => ({ anio, dias })),
      new Map(),
    );

  it("imputa al año más viejo con saldo", () => {
    expect(anioParaImputar(saldos([[2025, 7], [2026, 28]]), "2026-08-17")).toBe(2025);
  });

  it("saltea años agotados", () => {
    const s = saldosPorAnio(
      [
        { anio: 2025, dias: 21 },
        { anio: 2026, dias: 28 },
      ],
      new Map([[2025, 21]]),
    );
    expect(anioParaImputar(s, "2026-07-20")).toBe(2026);
  });

  it("no imputa a un año posterior al de la fecha", () => {
    // período de dic-2025 no puede consumir días 2026 aunque haya saldo
    const s = saldosPorAnio([{ anio: 2026, dias: 28 }], new Map());
    expect(anioParaImputar(s, "2025-12-22")).toBe(2025);
  });

  it("sin saldo en ningún año, usa el año de la fecha", () => {
    expect(anioParaImputar([], "2026-07-18")).toBe(2026);
  });

  it("no consume años ya vencidos (2024 mirado desde 2026)", () => {
    // El saldo de 2024 venció el 31/12/2025: la vista global ya lo da por
    // perdido, así que un período nuevo no puede gastarlo por lo bajo.
    const s = saldos([[2024, 14], [2025, 7], [2026, 28]]);
    expect(anioParaImputar(s, "2026-08-10")).toBe(2025);
  });

  it("si solo queda saldo vencido, imputa al año de la fecha", () => {
    expect(anioParaImputar(saldos([[2024, 14]]), "2026-08-10")).toBe(2026);
  });
});

describe("días por antigüedad (LCT art. 150)", () => {
  it("escalones 14/21/28/35", () => {
    expect(diasPorAntiguedad(4)).toBe(14);
    expect(diasPorAntiguedad(5)).toBe(21);
    expect(diasPorAntiguedad(10)).toBe(28);
    expect(diasPorAntiguedad(20)).toBe(35);
  });

  it("años cumplidos medidos al 31/12 (Valerga cruza los 10 en oct-2026)", () => {
    expect(aniosCumplidos("2016-10-03", 2025)).toBe(9);
    expect(aniosCumplidos("2016-10-03", 2026)).toBe(10);
  });
});

describe("semáforo", () => {
  it("rojo con saldo viejo, naranja/amarillo por acumulado, verde ok", () => {
    expect(semaforo(7, 21)).toBe("🔴");
    expect(semaforo(0, 30)).toBe("🟠");
    expect(semaforo(0, 21)).toBe("🟡");
    expect(semaforo(0, 14)).toBe("🟢");
  });
});
