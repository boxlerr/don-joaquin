import { describe, it, expect } from "vitest";
import {
  codigoContribuyente,
  cuitDigitoOk,
  normalizarCuit,
  prefijoAlertaImpuesto,
  requierePermisoPersonales,
  sufijoEntidadEnAviso,
} from "./entidades";

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

describe("requierePermisoPersonales", () => {
  it("pide el permiso para destapar un calendario reservado", () => {
    // La peligrosa: el calendario de Nicolás pasa a avisarle a todo el equipo.
    expect(requierePermisoPersonales("impuestos_personales", "impuestos")).toBe(true);
  });

  it("pide el permiso para reservar uno que hoy ve todo el equipo", () => {
    // No filtra nada, pero apaga avisos que hoy le llegan a nueve personas.
    expect(requierePermisoPersonales("impuestos", "impuestos_personales")).toBe(true);
  });

  it("pide el permiso para renombrar o borrar uno reservado", () => {
    // Sin `nueva`: la audiencia no cambia, pero el dato que se toca ES el reservado.
    expect(requierePermisoPersonales("impuestos_personales")).toBe(true);
  });

  it("no lo pide para el calendario de la empresa", () => {
    expect(requierePermisoPersonales("impuestos", "impuestos")).toBe(false);
    expect(requierePermisoPersonales("impuestos")).toBe(false);
  });
});

describe("normalizarCuit", () => {
  it("acepta cualquier forma de tipearlo o pegarlo", () => {
    for (const raw of ["20-26402739-0", "20264027390", "20.26402739.0", " 20 26402739 0 "]) {
      expect(normalizarCuit(raw)).toBe("20-26402739-0");
    }
  });

  it("rechaza lo que no son 11 dígitos", () => {
    expect(normalizarCuit("2026402739")).toBeNull();
    expect(normalizarCuit("202640273900")).toBeNull();
    expect(normalizarCuit("")).toBeNull();
    expect(normalizarCuit(null)).toBeNull();
  });
});

describe("cuitDigitoOk", () => {
  it("da bien con los dos CUIT reales del sistema", () => {
    expect(cuitDigitoOk("30-70908728-9")).toBe(true); // Joaquín Hnos S.R.L.
    expect(cuitDigitoOk("20-26402739-0")).toBe(true); // Joaquín Nicolás
  });

  it("agarra el dígito cambiado y los dos dígitos dados vuelta", () => {
    expect(cuitDigitoOk("30-70908728-1")).toBe(false);
    expect(cuitDigitoOk("30-70908782-9")).toBe(false);
  });

  it("un CUIT incompleto no cierra", () => {
    expect(cuitDigitoOk("30-7090872")).toBe(false);
    expect(cuitDigitoOk(null)).toBe(false);
  });
});

describe("codigoContribuyente", () => {
  it("saca acentos, espacios y puntos", () => {
    expect(codigoContribuyente("Joaquín Hnos S.R.L.", "30-70908728-9")).toBe("joaquin_hnos_s_r_l");
    expect(codigoContribuyente("Joaquín Nicolás", "20-26402739-0")).toBe("joaquin_nicolas");
  });

  it("desempata en vez de chocar con uno que ya está", () => {
    // Sin esto la segunda alta muere con un error de clave repetida que en
    // pantalla no dice nada.
    expect(codigoContribuyente("Joaquín Hnos", "30-11111111-1", ["joaquin_hnos"])).toBe(
      "joaquin_hnos_2",
    );
    expect(
      codigoContribuyente("Joaquín Hnos", "30-11111111-1", ["joaquin_hnos", "joaquin_hnos_2"]),
    ).toBe("joaquin_hnos_3");
  });

  it("cae al CUIT cuando el nombre no deja ninguna letra", () => {
    expect(codigoContribuyente("···", "20-26402739-0")).toBe("cuit_20264027390");
  });
});
