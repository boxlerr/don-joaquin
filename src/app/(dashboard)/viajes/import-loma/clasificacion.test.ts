import { describe, it, expect } from "vitest";
import {
  buildViajesIndices,
  matchFleteLoma,
  clasificarFleteLoma,
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
