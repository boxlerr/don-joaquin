import { describe, it, expect } from "vitest";
import {
  agruparPorCantera,
  agruparPorChofer,
  agruparPorTramo,
  bordesDelMesAr,
  calcularDesvio,
  diasDelMes,
  mesAnterior,
  partesArgentinas,
  serieDiaria,
  totales,
  variacion,
  type AutorizacionCruda,
  type CargaCruda,
} from "./reporte";

/**
 * Los números de referencia salen del reporte de autoconsumo de YPF de agosto
 * 2026: IBICUY→LAJE9 liquidó 19.961 L sobre 742,6 tn, o sea 26,88 L/tn. Si estas
 * cuentas dejan de dar eso, el papel que emitimos deja de cruzar con el de ellos.
 */
const aut = (p: Partial<AutorizacionCruda> & { id: string }): AutorizacionCruda => ({
  fecha: "2026-09-01",
  hora: "10:00",
  chofer: "Asteazarán Cristian",
  cantera: "IBICUY",
  destino: "LAJE41",
  toneladas: 35,
  litrosPorTonelada: 26.88,
  litros: 940.8,
  observaciones: null,
  ...p,
});

describe("partesArgentinas", () => {
  it("una vuelta de las 22:30 del 31 queda en el 31, no en el 1", () => {
    // 2026-09-01T01:30Z son las 22:30 del 31/08 en Argentina.
    expect(partesArgentinas("2026-09-01T01:30:00Z")).toEqual({
      fecha: "2026-08-31",
      hora: "22:30",
    });
  });

  it("una fecha imposible no rompe el reporte entero", () => {
    expect(partesArgentinas("cualquier cosa")).toEqual({ fecha: "", hora: "" });
  });
});

describe("bordesDelMesAr", () => {
  it("escribe el huso adentro, para que el mes no salga corrido", () => {
    expect(bordesDelMesAr("2026-09")).toEqual({
      desde: "2026-09-01T00:00:00-03:00",
      hasta: "2026-10-01T00:00:00-03:00",
    });
  });

  it("diciembre cierra contra enero del año que viene", () => {
    expect(bordesDelMesAr("2026-12").hasta).toBe("2027-01-01T00:00:00-03:00");
  });
});

describe("mesAnterior y diasDelMes", () => {
  it("enero mira a diciembre del año pasado", () => {
    expect(mesAnterior("2026-01")).toBe("2025-12");
  });
  it("febrero de un bisiesto tiene 29", () => {
    expect(diasDelMes("2028-02")).toBe(29);
    expect(diasDelMes("2026-02")).toBe(28);
    expect(diasDelMes("2026-09")).toBe(30);
  });
});

describe("agruparPorTramo", () => {
  it("junta las vueltas del mismo tramo y suma toneladas y litros", () => {
    const [l] = agruparPorTramo([
      aut({ id: "1", toneladas: 35, litros: 940.8 }),
      aut({ id: "2", toneladas: 22, litros: 591.4 }),
    ]);
    expect(l).toMatchObject({
      cantera: "IBICUY",
      destino: "LAJE41",
      vueltas: 2,
      toneladas: 57,
      litrosTeoricos: 1532.2,
      litrosPorTonelada: 26.88,
      rindeMixto: false,
    });
  });

  it("si en el mes cambió la tarifa, muestra el promedio ponderado y lo marca", () => {
    const [l] = agruparPorTramo([
      aut({ id: "1", toneladas: 10, litrosPorTonelada: 26.88, litros: 268.8 }),
      aut({ id: "2", toneladas: 10, litrosPorTonelada: 28, litros: 280 }),
    ]);
    expect(l!.rindeMixto).toBe(true);
    expect(l!.litrosPorTonelada).toBeCloseTo(27.44, 2);
  });

  it("ordena por cantera y después por destino, como el cuadro de YPF", () => {
    const orden = agruparPorTramo([
      aut({ id: "1", cantera: "SAN PEDRO", destino: "LAJE9" }),
      aut({ id: "2", cantera: "IBICUY", destino: "SAND POINT" }),
      aut({ id: "3", cantera: "IBICUY", destino: "LAJE41" }),
    ]).map((l) => `${l.cantera}→${l.destino}`);
    expect(orden).toEqual(["IBICUY→LAJE41", "IBICUY→SAND POINT", "SAN PEDRO→LAJE9"]);
  });
});

describe("agruparPorCantera", () => {
  it("cuelga los destinos de su cantera con el subtotal", () => {
    const grupos = agruparPorCantera(
      agruparPorTramo([
        aut({ id: "1", cantera: "IBICUY", destino: "LAJE41", toneladas: 35, litros: 940.8 }),
        aut({ id: "2", cantera: "IBICUY", destino: "LAJE9", toneladas: 22, litros: 591.4 }),
        aut({ id: "3", cantera: "SAN PEDRO", destino: "Añelo", toneladas: 10, litros: 219 }),
      ]),
    );
    expect(grupos.map((g) => g.cantera)).toEqual(["IBICUY", "SAN PEDRO"]);
    expect(grupos[0]).toMatchObject({ vueltas: 2, toneladas: 57, litrosTeoricos: 1532.2 });
    expect(grupos[0]!.destinos).toHaveLength(2);
  });
});

describe("agruparPorChofer", () => {
  it("suma por persona y calcula el rinde promedio que le tocó", () => {
    const [primero] = agruparPorChofer([
      aut({ id: "1", chofer: "Pérez", toneladas: 30, litros: 806.4 }),
      aut({ id: "2", chofer: "Pérez", toneladas: 30, litros: 806.4 }),
      aut({ id: "3", chofer: "Gómez", toneladas: 10, litros: 268.8 }),
    ]);
    expect(primero).toMatchObject({ chofer: "Pérez", vueltas: 2, toneladas: 60 });
    expect(primero!.litrosPorTonelada).toBeCloseTo(26.88, 2);
  });

  it("la vuelta sin chofer se agrupa con nombre propio, no se descarta", () => {
    const filas = agruparPorChofer([aut({ id: "1", chofer: null })]);
    expect(filas).toHaveLength(1);
    expect(filas[0]!.chofer).toBe("Sin chofer asignado");
  });
});

describe("serieDiaria", () => {
  const auts = [
    aut({ id: "1", fecha: "2026-09-01", toneladas: 35, litros: 940.8 }),
    aut({ id: "2", fecha: "2026-09-03", toneladas: 22, litros: 591.4 }),
  ];

  it("un mes sin ninguna carga deja los cargados en null, nunca en cero", () => {
    const serie = serieDiaria(auts, [], "2026-09");
    expect(serie).toHaveLength(30);
    expect(serie.every((d) => d.litrosCargados === null)).toBe(true);
    expect(serie.every((d) => d.acumCargados === null)).toBe(true);
  });

  it("un día sin cargas dentro de un mes que sí tiene, va en cero de verdad", () => {
    const cargas: CargaCruda[] = [
      { fecha: "2026-09-01", litros: 500 },
      { fecha: "2026-09-03", litros: 300 },
    ];
    const serie = serieDiaria(auts, cargas, "2026-09");
    expect(serie[0]!.litrosCargados).toBe(500);
    expect(serie[1]!.litrosCargados).toBe(0);
    expect(serie[2]!.acumCargados).toBe(800);
  });

  it("acumula el teórico y lo deja plano en los días sin vueltas", () => {
    const serie = serieDiaria(auts, [], "2026-09");
    expect(serie[0]!.acumTeoricos).toBe(940.8);
    expect(serie[1]!.acumTeoricos).toBe(940.8);
    expect(serie[2]!.acumTeoricos).toBe(1532.2);
    expect(serie[29]!.acumTeoricos).toBe(1532.2);
  });

  it("en el mes en curso corta el día de hoy y no dibuja el futuro", () => {
    const serie = serieDiaria(auts, [], "2026-09", 5);
    expect(serie).toHaveLength(5);
    expect(serie.at(-1)!.dia).toBe(5);
  });

  it("lo que cae fuera del mes no entra ni ensucia el acumulado", () => {
    const serie = serieDiaria(
      [...auts, aut({ id: "3", fecha: "2026-08-31", litros: 1000 })],
      [{ fecha: "2026-10-01", litros: 999 }],
      "2026-09",
    );
    expect(serie.at(-1)!.acumTeoricos).toBe(1532.2);
    expect(serie.at(-1)!.acumCargados).toBe(0);
  });
});

describe("totales y desvío", () => {
  it("sin cargas el total va en null y no hay desvío que mostrar", () => {
    const t = totales([aut({ id: "1", litros: 940.8 })], []);
    expect(t.litrosCargados).toBeNull();
    expect(calcularDesvio(t.litrosTeoricos, t.litrosCargados)).toBeNull();
  });

  it("reproduce el desvío de agosto de YPF: 34.999 sobre 48.966 es −28,5 %", () => {
    const d = calcularDesvio(48966, 34999)!;
    expect(d.litros).toBe(-13967);
    expect(d.pct).toBeCloseTo(-28.5, 1);
  });

  it("no divide por cero cuando no se autorizó nada", () => {
    expect(calcularDesvio(0, 120)).toEqual({ litros: 120, pct: null });
  });
});

describe("variacion", () => {
  it("compara contra el mes anterior", () => {
    expect(variacion(120, 100)).toBeCloseTo(20, 5);
  });
  it("no inventa un porcentaje cuando el mes anterior está vacío o falta", () => {
    expect(variacion(120, 0)).toBeNull();
    expect(variacion(120, null)).toBeNull();
    expect(variacion(null, 100)).toBeNull();
  });
});
