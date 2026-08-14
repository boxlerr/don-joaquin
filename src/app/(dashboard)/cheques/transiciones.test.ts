import { describe, it, expect } from "vitest";
import {
  ESTADOS_POR_ORIGEN,
  dejaEgresoEnCaja,
  estadoAlCambiarOrigen,
  estadoInicial,
  puedeCambiarOrigen,
  puedeCorregirseA,
  validateTransicion,
  type ChequeEstado,
} from "./transiciones";

describe("estadoInicial", () => {
  it("un cheque que recibimos entra en cartera", () => {
    expect(estadoInicial("recibido", null)).toBe("cartera");
  });

  it("un cheque nuestro sin entregar queda emitido, nunca en cartera", () => {
    // Ésta es la causa del problema que reportó Bárbara: un cheque propio
    // cargado como "en cartera" sumaba a los valores a cobrar.
    expect(estadoInicial("propio", null)).toBe("emitido");
  });

  it("un cheque nuestro que ya se entregó entra como entregado", () => {
    expect(estadoInicial("propio", "Proveedor SA")).toBe("entregado");
  });
});

describe("validateTransicion", () => {
  it("un recibido en cartera se puede depositar, endosar, rechazar o anular", () => {
    for (const destino of ["depositado", "entregado", "rechazado", "anulado"] as ChequeEstado[]) {
      expect(validateTransicion("cartera", destino, "recibido")).toBeNull();
    }
  });

  it("endosar un recibido lo deja cerrado: ya no es nuestro", () => {
    expect(validateTransicion("entregado", "depositado", "recibido")).not.toBeNull();
    expect(validateTransicion("entregado", "debitado", "recibido")).not.toBeNull();
  });

  it("entregar un cheque nuestro no lo cierra: falta que lo cobren", () => {
    expect(validateTransicion("entregado", "debitado", "propio")).toBeNull();
  });

  it("un cheque nuestro no se deposita ni se acredita", () => {
    expect(validateTransicion("emitido", "depositado", "propio")).not.toBeNull();
    expect(validateTransicion("emitido", "acreditado", "propio")).not.toBeNull();
  });

  it("un recibido no se debita: eso es del lado de los nuestros", () => {
    expect(validateTransicion("cartera", "debitado", "recibido")).not.toBeNull();
  });

  it("lo debitado, acreditado y rechazado no se mueve más", () => {
    expect(validateTransicion("debitado", "entregado", "propio")).not.toBeNull();
    expect(validateTransicion("acreditado", "entregado", "recibido")).not.toBeNull();
    expect(validateTransicion("rechazado", "depositado", "recibido")).not.toBeNull();
  });

  it("el mensaje de error nombra los dos estados", () => {
    expect(validateTransicion("acreditado", "cartera", "recibido")).toContain("acreditado");
    expect(validateTransicion("acreditado", "cartera", "recibido")).toContain("cartera");
  });
});

describe("corregir de qué lado es el cheque", () => {
  it("sólo se puede mientras no arrancó a moverse", () => {
    expect(puedeCambiarOrigen("cartera")).toBe(true);
    expect(puedeCambiarOrigen("emitido")).toBe(true);
    expect(puedeCambiarOrigen("anulado")).toBe(true);
    expect(puedeCambiarOrigen("entregado")).toBe(false);
    expect(puedeCambiarOrigen("depositado")).toBe(false);
    expect(puedeCambiarOrigen("acreditado")).toBe(false);
    expect(puedeCambiarOrigen("debitado")).toBe(false);
  });

  it("el punto de partida cambia de nombre al cruzar de lado", () => {
    expect(estadoAlCambiarOrigen("cartera", "propio")).toBe("emitido");
    expect(estadoAlCambiarOrigen("emitido", "recibido")).toBe("cartera");
  });

  it("un anulado sigue anulado del lado que sea", () => {
    expect(estadoAlCambiarOrigen("anulado", "propio")).toBeNull();
    expect(estadoAlCambiarOrigen("anulado", "recibido")).toBeNull();
  });
});

describe("corregir el estado a mano", () => {
  it("un cheque anulado por error se puede devolver a donde estaba", () => {
    // El circuito normal no vuelve de anulado; la corrección sí, que es el
    // punto: equivocarse al anular no puede dejar la fila muerta para siempre.
    expect(validateTransicion("anulado", "cartera", "recibido")).not.toBeNull();
    expect(puedeCorregirseA("cartera", "recibido")).toBe(true);
    expect(puedeCorregirseA("emitido", "propio")).toBe(true);
  });

  it("no se puede corregir a un estado del otro lado", () => {
    expect(puedeCorregirseA("emitido", "recibido")).toBe(false);
    expect(puedeCorregirseA("debitado", "recibido")).toBe(false);
    expect(puedeCorregirseA("cartera", "propio")).toBe(false);
    expect(puedeCorregirseA("depositado", "propio")).toBe(false);
  });

  it("cada lado ofrece sus propios estados", () => {
    expect(ESTADOS_POR_ORIGEN.recibido).toContain("cartera");
    expect(ESTADOS_POR_ORIGEN.recibido).not.toContain("emitido");
    expect(ESTADOS_POR_ORIGEN.propio).toContain("debitado");
    expect(ESTADOS_POR_ORIGEN.propio).not.toContain("acreditado");
    // Anulado y rechazado existen de los dos lados.
    for (const origen of ["recibido", "propio"] as const) {
      expect(ESTADOS_POR_ORIGEN[origen]).toContain("anulado");
      expect(ESTADOS_POR_ORIGEN[origen]).toContain("rechazado");
    }
  });
});

describe("cuándo el cheque deja un egreso en la caja", () => {
  it("sólo el cheque nuestro ya debitado", () => {
    expect(dejaEgresoEnCaja("propio", "debitado")).toBe(true);
  });

  it("emitido y entregado todavía no salieron de la cuenta", () => {
    // Anotarlos como egreso mostraría como gastada plata que sigue estando.
    expect(dejaEgresoEnCaja("propio", "emitido")).toBe(false);
    expect(dejaEgresoEnCaja("propio", "entregado")).toBe(false);
  });

  it("un cheque que no se pagó no deja egreso", () => {
    expect(dejaEgresoEnCaja("propio", "rechazado")).toBe(false);
    expect(dejaEgresoEnCaja("propio", "anulado")).toBe(false);
  });

  it("ningún cheque que recibimos genera un egreso", () => {
    // El que entra es plata que llega, y no es asunto de esta función.
    for (const estado of ESTADOS_POR_ORIGEN.recibido) {
      expect(dejaEgresoEnCaja("recibido", estado)).toBe(false);
    }
  });

  it("todo estado propio que no es debitado da false", () => {
    // Blinda el día que se agregue un estado nuevo al circuito propio.
    const otros = ESTADOS_POR_ORIGEN.propio.filter((e) => e !== "debitado");
    for (const estado of otros) {
      expect(dejaEgresoEnCaja("propio", estado)).toBe(false);
    }
  });
});
