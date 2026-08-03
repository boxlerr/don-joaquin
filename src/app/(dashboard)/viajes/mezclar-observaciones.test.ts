import { describe, it, expect } from "vitest";
import { mezclarObservaciones } from "./mezclar-observaciones";

/**
 * `viajes.observaciones` es una columna compartida por varios flujos: la nota
 * libre que escribe el operador, la observación del cierre, la marca "Tramo 2
 * de V-…" y los segmentos legados de los viajes importados. Editar un viaje
 * reescribía la columna entera y borraba todo eso sin avisar.
 */

describe("mezclarObservaciones", () => {
  it("conserva la nota libre del operador al editar", () => {
    expect(
      mezclarObservaciones("Remito entregado en planta, esperar factura", []),
    ).toBe("Remito entregado en planta, esperar factura");
  });

  it("conserva la marca de tramo (es lo único que ata los tramos de una salida)", () => {
    expect(mezclarObservaciones("Tramo 2 de V-2026-02108", [])).toBe(
      "Tramo 2 de V-2026-02108",
    );
  });

  it("conserva los segmentos legados de los importados", () => {
    expect(
      mezclarObservaciones("Origen: IBICUY | Destino: LAJE 20 | ojo la balanza", []),
    ).toBe("Origen: IBICUY | Destino: LAJE 20 | ojo la balanza");
  });

  it("agrega la descripción de Otros sin pisar lo que había", () => {
    expect(
      mezclarObservaciones("Tramo 2 de V-2026-02108", ["Carga (Otros): Chatarra"]),
    ).toBe("Tramo 2 de V-2026-02108 | Carga (Otros): Chatarra");
  });

  it("reemplaza la descripción de Otros vieja, no la duplica", () => {
    expect(
      mezclarObservaciones("Carga (Otros): Chatarra | nota del operador", [
        "Carga (Otros): Escombro",
      ]),
    ).toBe("nota del operador | Carga (Otros): Escombro");
  });

  it("si el tipo de carga deja de ser Otros, se va sólo ese segmento", () => {
    expect(
      mezclarObservaciones("Carga (Otros): Chatarra | nota del operador", []),
    ).toBe("nota del operador");
  });

  it("sin nada previo ni nuevo, queda null (no un string vacío)", () => {
    expect(mezclarObservaciones(null, [])).toBeNull();
    expect(mezclarObservaciones("", [])).toBeNull();
    expect(mezclarObservaciones("  |  |  ", [])).toBeNull();
  });

  it("no deja separadores colgando cuando hay segmentos vacíos", () => {
    expect(mezclarObservaciones("nota |  | otra", [])).toBe("nota | otra");
  });
});
