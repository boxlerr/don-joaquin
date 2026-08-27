import { describe, it, expect } from "vitest";
import { ocultasDeUsuario } from "./resumen-diario";

/**
 * Lo que cada persona eligió NO ver en el pop-up.
 *
 * Guarda lo APAGADO: una categoría nueva le aparece a todos sin que nadie la
 * tenga que ir a tildar. Y ante cualquier duda —JSON roto, otra forma, un valor
 * que no es lista— devuelve vacío: esconder un vencimiento sin que nadie lo haya
 * pedido es peor que mostrar de más.
 */
describe("ocultasDeUsuario", () => {
  const NICO = "8f53af61-cfd6-402e-975e-0370544ac816";

  it("devuelve lo que apagó esa persona y nada de las demás", () => {
    const valor = JSON.stringify({ [NICO]: ["vencimiento_docs"], otro: ["cheques_vencidos"] });
    expect(ocultasDeUsuario(valor, NICO)).toEqual(["vencimiento_docs"]);
  });

  it("quien nunca eligió nada ve todo", () => {
    expect(ocultasDeUsuario(JSON.stringify({ otro: ["cheques_vencidos"] }), NICO)).toEqual([]);
    expect(ocultasDeUsuario(null, NICO)).toEqual([]);
    expect(ocultasDeUsuario("", NICO)).toEqual([]);
  });

  it("un valor roto no apaga nada", () => {
    expect(ocultasDeUsuario("{no es json", NICO)).toEqual([]);
    expect(ocultasDeUsuario("[]", NICO)).toEqual([]);
    expect(ocultasDeUsuario(JSON.stringify({ [NICO]: "vencimiento_docs" }), NICO)).toEqual([]);
    expect(ocultasDeUsuario(JSON.stringify({ [NICO]: [1, "impuestos"] }), NICO)).toEqual([
      "impuestos",
    ]);
  });
});
