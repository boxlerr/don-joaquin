import { describe, it, expect } from "vitest";
import {
  armarCalendario,
  corrimiento,
  diasHabilesEntre,
  esDiaHabilBancario,
  esFinDeSemana,
  generarFeriadosLey,
  pascua,
  proximoDiaHabilBancario,
  sumarDias,
  trasladar,
  type Feriado,
} from "./feriados";

describe("pascua", () => {
  // Fechas verificables contra cualquier calendario litúrgico.
  it.each([
    [2024, "2024-03-31"],
    [2025, "2025-04-20"],
    [2026, "2026-04-05"],
    [2027, "2027-03-28"],
    [2028, "2028-04-16"],
    [2030, "2030-04-21"],
  ])("Pascua de %i", (anio, esperado) => {
    expect(pascua(anio)).toBe(esperado);
  });
});

describe("trasladar (art. 6 de la Ley 27.399)", () => {
  it("martes y miércoles van al lunes anterior", () => {
    // 17/8/2027 es martes → 16/8.
    expect(trasladar("2027-08-17")).toEqual({ fecha: "2027-08-16", pendiente: false });
    // 12/10/2027 es martes → 11/10.
    expect(trasladar("2027-10-12")).toEqual({ fecha: "2027-10-11", pendiente: false });
    // 17/6/2026 es miércoles → 15/6.
    expect(trasladar("2026-06-17")).toEqual({ fecha: "2026-06-15", pendiente: false });
  });

  it("jueves y viernes van al lunes siguiente", () => {
    // 17/6/2027 es jueves → 21/6.
    expect(trasladar("2027-06-17")).toEqual({ fecha: "2027-06-21", pendiente: false });
    // 20/11/2026 es viernes → 23/11.
    expect(trasladar("2026-11-20")).toEqual({ fecha: "2026-11-23", pendiente: false });
  });

  it("el lunes se queda donde está", () => {
    expect(trasladar("2026-08-17")).toEqual({ fecha: "2026-08-17", pendiente: false });
  });

  it("sábado y domingo quedan pendientes de decisión, no se inventa la fecha", () => {
    // 20/11/2027 cae sábado: el Decreto 614/2025 lo dejó a criterio de JGM.
    expect(trasladar("2027-11-20")).toEqual({ fecha: "2027-11-20", pendiente: true });
  });
});

describe("generarFeriadosLey", () => {
  const f2026 = generarFeriadosLey(2026);
  const fechas = f2026.map((f) => f.fecha);

  it("trae los inamovibles conocidos de 2026", () => {
    for (const d of [
      "2026-01-01", "2026-03-24", "2026-04-02", "2026-05-01",
      "2026-05-25", "2026-06-20", "2026-07-09", "2026-12-08", "2026-12-25",
    ]) {
      expect(fechas).toContain(d);
    }
  });

  it("aplica el traslado: Güemes al 15/6 y Soberanía al 23/11", () => {
    expect(fechas).toContain("2026-06-15");
    expect(fechas).toContain("2026-11-23");
    // Y NO deja las fechas nominales sueltas.
    expect(fechas).not.toContain("2026-06-17");
    expect(fechas).not.toContain("2026-11-20");
  });

  it("guarda la fecha nominal del que se trasladó", () => {
    const guemes = f2026.find((f) => f.fecha === "2026-06-15");
    expect(guemes?.fecha_nominal).toBe("2026-06-17");
  });

  it("deriva Carnaval y Semana Santa de Pascua", () => {
    // Pascua 2026 = 5/4 → Viernes Santo 3/4, Jueves Santo 2/4, Carnaval 16 y 17/2.
    expect(fechas).toContain("2026-04-03");
    expect(fechas).toContain("2026-04-02");
    expect(fechas).toContain("2026-02-16");
    expect(fechas).toContain("2026-02-17");
  });

  it("el Jueves Santo no es feriado pero cierra el banco", () => {
    const js = f2026.find((f) => f.nombre === "Jueves Santo")!;
    expect(js.es_feriado).toBe(false);
    expect(js.cierra_banco).toBe(true);
  });

  it("incluye el Día del Bancario, que no está en ninguna API", () => {
    const b = f2026.find((f) => f.fecha === "2026-11-06")!;
    expect(b.nombre).toBe("Día del Bancario");
    expect(b.es_feriado).toBe(false);
    expect(b.cierra_banco).toBe(true);
  });

  it("no inventa los puentes turísticos: ésos se cargan a mano", () => {
    // Los 3 de 2026 salen de la Resolución 164/2025, no de la ley.
    for (const d of ["2026-03-23", "2026-07-10", "2026-12-07"]) {
      expect(fechas).not.toContain(d);
    }
  });

  it("funciona para cualquier año, también sin conexión ni API", () => {
    for (const anio of [2027, 2030, 2035]) {
      const fs = generarFeriadosLey(anio);
      expect(fs.length).toBeGreaterThanOrEqual(17);
      expect(fs.every((f) => f.fecha.startsWith(String(anio)))).toBe(true);
    }
  });

  it("sale ordenado por fecha", () => {
    const copia = [...fechas].sort();
    expect(fechas).toEqual(copia);
  });
});

/* Calendario 2026 real para las pruebas de días hábiles. */
const CAL_2026 = armarCalendario([
  ...generarFeriadosLey(2026),
  {
    fecha: "2026-03-23",
    nombre: "Día no laborable con fines turísticos",
    tipo: "turistico",
    es_feriado: false,
    cierra_banco: true,
  } satisfies Feriado,
  {
    fecha: "2026-07-10",
    nombre: "Día no laborable con fines turísticos",
    tipo: "turistico",
    es_feriado: false,
    cierra_banco: true,
  } satisfies Feriado,
]);

describe("esFinDeSemana", () => {
  it("reconoce sábado y domingo", () => {
    expect(esFinDeSemana("2026-08-01")).toBe(true); // sábado
    expect(esFinDeSemana("2026-08-02")).toBe(true); // domingo
    expect(esFinDeSemana("2026-08-03")).toBe(false); // lunes
  });
});

describe("esDiaHabilBancario", () => {
  it("un martes común es hábil", () => {
    expect(esDiaHabilBancario("2026-08-04", CAL_2026)).toBe(true);
  });
  it("los fines de semana no", () => {
    expect(esDiaHabilBancario("2026-08-01", CAL_2026)).toBe(false);
  });
  it("un feriado no", () => {
    expect(esDiaHabilBancario("2026-07-09", CAL_2026)).toBe(false);
  });
  it("un día no laborable turístico tampoco: los bancos cierran igual", () => {
    expect(esDiaHabilBancario("2026-07-10", CAL_2026)).toBe(false);
  });
  it("el Día del Bancario tampoco", () => {
    expect(esDiaHabilBancario("2026-11-06", CAL_2026)).toBe(false);
  });
});

describe("proximoDiaHabilBancario", () => {
  it("un día hábil se devuelve igual", () => {
    expect(proximoDiaHabilBancario("2026-08-04", CAL_2026)).toBe("2026-08-04");
  });

  it("el caso que planteó Bárbara: el sábado se paga el lunes", () => {
    // 1/8/2026 es sábado → lunes 3.
    expect(proximoDiaHabilBancario("2026-08-01", CAL_2026)).toBe("2026-08-03");
  });

  it("salta el fin de semana largo entero", () => {
    // Jue 9/7 feriado, vie 10/7 no laborable turístico, sáb y dom → lunes 13.
    expect(proximoDiaHabilBancario("2026-07-09", CAL_2026)).toBe("2026-07-13");
  });

  it("el Día del Bancario cae viernes 6/11/2026: son 3 días", () => {
    expect(proximoDiaHabilBancario("2026-11-06", CAL_2026)).toBe("2026-11-09");
  });

  it("nunca va para atrás", () => {
    for (const d of ["2026-01-01", "2026-05-01", "2026-12-25"]) {
      expect(proximoDiaHabilBancario(d, CAL_2026) >= d).toBe(true);
    }
  });
});

describe("corrimiento", () => {
  it("no se corre cuando el día es hábil", () => {
    expect(corrimiento("2026-08-04", CAL_2026)).toEqual({
      vencimiento: "2026-08-04",
      efectiva: "2026-08-04",
      dias: 0,
      motivo: null,
    });
  });

  it("explica el sábado", () => {
    const c = corrimiento("2026-08-01", CAL_2026);
    expect(c.efectiva).toBe("2026-08-03");
    expect(c.dias).toBe(2);
    expect(c.motivo).toBe("cae sábado");
  });

  it("explica el domingo", () => {
    expect(corrimiento("2026-08-02", CAL_2026).motivo).toBe("cae domingo");
  });

  it("nombra el feriado cuando lo hay", () => {
    const c = corrimiento("2026-07-09", CAL_2026);
    expect(c.motivo).toBe("Día de la Independencia");
    expect(c.dias).toBe(4);
  });
});

describe("armarCalendario", () => {
  it("cuando dos cosas caen el mismo día gana la que cierra el banco", () => {
    // 2/4/2026: Malvinas (feriado) y Jueves Santo (no laborable).
    const f = CAL_2026.get("2026-04-02")!;
    expect(f.cierra_banco).toBe(true);
    expect(f.es_feriado).toBe(true); // el feriado pleno le gana al no laborable
  });
});

describe("diasHabilesEntre", () => {
  it("cuenta incluyendo las dos puntas", () => {
    // Lun 3 a vie 7 de agosto de 2026: 5 hábiles.
    expect(diasHabilesEntre("2026-08-03", "2026-08-07", CAL_2026)).toBe(5);
  });
  it("descuenta el fin de semana", () => {
    expect(diasHabilesEntre("2026-08-01", "2026-08-07", CAL_2026)).toBe(5);
  });
  it("devuelve 0 si el rango está al revés", () => {
    expect(diasHabilesEntre("2026-08-07", "2026-08-03", CAL_2026)).toBe(0);
  });
});

describe("sumarDias", () => {
  it("cruza fin de mes y fin de año sin corrimientos de zona horaria", () => {
    expect(sumarDias("2026-01-31", 1)).toBe("2026-02-01");
    expect(sumarDias("2026-12-31", 1)).toBe("2027-01-01");
    expect(sumarDias("2026-03-01", -1)).toBe("2026-02-28");
    expect(sumarDias("2028-03-01", -1)).toBe("2028-02-29"); // bisiesto
  });
});
