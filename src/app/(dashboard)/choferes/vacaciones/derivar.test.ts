import { describe, it, expect } from "vitest";
import {
  saldosPorAnio,
  anioParaImputar,
  diasPorAntiguedad,
  aniosCumplidos,
  semaforo,
  resumenSaldos,
  subeADiasEn,
  ventanaGoce,
  yaSePuedeTomar,
  esNotaDeProceso,
  notaVisible,
  vinoDeImportacion,
  fmtDiaLargo,
  fmtRangoFechas,
  diaSiguiente,
  fmtRangoCorto,
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

// Reemplazo del "sube en 37 meses" que se rechazó: hay que decir el AÑO concreto
// y a cuántos días pasa.
describe("subeADiasEn", () => {
  it("el año del escalón es el de ingreso más los años del escalón", () => {
    expect(subeADiasEn("2013-07-01", 12)).toEqual({ anio: 2033, dias: 35 }); // 2013+20
    expect(subeADiasEn("2022-11-30", 3)).toEqual({ anio: 2027, dias: 21 }); // 2022+5
    expect(subeADiasEn("2016-10-03", 9)).toEqual({ anio: 2026, dias: 28 }); // 2016+10
  });

  it("NO depende del mes de ingreso: la antigüedad se mide al 31/12", () => {
    // Si dependiera del mes, "en marzo de 2033 pasa a 35" sería una fecha falsa:
    // los 35 días valen para TODO el período 2033.
    expect(subeADiasEn("2013-01-01", 12)?.anio).toBe(2033);
    expect(subeADiasEn("2013-12-31", 12)?.anio).toBe(2033);
  });

  it("en el tramo máximo o sin ingreso no hay próximo escalón", () => {
    expect(subeADiasEn("2000-05-10", 21)).toBeNull();
    expect(subeADiasEn(null, 3)).toBeNull();
    expect(subeADiasEn("no-es-fecha", 3)).toBeNull();
  });
});

describe("ventanaGoce / yaSePuedeTomar (LCT art. 154)", () => {
  it("la ventana va del 1/10 del año al 30/4 del siguiente", () => {
    expect(ventanaGoce(2026)).toEqual({ desde: "2026-10-01", hasta: "2027-04-30" });
  });

  it('"los de 2026 son a partir de octubre" (lo que subrayó Bárbara)', () => {
    expect(yaSePuedeTomar(2026, "2026-07-29")).toBe(false);
    expect(yaSePuedeTomar(2026, "2026-10-01")).toBe(true);
    expect(yaSePuedeTomar(2025, "2026-07-29")).toBe(true);
  });
});

describe("notaVisible / vinoDeImportacion / esNotaDeProceso", () => {
  it("la metadata del importador no se muestra como si fuera una nota humana", () => {
    const imp = "Import cronograma (VACACIONES 2, 21/07/2026)";
    expect(notaVisible(imp)).toBeNull();
    expect(esNotaDeProceso(imp)).toBe(true);
    expect(vinoDeImportacion(imp)).toBe(true);

    const planilla = "Importado de planilla (21/07/2026)";
    expect(notaVisible(planilla)).toBeNull();
    expect(vinoDeImportacion(planilla)).toBe(true);
  });

  it("el alta automática es proceso pero NO vino de la planilla", () => {
    // La escribe lib.ts cuando falta la fila del año en curso.
    const alta = "Alta automática del período 2026 (días por antigüedad)";
    expect(notaVisible(alta)).toBeNull();
    expect(esNotaDeProceso(alta)).toBe(true);
    expect(vinoDeImportacion(alta)).toBe(false);
  });

  it("una nota escrita por una persona se conserva", () => {
    expect(notaVisible("adelanta una semana por casamiento")).toBe("adelanta una semana por casamiento");
    expect(notaVisible(null)).toBeNull();
    expect(notaVisible("   ")).toBeNull();
  });
});

describe("fmtRangoFechas / fmtDiaLargo", () => {
  const hoy = "2026-07-29";

  it("mismo mes, mes distinto y cruce de año", () => {
    expect(fmtRangoFechas("2026-07-07", "2026-07-20", hoy)).toBe("del 7 al 20 de julio");
    expect(fmtRangoFechas("2026-07-28", "2026-08-04", hoy)).toBe("del 28 de julio al 4 de agosto");
    expect(fmtRangoFechas("2026-12-28", "2027-01-10", hoy)).toBe(
      "del 28 de diciembre de 2026 al 10 de enero de 2027",
    );
  });

  it("un día en prosa, con el año sólo cuando no es el de hoy", () => {
    expect(fmtDiaLargo("2026-07-21", hoy)).toBe("martes 21 de julio");
    expect(fmtDiaLargo("2027-01-04", hoy)).toBe("lunes 4 de enero de 2027");
  });
});

describe("diaSiguiente", () => {
  it("devuelve el día en que vuelve a trabajar", () => {
    expect(diaSiguiente("2026-08-02")).toBe("2026-08-03");
  });

  it("cruza fin de mes y fin de año", () => {
    expect(diaSiguiente("2026-01-31")).toBe("2026-02-01");
    expect(diaSiguiente("2026-12-31")).toBe("2027-01-01");
  });

  it("contempla el 29 de febrero de los años bisiestos", () => {
    expect(diaSiguiente("2028-02-28")).toBe("2028-02-29");
    expect(diaSiguiente("2027-02-28")).toBe("2027-03-01");
  });
});

describe("fmtRangoCorto", () => {
  it("no repite el mes cuando empieza y termina en el mismo", () => {
    expect(fmtRangoCorto("2026-08-17", "2026-08-23")).toBe("17 – 23 ago 2026");
  });

  it("nombra los dos meses cuando cruza de mes", () => {
    expect(fmtRangoCorto("2026-07-27", "2026-08-02")).toBe("27 jul – 2 ago 2026");
  });

  it("repite el año sólo cuando cruza de año", () => {
    expect(fmtRangoCorto("2025-12-29", "2026-01-04")).toBe("29 dic 2025 – 4 ene 2026");
  });

  it("siempre lleva el año: en diez años de historia es lo que desambigua", () => {
    expect(fmtRangoCorto("2019-03-04", "2019-03-10")).toContain("2019");
  });
});
