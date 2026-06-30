import { describe, it, expect } from "vitest";
import {
  pickTarifaAplicable,
  computeImporteTarifa,
  rutaDeTarifa,
  detalleTarifa,
  type TarifaAplicable,
} from "./tarifa-importe";

const ruta = (origen_id: string, destino_id: string, km: number | null = null) => ({
  origen_id,
  destino_id,
  km_oficiales: km,
});

function tarifa(over: Partial<TarifaAplicable> & { id: string }): TarifaAplicable {
  return {
    modalidad: "por_tonelada",
    valor: 1000,
    moneda: "ARS",
    ruta_id: null,
    ruta: null,
    ...over,
  };
}

describe("computeImporteTarifa", () => {
  it("por_tonelada = toneladas × valor", () => {
    expect(computeImporteTarifa("por_tonelada", 1500, { tonelaje: 30, kmConCarga: 0 })).toBe(45000);
  });

  it("por_kilo = toneladas × 1000 × valor", () => {
    expect(computeImporteTarifa("por_kilo", 2, { tonelaje: 1.5, kmConCarga: 0 })).toBe(3000);
  });

  it("fija = valor (no depende de tn ni km)", () => {
    expect(computeImporteTarifa("fija", 50000, { tonelaje: 99, kmConCarga: 999 })).toBe(50000);
  });

  it("por_km usa los km de la ruta si existen", () => {
    expect(computeImporteTarifa("por_km", 100, { tonelaje: 0, kmConCarga: 50, kmRuta: 300 })).toBe(30000);
  });

  it("por_km cae a los km del viaje si la ruta no tiene km (0/null)", () => {
    expect(computeImporteTarifa("por_km", 100, { tonelaje: 0, kmConCarga: 50, kmRuta: 0 })).toBe(5000);
    expect(computeImporteTarifa("por_km", 100, { tonelaje: 0, kmConCarga: 50, kmRuta: null })).toBe(5000);
  });

  it("redondea a 2 decimales", () => {
    expect(computeImporteTarifa("por_tonelada", 1000.005, { tonelaje: 1, kmConCarga: 0 })).toBe(1000.01);
  });

  it("tonelaje 0 en por_tonelada da 0 (el caller lo descarta)", () => {
    expect(computeImporteTarifa("por_tonelada", 1500, { tonelaje: 0, kmConCarga: 0 })).toBe(0);
  });
});

describe("rutaDeTarifa", () => {
  it("normaliza la ruta como objeto", () => {
    expect(rutaDeTarifa({ ruta: ruta("o", "d", 10) })).toEqual(ruta("o", "d", 10));
  });
  it("normaliza la ruta como array de uno (PostgREST)", () => {
    expect(rutaDeTarifa({ ruta: [ruta("o", "d", 10)] })).toEqual(ruta("o", "d", 10));
  });
  it("null cuando no hay ruta", () => {
    expect(rutaDeTarifa({ ruta: null })).toBeNull();
    expect(rutaDeTarifa({ ruta: [] })).toBeNull();
  });
});

describe("pickTarifaAplicable", () => {
  it("prioriza la ruta exacta (origen + destino)", () => {
    const vigentes = [
      tarifa({ id: "general", ruta_id: null, ruta: null }),
      tarifa({ id: "destino", ruta_id: "r2", ruta: ruta("otroOrigen", "D") }),
      tarifa({ id: "exacta", ruta_id: "r1", ruta: ruta("O", "D") }),
    ];
    expect(pickTarifaAplicable(vigentes, "O", "D")?.id).toBe("exacta");
  });

  it("cae a mismo destino cuando el origen difiere ('el destino define el precio')", () => {
    const vigentes = [
      tarifa({ id: "general", ruta_id: null, ruta: null }),
      tarifa({ id: "destino", ruta_id: "r2", ruta: ruta("cantera", "Añelo") }),
    ];
    // El operador cargó otro origen, pero el destino coincide.
    expect(pickTarifaAplicable(vigentes, "ibicuy", "Añelo")?.id).toBe("destino");
  });

  it("cae a la tarifa general (sin ruta) cuando no hay match por destino", () => {
    const vigentes = [
      tarifa({ id: "destino", ruta_id: "r2", ruta: ruta("o", "otroDestino") }),
      tarifa({ id: "general", ruta_id: null, ruta: null }),
    ];
    expect(pickTarifaAplicable(vigentes, "o", "D")?.id).toBe("general");
  });

  it("toma la primera vigente por destino (el caller las ordena por vigencia desc)", () => {
    const vigentes = [
      tarifa({ id: "nueva", ruta_id: "r1", ruta: ruta("o", "D") }),
      tarifa({ id: "vieja", ruta_id: "r1", ruta: ruta("o", "D") }),
    ];
    expect(pickTarifaAplicable(vigentes, "o", "D")?.id).toBe("nueva");
  });

  it("null cuando no hay ninguna aplicable", () => {
    const vigentes = [tarifa({ id: "destino", ruta_id: "r2", ruta: ruta("o", "X") })];
    expect(pickTarifaAplicable(vigentes, "o", "D")).toBeNull();
  });

  it("sin destino resuelto, solo aplica la tarifa general", () => {
    const vigentes = [
      tarifa({ id: "destino", ruta_id: "r2", ruta: ruta("o", "D") }),
      tarifa({ id: "general", ruta_id: null, ruta: null }),
    ];
    expect(pickTarifaAplicable(vigentes, null, null)?.id).toBe("general");
  });
});

describe("detalleTarifa", () => {
  it("por_tonelada muestra $/t × t", () => {
    expect(detalleTarifa("por_tonelada", 1500, { tonelaje: 30, km: 0 })).toContain("/t × 30 t");
  });
  it("fija muestra monto fijo", () => {
    expect(detalleTarifa("fija", 50000, { tonelaje: 0, km: 0 })).toContain("fija");
  });
  it("por_km muestra $/km × km", () => {
    expect(detalleTarifa("por_km", 100, { tonelaje: 0, km: 300 })).toContain("/km × 300 km");
  });
});
