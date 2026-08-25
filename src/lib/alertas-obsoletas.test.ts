import { describe, it, expect } from "vitest";
import {
  documentoRenovado,
  disparoPrestamo,
  semanalDeSemanaPasada,
  preavisoPrestamoPasado,
} from "./alertas-obsoletas";

describe("documentoRenovado", () => {
  it("apaga el aviso cuando el documento se renovó a una fecha posterior", () => {
    // El caso real: carnet de Gonzalo Juarez, alerta del 10/06/2026, renovado
    // el sábado 08/08 al 03/06/2028 — y el lunes seguía llegando igual.
    expect(documentoRenovado("2026-06-10", "2028-06-03")).toBe(true);
  });

  it("deja el reclamo en pie si la fecha no se movió", () => {
    expect(documentoRenovado("2026-06-10", "2026-06-10")).toBe(false);
  });

  it("deja el reclamo en pie si corrigieron la fecha hacia atrás", () => {
    // Se cargó mal y se arregló: ese documento sigue vencido, se sigue pidiendo.
    expect(documentoRenovado("2026-06-10", "2026-05-01")).toBe(false);
  });

  it("no apaga nada si falta alguna de las dos fechas", () => {
    expect(documentoRenovado(null, "2028-06-03")).toBe(false);
    expect(documentoRenovado("2026-06-10", null)).toBe(false);
    expect(documentoRenovado(undefined, undefined)).toBe(false);
  });

  it("compara por fecha y no por texto suelto (cambio de año)", () => {
    expect(documentoRenovado("2026-12-31", "2027-01-01")).toBe(true);
    expect(documentoRenovado("2027-01-01", "2026-12-31")).toBe(false);
  });
});

describe("disparoPrestamo", () => {
  const LUNES = "2026-08-10";

  it("las ventanas no se superponen: cada día cae en una sola clase", () => {
    // La superposición vieja (`dias <= 1` y `dias <= 7` a la vez) mandaba la
    // misma cuota como "por vencer" y "de esta semana" en el mismo mail.
    const porClase = new Map<string, number[]>();
    for (let dias = -5; dias <= 10; dias++) {
      const clase = disparoPrestamo(dias, LUNES)?.clase ?? "ninguno";
      porClase.set(clase, [...(porClase.get(clase) ?? []), dias]);
    }
    expect(Object.fromEntries(porClase)).toEqual({
      vencido: [-5, -4, -3],
      // Los dos días de gracia: el débito puede estar hecho y no verse todavía.
      gracia: [-2, -1],
      inminente: [0, 1],
      semana: [2, 3, 4, 5, 6, 7],
      ninguno: [8, 9, 10],
    });
  });

  it("vencida manda sobre todo lo demás, pasada la gracia", () => {
    expect(disparoPrestamo(-3, LUNES)?.clase).toBe("vencido");
    expect(disparoPrestamo(-74, LUNES)?.clase).toBe("vencido");
  });

  it("hoy y mañana son 'inminente', no 'semana'", () => {
    expect(disparoPrestamo(0, LUNES)?.clase).toBe("inminente");
    expect(disparoPrestamo(1, LUNES)?.clase).toBe("inminente");
  });

  it("de 2 a 7 días es el recordatorio semanal, anclado al lunes", () => {
    expect(disparoPrestamo(2, LUNES)).toMatchObject({ clase: "semana", umbral: "S:2026-08-10" });
    expect(disparoPrestamo(7, LUNES)?.clase).toBe("semana");
  });

  it("más allá de la semana no avisa nada", () => {
    expect(disparoPrestamo(8, LUNES)).toBeNull();
    expect(disparoPrestamo(365, LUNES)).toBeNull();
  });
});

describe("semanalDeSemanaPasada", () => {
  it("apaga el recordatorio de la semana anterior", () => {
    expect(semanalDeSemanaPasada("prestamo_cuota:S:2026-08-03", "2026-08-10")).toBe(true);
  });

  it("conserva el de la semana en curso", () => {
    expect(semanalDeSemanaPasada("prestamo_cuota:S:2026-08-10", "2026-08-10")).toBe(false);
  });

  it("no toca los avisos que no son semanales", () => {
    expect(semanalDeSemanaPasada("prestamo_cuota:vencido", "2026-08-10")).toBe(false);
    expect(semanalDeSemanaPasada("prestamo_cuota:T1", "2026-08-10")).toBe(false);
    expect(semanalDeSemanaPasada("compliance:vencido", "2026-08-10")).toBe(false);
    expect(semanalDeSemanaPasada(null, "2026-08-10")).toBe(false);
  });
});

describe("preavisoPrestamoPasado", () => {
  const HOY = "2026-08-10";

  it("apaga el 'mañana vence' de una cuota que ya venció", () => {
    // En el mail del 10/08, Santander 45/48 decía "Mañana vence" arriba y
    // "Venció hace 2 días" en el chip.
    expect(preavisoPrestamoPasado("prestamo_cuota:T1", "2026-08-08", HOY)).toBe(true);
    expect(preavisoPrestamoPasado("prestamo_cuota:S:2026-08-03", "2026-08-08", HOY)).toBe(true);
  });

  it("NO apaga la alerta de vencido: se reclama hasta que se pague", () => {
    expect(preavisoPrestamoPasado("prestamo_cuota:vencido", "2026-08-08", HOY)).toBe(false);
  });

  it("no toca el preaviso de una cuota que todavía no venció", () => {
    expect(preavisoPrestamoPasado("prestamo_cuota:T1", "2026-08-11", HOY)).toBe(false);
    expect(preavisoPrestamoPasado("prestamo_cuota:T1", HOY, HOY)).toBe(false);
  });

  it("no toca avisos de otros módulos", () => {
    expect(preavisoPrestamoPasado("compliance:T5", "2026-08-08", HOY)).toBe(false);
    expect(preavisoPrestamoPasado("chofer_ausencia", "2026-08-08", HOY)).toBe(false);
  });
});

describe("disparoPrestamo — la gracia antes de reclamar", () => {
  const LUNES = "2026-08-24";

  it("el día del vencimiento avisa que vence hoy, no que está impaga", () => {
    expect(disparoPrestamo(0, LUNES)).toMatchObject({ clase: "inminente" });
  });

  it("EL CASO: al día siguiente NO reclama, porque el tilde va después del débito", () => {
    // Tildan cuando ven el débito en el banco, un día después del vencimiento.
    // Un reclamo el día 1 no puede acertar nunca.
    expect(disparoPrestamo(-1, LUNES)).toMatchObject({ clase: "gracia", severidad: "info" });
    expect(disparoPrestamo(-2, LUNES)).toMatchObject({ clase: "gracia", severidad: "info" });
  });

  it("pasada la gracia sí reclama, y en crítica", () => {
    expect(disparoPrestamo(-3, LUNES)).toMatchObject({ clase: "vencido", severidad: "critica" });
    expect(disparoPrestamo(-30, LUNES)).toMatchObject({ clase: "vencido", severidad: "critica" });
  });

  it("una cuota por venir sigue avisando como antes", () => {
    expect(disparoPrestamo(1, LUNES)).toMatchObject({ clase: "inminente" });
    expect(disparoPrestamo(5, LUNES)).toMatchObject({ clase: "semana" });
    expect(disparoPrestamo(30, LUNES)).toBeNull();
  });
});
