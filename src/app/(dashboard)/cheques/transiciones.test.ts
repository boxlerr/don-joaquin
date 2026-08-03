import { describe, it, expect } from "vitest";
import {
  estadoAlCambiarOrigen,
  estadoInicial,
  puedeCambiarOrigen,
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
