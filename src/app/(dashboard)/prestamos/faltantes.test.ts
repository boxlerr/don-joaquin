import { describe, it, expect } from "vitest";
import { faltantesVigentes, textoFaltantes, tieneFaltantes } from "./faltantes";

const base = {
  detalle: null as string | null,
  importe_cuota: 0,
  tasa: null as number | null,
  faltantes: [] as string[],
  datos_faltantes: null as string | null,
};

describe("faltantesVigentes", () => {
  it("se apaga sola cuando el dato se carga", () => {
    const marcado = { ...base, faltantes: ["importe"] };
    expect(faltantesVigentes(marcado)).toEqual(["importe"]);
    expect(faltantesVigentes({ ...marcado, importe_cuota: 4_500_000 })).toEqual([]);
  });

  it("apaga sólo la que se completó", () => {
    const marcado = { ...base, faltantes: ["importe", "tasa"] };
    expect(faltantesVigentes({ ...marcado, importe_cuota: 100 })).toEqual(["tasa"]);
    expect(faltantesVigentes({ ...marcado, importe_cuota: 100, tasa: 45 })).toEqual([]);
  });

  it("la tasa en cero cuenta como cargada", () => {
    expect(faltantesVigentes({ ...base, faltantes: ["tasa"], tasa: 0 })).toEqual([]);
  });

  it("un monto en blanco no cuenta como cargado", () => {
    expect(faltantesVigentes({ ...base, faltantes: ["monto"], detalle: "   " })).toEqual(["monto"]);
    expect(faltantesVigentes({ ...base, faltantes: ["monto"], detalle: "$50.000" })).toEqual([]);
  });

  it("ignora marcas desconocidas en vez de romper", () => {
    expect(faltantesVigentes({ ...base, faltantes: ["cualquier_cosa"] })).toEqual([]);
  });

  it("no inventa faltantes en un préstamo que nunca se marcó", () => {
    // Muchos préstamos legítimamente no tienen tasa cargada y están completos.
    expect(faltantesVigentes({ ...base, tasa: null, importe_cuota: 0 })).toEqual([]);
  });
});

describe("tieneFaltantes", () => {
  it("el triángulo se apaga cuando no queda nada", () => {
    expect(tieneFaltantes({ ...base, faltantes: ["importe"] })).toBe(true);
    expect(tieneFaltantes({ ...base, faltantes: ["importe"], importe_cuota: 1 })).toBe(false);
  });

  it("la nota libre lo mantiene prendido", () => {
    expect(
      tieneFaltantes({ ...base, importe_cuota: 1, datos_faltantes: "si es un pago único" }),
    ).toBe(true);
    expect(tieneFaltantes({ ...base, importe_cuota: 1, datos_faltantes: "   " })).toBe(false);
  });
});

describe("textoFaltantes", () => {
  it("arma la frase con y sin nota", () => {
    expect(textoFaltantes({ ...base, faltantes: ["importe"] })).toBe("el importe de la cuota");
    expect(textoFaltantes({ ...base, faltantes: ["importe", "tasa"] })).toBe(
      "el importe de la cuota y la tasa",
    );
    expect(
      textoFaltantes({ ...base, faltantes: ["monto", "importe"], datos_faltantes: "la fecha" }),
    ).toBe("el monto del préstamo, el importe de la cuota y la fecha");
  });

  it("devuelve null cuando ya está todo", () => {
    expect(textoFaltantes({ ...base, importe_cuota: 1 })).toBeNull();
  });
});
