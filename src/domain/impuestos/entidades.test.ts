import { describe, it, expect } from "vitest";
import { prefijoAlertaImpuesto, sufijoEntidadEnAviso } from "./entidades";

describe("prefijoAlertaImpuesto", () => {
  it("separa el calendario de la empresa del de una persona", () => {
    expect(prefijoAlertaImpuesto("impuestos")).toBe("impuesto:");
    expect(prefijoAlertaImpuesto("impuestos_personales")).toBe("impuesto_personal:");
  });

  it("ante la duda tapa, no reparte", () => {
    // Una entidad nueva mal configurada, o una fila vieja sin columna: el aviso
    // cae en la columna cerrada. Al revés se filtran datos fiscales de alguien.
    expect(prefijoAlertaImpuesto(null)).toBe("impuesto_personal:");
    expect(prefijoAlertaImpuesto(undefined)).toBe("impuesto_personal:");
    expect(prefijoAlertaImpuesto("otra_cosa")).toBe("impuesto_personal:");
  });
});

describe("sufijoEntidadEnAviso", () => {
  it("nombra al contribuyente sólo cuando no es la empresa", () => {
    expect(sufijoEntidadEnAviso({ codigo: "joaquin_hnos", nombre: "Joaquín Hnos" })).toBe("");
    expect(sufijoEntidadEnAviso({ codigo: "joaquin_nicolas", nombre: "Joaquín Nicolás" })).toBe(
      " de Joaquín Nicolás",
    );
    expect(sufijoEntidadEnAviso(null)).toBe("");
  });
});
