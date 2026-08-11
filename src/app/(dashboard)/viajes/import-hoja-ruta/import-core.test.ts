import { describe, it, expect } from "vitest";
import {
  contarPorMes,
  crearConsumidor,
  dedupKey,
  mesPrincipalDe,
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

// De qué mes es el archivo se decide por los datos, no por el nombre: la "HOJA
// DE RUTA JUNIO COMPLETA" del 10/08 traía 1.397 filas de junio, 25 de mayo, 4 de
// marzo y 1 de febrero. Los 30 de otros meses se guardan con SU fecha, así que
// después no salen al filtrar junio — y eso es exactamente lo que hay que avisar.
describe("mes del archivo", () => {
  const junio = (n: number) => Array.from({ length: n }, (_, i) => `2026-06-${String((i % 28) + 1).padStart(2, "0")}`);

  it("el mes principal es el que más viajes tiene, no el primero ni el último", () => {
    const fechas = ["2026-02-28", "2026-03-03", "2026-05-30", ...junio(10)];
    expect(mesPrincipalDe(fechas)).toBe("2026-06");
  });

  it("cuenta por mes de mayor a menor", () => {
    const fechas = ["2026-02-28", "2026-05-30", "2026-05-31", ...junio(4)];
    expect(contarPorMes(fechas)).toEqual([
      { mes: "2026-06", viajes: 4 },
      { mes: "2026-05", viajes: 2 },
      { mes: "2026-02", viajes: 1 },
    ]);
  });

  it("a igual cantidad gana el mes más nuevo (una hoja de junio con arrastre de mayo es de junio)", () => {
    expect(mesPrincipalDe(["2026-05-30", "2026-05-31", "2026-06-01", "2026-06-02"])).toBe("2026-06");
  });

  it("sin fechas no inventa un mes", () => {
    expect(mesPrincipalDe([])).toBeNull();
    expect(contarPorMes([])).toEqual([]);
  });
});
