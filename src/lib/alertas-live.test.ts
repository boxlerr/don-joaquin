import { describe, it, expect } from "vitest";
import { chequeReclama } from "./alertas-live";

/**
 * Cuándo un cheque sigue teniendo algo pendiente.
 *
 * El caso que dio origen a la regla (27/08/2026, Nico): un echeq de Loma Negra
 * que vencía ESE día no se distinguía en ningún lado, porque los cuatro
 * "vencidos" que aparecían arriba eran cheques recibidos que ya se habían
 * cedido — o sea, cheques sin nada que hacer. `entregado` significa cosas
 * opuestas según el origen y eso es lo que se prueba acá.
 */
describe("chequeReclama", () => {
  it("el recibido reclama sólo mientras está en cartera", () => {
    expect(chequeReclama("recibido", "cartera")).toBe(true);
    // Las dos formas de terminarlo, que son las que pidió Nico: depositarlo o
    // cederlo. Cualquiera de las dos apaga el aviso.
    expect(chequeReclama("recibido", "depositado")).toBe(false);
    expect(chequeReclama("recibido", "entregado")).toBe(false);
    expect(chequeReclama("recibido", "acreditado")).toBe(false);
    expect(chequeReclama("recibido", "rechazado")).toBe(false);
    expect(chequeReclama("recibido", "anulado")).toBe(false);
  });

  it("el nuestro reclama hasta que el banco lo debita", () => {
    expect(chequeReclama("propio", "emitido")).toBe(true);
    // Entregado al proveedor: es plata que sale el día que vence, sigue avisando.
    expect(chequeReclama("propio", "entregado")).toBe(true);
    expect(chequeReclama("propio", "debitado")).toBe(false);
    expect(chequeReclama("propio", "anulado")).toBe(false);
  });

  it("sin origen se trata como recibido, que es el default de la columna", () => {
    expect(chequeReclama(null, "cartera")).toBe(true);
    expect(chequeReclama(undefined, "entregado")).toBe(false);
  });
});
