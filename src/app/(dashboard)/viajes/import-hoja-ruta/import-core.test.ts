import { describe, it, expect } from "vitest";
import { dedupKey } from "./import-core";

// La clave de dedup separa viajes genuinamente distintos. Un mismo par hecho una
// vez por Ruta 5 y otra sin marcar son viajes distintos (distancia propia), así
// que no deben colapsar cuando el remito no es un número (nota tipo "SCANIA").
describe("dedupKey", () => {
  it("con remito real: la vía no cambia la clave (el remito ya es único)", () => {
    const a = dedupKey("chofer", "2026-06-05", "132234", 35.94, "ibicuy>laje 20", "ruta_5");
    const b = dedupKey("chofer", "2026-06-05", "132234", 35.94, "ibicuy>laje 20", null);
    expect(a).toBe(b);
  });

  it("sin remito real: distinta vía → distinta clave (no se dedupean entre sí)", () => {
    const r5 = dedupKey("chofer", "2026-06-05", "SCANIA", 35.94, "ibicuy>laje 20", "ruta_5");
    const sin = dedupKey("chofer", "2026-06-05", "SCANIA", 35.94, "ibicuy>laje 20", null);
    expect(r5).not.toBe(sin);
  });

  it("sin remito real: misma vía y mismos datos → misma clave (idempotente)", () => {
    const a = dedupKey("chofer", "2026-06-05", "SCANIA", 35.94, "ibicuy>laje 20", "ruta_5");
    const b = dedupKey("chofer", "2026-06-05", "SCANIA", 35.94, "ibicuy>laje 20", "ruta_5");
    expect(a).toBe(b);
  });

  it("sin vía es equivalente a via null (retrocompatible)", () => {
    const a = dedupKey("chofer", "2026-06-05", "SCANIA", 35.94, "ibicuy>laje 20");
    const b = dedupKey("chofer", "2026-06-05", "SCANIA", 35.94, "ibicuy>laje 20", null);
    expect(a).toBe(b);
  });
});
