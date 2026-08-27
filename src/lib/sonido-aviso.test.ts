import { describe, it, expect, beforeEach } from "vitest";
import {
  setSonidoActivo,
  sonarAviso,
  sonidoActivo,
  sonidoActivoEnServidor,
  suscribirSonido,
} from "./sonido-aviso";

/**
 * El sonido de los avisos. Lo que se cuida acá es que se pueda apagar y que no
 * rompa nada donde no hay audio: en el server, en un navegador que todavía no
 * dejó sonar nada, o en los tests. El aviso se ve igual — el sonido es el
 * acompañamiento, no el mensaje.
 */
describe("sonido de los avisos", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("nace prendido: un sonido que hay que ir a activar no lo activa nadie", () => {
    expect(sonidoActivo()).toBe(true);
    expect(sonidoActivoEnServidor()).toBe(true);
  });

  it("se apaga y se vuelve a prender, y queda guardado", () => {
    setSonidoActivo(false);
    expect(sonidoActivo()).toBe(false);
    expect(localStorage.getItem("dj_sonido_avisos")).toBe("off");

    setSonidoActivo(true);
    expect(sonidoActivo()).toBe(true);
  });

  it("avisa a quien esté escuchando cuando cambia", () => {
    let veces = 0;
    const cortar = suscribirSonido(() => {
      veces++;
    });

    setSonidoActivo(false);
    setSonidoActivo(true);
    expect(veces).toBe(2);

    cortar();
    setSonidoActivo(false);
    expect(veces).toBe(2);
  });

  it("sin audio en el navegador no rompe: no suena y sigue", () => {
    // jsdom no tiene AudioContext, que es justo el caso del navegador que
    // todavía no dejó sonar nada.
    expect(() => sonarAviso()).not.toThrow();
    setSonidoActivo(false);
    expect(() => sonarAviso()).not.toThrow();
  });
});
