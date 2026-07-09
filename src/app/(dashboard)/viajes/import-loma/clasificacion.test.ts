import { describe, it, expect } from "vitest";
import {
  buildViajesIndices,
  matchFleteLoma,
  clasificarFleteLoma,
  loadViajesIndices,
  normId,
  normRem,
  type ViajeRow,
} from "./import-core";

// Helper para armar un viaje cargado con valores por defecto.
function viaje(over: Partial<ViajeRow> & { id: string }): ViajeRow {
  return {
    codigo: "V-2026-00001",
    nro_remito: null,
    nro_transporte: null,
    nro_viaje_ypf: null,
    monto_flete: null,
    tonelaje_real: null,
    es_vacio: false,
    km_con_carga: null,
    material: null,
    ...over,
  };
}

describe("normId / normRem", () => {
  it("normId saca espacios y pasa a mayúsculas", () => {
    expect(normId("  ab 123 ")).toBe("AB123");
    expect(normId(null)).toBe("");
  });

  it("normRem deja solo dígitos", () => {
    expect(normRem("123.456")).toBe("123456");
    expect(normRem("RE-0099")).toBe("0099");
    expect(normRem(null)).toBe("");
  });
});

describe("matchFleteLoma", () => {
  it("matchea por nro_transporte del viaje", () => {
    const idx = buildViajesIndices([viaje({ id: "a", nro_transporte: "900111" })]);
    const m = matchFleteLoma({ nroTransporte: "900111", remito: null }, idx);
    expect(m?.id).toBe("a");
  });

  it("matchea el Nº transporte contra nro_viaje_ypf (campo «Nº de viaje» del alta)", () => {
    const idx = buildViajesIndices([viaje({ id: "b", nro_viaje_ypf: "900222" })]);
    const m = matchFleteLoma({ nroTransporte: "900222", remito: null }, idx);
    expect(m?.id).toBe("b");
  });

  it("matchea por remito contra nro_remito (tolerando puntos)", () => {
    const idx = buildViajesIndices([viaje({ id: "c", nro_remito: "123456" })]);
    const m = matchFleteLoma({ nroTransporte: "X", remito: "123.456" }, idx);
    expect(m?.id).toBe("c");
  });

  it("matchea el remito contra nro_viaje_ypf (remito cargado en «Nº de viaje»)", () => {
    const idx = buildViajesIndices([viaje({ id: "d", nro_viaje_ypf: "77001" })]);
    const m = matchFleteLoma({ nroTransporte: "Z", remito: "77001" }, idx);
    expect(m?.id).toBe("d");
  });

  it("prioriza el nro_transporte sobre el remito", () => {
    const idx = buildViajesIndices([
      viaje({ id: "porTransporte", nro_transporte: "555" }),
      viaje({ id: "porRemito", nro_remito: "888" }),
    ]);
    const m = matchFleteLoma({ nroTransporte: "555", remito: "888" }, idx);
    expect(m?.id).toBe("porTransporte");
  });

  it("devuelve null si no hay viaje cargado", () => {
    const idx = buildViajesIndices([viaje({ id: "a", nro_transporte: "111" })]);
    expect(matchFleteLoma({ nroTransporte: "999", remito: "999" }, idx)).toBeNull();
  });
});

describe("clasificarFleteLoma", () => {
  it("no_cargado cuando no hay match", () => {
    expect(clasificarFleteLoma(null)).toBe("no_cargado");
  });

  it("completar cuando el viaje existe y no tiene valor", () => {
    expect(clasificarFleteLoma({ monto_flete: null, es_vacio: false })).toBe("completar");
    expect(clasificarFleteLoma({ monto_flete: 0, es_vacio: false })).toBe("completar");
  });

  it("ya_con_valor cuando el viaje ya tiene monto", () => {
    expect(clasificarFleteLoma({ monto_flete: 150000, es_vacio: false })).toBe("ya_con_valor");
  });

  it("ya_con_valor (no se toca) si el viaje matcheado es un tramo vacío", () => {
    expect(clasificarFleteLoma({ monto_flete: null, es_vacio: true })).toBe("ya_con_valor");
  });
});

describe("loadViajesIndices", () => {
  // Fake mínimo de supabase: solo expone la cadena que usa loadViajesIndices.
  // Si el código volviera a filtrar por fecha (.gte/.lte, el bug de la ventana
  // de ±31 días que duplicaba viajes cargados a mano), el fake explota porque
  // esos métodos no existen.
  function fakeSupabase(pages: ViajeRow[][]) {
    const calls: { or: string[]; order: string[]; ranges: [number, number][] } = {
      or: [],
      order: [],
      ranges: [],
    };
    let page = 0;
    const supabase = {
      from: (table: string) => {
        expect(table).toBe("viajes");
        return {
          select: () => ({
            or: (f: string) => {
              calls.or.push(f);
              return {
                order: (col: string) => {
                  calls.order.push(col);
                  return {
                    range: (from: number, to: number) => {
                      calls.ranges.push([from, to]);
                      return Promise.resolve({ data: pages[page++] ?? [] });
                    },
                  };
                },
              };
            },
          }),
        };
      },
    };
    return { supabase, calls };
  }

  it("trae TODOS los viajes con identificador, sin ventana de fechas, y matchea uno con fecha lejana", async () => {
    // Página llena (1000) para forzar una segunda página: el viaje "viejo"
    // (cargado a mano meses antes que la liquidación) viene en la página 2.
    const pagina1 = Array.from({ length: 1000 }, (_, i) =>
      viaje({ id: `v${i}`, nro_transporte: `T${i}` }),
    );
    const viejo = viaje({ id: "manual-viejo", nro_transporte: "4623337" });
    const { supabase, calls } = fakeSupabase([pagina1, [viejo]]);

    const idx = await loadViajesIndices(supabase);

    // Paginación estable y completa (2 páginas).
    expect(calls.ranges).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
    expect(calls.order).toEqual(["id", "id"]);
    // Solo viajes con algún identificador (los demás no pueden matchear nunca).
    for (const f of calls.or) {
      expect(f).toContain("nro_transporte.not.is.null");
      expect(f).toContain("nro_remito.not.is.null");
      expect(f).toContain("nro_viaje_ypf.not.is.null");
    }
    // El viaje con fecha corrida ahora matchea: antes la ventana lo dejaba
    // afuera y "crear los no cargados" lo insertaba duplicado.
    const m = matchFleteLoma({ nroTransporte: "4623337", remito: null }, idx);
    expect(m?.id).toBe("manual-viejo");
  });
});
