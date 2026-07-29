import { describe, it, expect } from "vitest";
import {
  saldosPorAnio,
  anioParaImputar,
  diasPorAntiguedad,
  diasPorAntiguedadEnAnio,
  aniosCumplidos,
  semaforo,
  resumenSaldos,
  chequeoLey,
  explicarAntiguedad,
  aniosEnRojo,
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

// Los 5 casos graves que dejó la conciliación del 22/07/2026: gente a la que
// legalmente se le deben días y que ninguna pantalla marcaba, porque el
// `desfasaje` de derivarVacaciones sólo mira el año EN CURSO y todos son de 2025.
describe("chequeoLey", () => {
  // El 2026 se carga con lo que marca la ley para aislar el caso al 2025: si no,
  // el chequeo (que mira los dos años vigentes) también lo reportaría.
  const anio2025 = (otorgados: number, ingreso: string) =>
    saldosPorAnio(
      [
        { anio: 2025, dias: otorgados },
        { anio: 2026, dias: diasPorAntiguedadEnAnio(ingreso, 2026) },
      ],
      new Map(),
    );

  it.each([
    ["Trejo", "2009-12-14", 16, 28, 12],
    ["Cancela", "2022-03-14", 7, 14, 7],
    ["Pucheta", "2016-12-16", 14, 21, 7],
    ["Joaquín Jeremías", "2016-08-01", 14, 21, 7],
    ["Quiroga", "2019-07-01", 15, 21, 6],
  ])("%s: tiene %s y le corresponden %s", (_n, ingreso, otorgados, ley, faltan) => {
    const r = chequeoLey(anio2025(otorgados as number, ingreso as string), ingreso as string, 2026);
    expect(r).toEqual([{ anio: 2025, otorgados, ley, faltan }]);
  });

  it("no confunde 'le faltan' con 'le sobran' (arrastre legítimo)", () => {
    // Novillo: 35 cargados en 2025 donde la ley da 21. Tiene días DE MÁS.
    expect(chequeoLey(anio2025(35, "2020-09-21"), "2020-09-21", 2026)).toEqual([]);
  });

  it("ignora los años ya vencidos: no se pueden arreglar y sólo hacen ruido", () => {
    const s = saldosPorAnio(
      [
        { anio: 2023, dias: 0 },
        { anio: 2025, dias: 21 },
        { anio: 2026, dias: 28 },
      ],
      new Map(),
    );
    expect(chequeoLey(s, "2010-01-02", 2026).map((x) => x.anio)).toEqual([2025]);
  });

  it("sin fecha de ingreso no inventa nada", () => {
    expect(chequeoLey(anio2025(0, "2020-01-01"), null, 2026)).toEqual([]);
  });

  it("no reclama años anteriores al ingreso", () => {
    // Entró en 2026: el 2025 no le corresponde y no tiene que aparecer.
    const s = saldosPorAnio([{ anio: 2026, dias: 14 }], new Map());
    expect(chequeoLey(s, "2026-02-01", 2026)).toEqual([]);
  });
});

describe("diasPorAntiguedadEnAnio", () => {
  it("mide la antigüedad al 31/12 del año de la fila, no al de hoy", () => {
    // Cruza los 5 años en 2025: agregar el 2024 en el editor proponía los días
    // del año en curso, o sea 21 donde iban 14.
    expect(diasPorAntiguedadEnAnio("2020-03-01", 2024)).toBe(14);
    expect(diasPorAntiguedadEnAnio("2020-03-01", 2026)).toBe(21);
  });
});

describe("explicarAntiguedad", () => {
  it("avisa el año en que le cambian los días (Alveira pasa de 21 a 28)", () => {
    const frase = explicarAntiguedad("2017-07-03", 2026);
    expect(frase).toContain("Ingresó el 03/07/2017");
    expect(frase).toContain("Al 31/12/2026 cumple 9 años → 21 días");
    expect(frase).toContain("Al 31/12/2027 cumple 10 y pasa a 28");
  });

  it("cuando no cambia, dice que el año nuevo se abre solo", () => {
    // Cancela en 2025: 3 años al cierre y 4 al siguiente, los dos de 14 días.
    expect(explicarAntiguedad("2022-03-14", 2025)).toContain(
      "El 1 de enero el sistema le abre el 2026 solo",
    );
  });

  it("en el tramo máximo aclara que ya no cambia más", () => {
    expect(explicarAntiguedad("2000-05-10", 2026)).toContain("Ya está en el tramo más alto");
  });

  it("sin fecha de ingreso lo dice en lugar de calcular cualquier cosa", () => {
    expect(explicarAntiguedad(null, 2026)).toContain("No tiene fecha de ingreso cargada");
  });
});

describe("aniosEnRojo", () => {
  it("marca los años con más días imputados que otorgados", () => {
    const s = saldosPorAnio([{ anio: 2025, dias: 3 }, { anio: 2026, dias: 14 }], new Map([[2025, 18]]));
    expect(aniosEnRojo(s)).toEqual([{ anio: 2025, otorgados: 3, usados: 18 }]);
  });

  it("un año justo en cero no está en rojo", () => {
    expect(aniosEnRojo(saldosPorAnio([{ anio: 2025, dias: 14 }], new Map([[2025, 14]])))).toEqual([]);
  });
});
