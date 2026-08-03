import { describe, it, expect } from "vitest";
import { addMonths, armarCronograma, mesesAlFinal, mesesAlInicio } from "./cronograma";

describe("addMonths", () => {
  it("mantiene el día de la cuota", () => {
    expect(addMonths("2026-08-29", 1)).toBe("2026-09-29");
    expect(addMonths("2026-08-29", 12)).toBe("2027-08-29");
  });

  it("clampea a fin de mes en los meses cortos", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29"); // bisiesto
  });

  it("va para atrás", () => {
    expect(addMonths("2026-08-29", -11)).toBe("2025-09-29");
  });
});

describe("armarCronograma", () => {
  it("reconstruye hacia atrás las cuotas ya pagadas", () => {
    // El caso real: Santander entró como 1 de 1 y en verdad es la última de 12,
    // que vence el 29/08. Las 11 anteriores son historia, no futuro.
    const plan = armarCronograma({ cuotasTotal: 12, proximaNro: 12, proximaFecha: "2026-08-29" });
    expect(plan).toHaveLength(12);
    expect(plan[0]).toEqual({ nro: 1, fecha_vencimiento: "2025-09-29", pagada: true });
    expect(plan[10]!.pagada).toBe(true);
    expect(plan[11]).toEqual({ nro: 12, fecha_vencimiento: "2026-08-29", pagada: false });
  });

  it("un préstamo nuevo arranca todo impago", () => {
    const plan = armarCronograma({ cuotasTotal: 3, proximaNro: 1, proximaFecha: "2026-09-10" });
    expect(plan.map((c) => c.fecha_vencimiento)).toEqual([
      "2026-09-10",
      "2026-10-10",
      "2026-11-10",
    ]);
    expect(plan.every((c) => !c.pagada)).toBe(true);
  });
});

describe("mesesAlFinal", () => {
  const cuotas = [
    { nro: 1, fecha_vencimiento: "2026-06-10" },
    { nro: 2, fecha_vencimiento: "2026-07-10" },
  ];

  it("sigue numerando y fechando desde la última", () => {
    expect(mesesAlFinal(cuotas, 2)).toEqual([
      { nro: 3, fecha_vencimiento: "2026-08-10" },
      { nro: 4, fecha_vencimiento: "2026-09-10" },
    ]);
  });

  it("con fechas corregidas a mano sigue de la más lejana, no de la de número más alto", () => {
    const desordenadas = [
      { nro: 1, fecha_vencimiento: "2026-09-15" },
      { nro: 2, fecha_vencimiento: "2026-08-10" },
    ];
    expect(mesesAlFinal(desordenadas, 1)).toEqual([{ nro: 3, fecha_vencimiento: "2026-10-15" }]);
  });

  it("no agrega nada si no hay de dónde seguir o el número no sirve", () => {
    expect(mesesAlFinal([], 3)).toEqual([]);
    expect(mesesAlFinal(cuotas, 0)).toEqual([]);
    expect(mesesAlFinal(cuotas, -1)).toEqual([]);
    expect(mesesAlFinal(cuotas, 1.5)).toEqual([]);
  });
});

describe("mesesAlInicio", () => {
  it("cuenta para atrás y numera de 1 en adelante", () => {
    // El caso del Santander: está cargada la última (29/08) y faltan las 11
    // viejas, que van de 29/09/2025 a 29/07/2026.
    const nuevas = mesesAlInicio([{ nro: 1, fecha_vencimiento: "2026-08-29" }], 11);
    expect(nuevas).toHaveLength(11);
    expect(nuevas[0]).toEqual({ nro: 1, fecha_vencimiento: "2025-09-29" });
    expect(nuevas.at(-1)).toEqual({ nro: 11, fecha_vencimiento: "2026-07-29" });
  });

  it("se cuelga de la cuota más vieja, no de la de número más bajo", () => {
    const desordenadas = [
      { nro: 1, fecha_vencimiento: "2026-09-10" },
      { nro: 2, fecha_vencimiento: "2026-06-10" },
    ];
    expect(mesesAlInicio(desordenadas, 2)).toEqual([
      { nro: 1, fecha_vencimiento: "2026-04-10" },
      { nro: 2, fecha_vencimiento: "2026-05-10" },
    ]);
  });

  it("no agrega nada si no hay de dónde colgarse o el número no sirve", () => {
    const una = [{ nro: 1, fecha_vencimiento: "2026-08-29" }];
    expect(mesesAlInicio([], 3)).toEqual([]);
    expect(mesesAlInicio(una, 0)).toEqual([]);
    expect(mesesAlInicio(una, 2.5)).toEqual([]);
  });
});
