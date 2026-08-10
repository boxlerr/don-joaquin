import { describe, it, expect } from "vitest";
import {
  crearConsumidor,
  dedupKey,
  vacioKey,
  type ExistentesIndex,
  type ViajeYaCargado,
} from "./import-core";

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

// Los vacíos viven en el MISMO índice que el resto (para poder avisar que ya hay
// uno igual cargado) pero NO participan del dedup. Si una clave de vacío pisara
// una de dedup, el importador saltearía un viaje real.
describe("vacioKey", () => {
  it("nunca colisiona con una clave de dedup del mismo chofer, día y ruta", () => {
    const ruta = "m central>ibicuy";
    const conRemito = dedupKey("chofer", "2026-03-03", "291406", 36.82, ruta, null);
    const sinRemitoReal = dedupKey("chofer", "2026-03-03", "SCANIA", null, ruta, null);
    const vacio = vacioKey("chofer", "2026-03-03", ruta);
    expect(vacio).not.toBe(conRemito);
    expect(vacio).not.toBe(sinRemitoReal);
  });

  it("mismo chofer, día y tramo → misma clave (es lo que detecta el repetido)", () => {
    expect(vacioKey("chofer", "2026-03-03", "m central>ibicuy")).toBe(
      vacioKey("chofer", "2026-03-03", "m central>ibicuy"),
    );
  });

  it("otro día o otro tramo → otra clave", () => {
    const base = vacioKey("chofer", "2026-03-03", "m central>ibicuy");
    expect(vacioKey("chofer", "2026-03-04", "m central>ibicuy")).not.toBe(base);
    expect(vacioKey("chofer", "2026-03-03", "ibicuy>m central")).not.toBe(base);
  });
});

// El consumidor es lo que evita los dos errores opuestos: volver a crear un
// viaje que ya está, y saltear uno legítimo porque "se parece" a otro.
describe("crearConsumidor", () => {
  const viaje = (codigo: string): ViajeYaCargado => ({
    codigo,
    fecha: "2026-03-03",
    remito: null,
    origen: "M. CENTRAL",
    destino: "IBICUY",
    importe: null,
    cargadoDesde: "HOJA DE RUTA",
    cargadoEl: "2026-06-10",
  });

  it("una clave con un solo viaje cargado se gasta una vez", () => {
    const idx: ExistentesIndex = new Map([["k", [viaje("V-1")]]]);
    const consumir = crearConsumidor(idx);
    expect(consumir("k")?.codigo).toBe("V-1");
    // La segunda fila igual del Excel es un viaje nuevo: no hay contra qué chocar.
    expect(consumir("k")).toBeNull();
  });

  it("dos vacíos iguales cargados dejan pasar el tercero", () => {
    const idx: ExistentesIndex = new Map([["k", [viaje("V-1"), viaje("V-2")]]]);
    const consumir = crearConsumidor(idx);
    expect(consumir("k")?.codigo).toBe("V-1");
    expect(consumir("k")?.codigo).toBe("V-2");
    expect(consumir("k")).toBeNull();
  });

  it("una clave que no está devuelve null y no rompe", () => {
    const consumir = crearConsumidor(new Map());
    expect(consumir("no-existe")).toBeNull();
  });

  it("cada consumidor arranca de cero (preview e import no se pisan)", () => {
    const idx: ExistentesIndex = new Map([["k", [viaje("V-1")]]]);
    expect(crearConsumidor(idx)("k")?.codigo).toBe("V-1");
    expect(crearConsumidor(idx)("k")?.codigo).toBe("V-1");
  });
});
