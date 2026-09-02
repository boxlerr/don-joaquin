import { describe, it, expect } from "vitest";
import {
  buscarRepetida,
  filtrarChoferes,
  linkWhatsapp,
  mensajeParaChofer,
  telefonoParaWhatsapp,
} from "./enlace";

/**
 * Los cinco formatos son los que están cargados de verdad en `choferes.telefono`
 * (relevado sobre los 61 activos el 02/09/2026). Si mañana el normalizador deja
 * de entender alguno, el botón de WhatsApp de esos choferes desaparece sin que
 * nadie se entere: por eso van como fixture y no como ejemplos inventados.
 */
describe("telefonoParaWhatsapp", () => {
  it("entiende los cinco formatos que hay cargados", () => {
    expect(telefonoParaWhatsapp("2281-305209")).toBe("5492281305209"); // 54 de 61
    expect(telefonoParaWhatsapp("+5492281305209")).toBe("5492281305209"); // 7
    expect(telefonoParaWhatsapp("11-40305209")).toBe("5491140305209"); // 5
    expect(telefonoParaWhatsapp("2281305209")).toBe("5492281305209"); // 2
    expect(telefonoParaWhatsapp("2281 305209")).toBe("5492281305209"); // 1
  });

  it("saca el 0 de larga distancia y el 15 del celular", () => {
    expect(telefonoParaWhatsapp("02281-15305209")).toBe("5492281305209");
    expect(telefonoParaWhatsapp("011 15 40305209")).toBe("5491140305209");
  });

  it("no inventa un número cuando el que hay no alcanza", () => {
    expect(telefonoParaWhatsapp(null)).toBeNull();
    expect(telefonoParaWhatsapp("")).toBeNull();
    expect(telefonoParaWhatsapp("sin teléfono")).toBeNull();
    expect(telefonoParaWhatsapp("305209")).toBeNull(); // sin código de área
    expect(telefonoParaWhatsapp("2281-3052099999")).toBeNull(); // de más
  });

  it("sin número no hay botón de WhatsApp, en vez de uno que abre un chat vacío", () => {
    expect(linkWhatsapp("305209", "hola")).toBeNull();
    expect(linkWhatsapp("2281-305209", "hola")).toBe("https://wa.me/5492281305209?text=hola");
  });

  it("el mensaje lleva el enlace escapado", () => {
    const url = "https://don-joaquin.vercel.app/gasoil/a1b2c3";
    const link = linkWhatsapp("2281-305209", mensajeParaChofer(url))!;
    expect(link).toContain(encodeURIComponent(url));
    expect(decodeURIComponent(link.split("text=")[1]!)).toContain("gasoil de la vuelta");
  });
});

describe("filtrarChoferes", () => {
  const lista = [
    { id: "1", nombre: "Asteazarán Cristian Antonio" },
    { id: "2", nombre: "Albornoz Marcelo Fabián" },
    { id: "3", nombre: "Acosta Pablo Maximo" },
  ];

  it("encuentra sin tildes y sin importar mayúsculas", () => {
    expect(filtrarChoferes(lista, "asteazaran").map((c) => c.id)).toEqual(["1"]);
    expect(filtrarChoferes(lista, "ASTEAZARÁN").map((c) => c.id)).toEqual(["1"]);
  });

  it("encuentra por el nombre aunque en la lista vaya después del apellido", () => {
    expect(filtrarChoferes(lista, "cristian").map((c) => c.id)).toEqual(["1"]);
    expect(filtrarChoferes(lista, "cristian aste").map((c) => c.id)).toEqual(["1"]);
  });

  it("con el campo vacío no esconde a nadie", () => {
    expect(filtrarChoferes(lista, "")).toHaveLength(3);
    expect(filtrarChoferes(lista, "   ")).toHaveLength(3);
  });

  it("lo que no está, no está", () => {
    expect(filtrarChoferes(lista, "zzz")).toEqual([]);
  });
});

describe("buscarRepetida", () => {
  const ahora = new Date("2026-09-02T15:00:00Z");
  const fila = (min: number, tn = 35) => ({
    id: `f${min}`,
    created_at: new Date(ahora.getTime() - min * 60_000).toISOString(),
    origen_id: "o1",
    destino_id: "d1",
    toneladas: tn,
  });
  const nueva = { origenId: "o1", destinoId: "d1", toneladas: 35 };

  it("el dedo que toca dos veces no anota dos vueltas", () => {
    expect(buscarRepetida([fila(0)], nueva, ahora)?.id).toBe("f0");
    expect(buscarRepetida([fila(9)], nueva, ahora)?.id).toBe("f9");
  });

  it("pasada la ventana, es una vuelta nueva de verdad", () => {
    expect(buscarRepetida([fila(11)], nueva, ahora)).toBeNull();
  });

  it("otro tramo o distintas toneladas no son la misma vuelta", () => {
    expect(buscarRepetida([fila(1, 22)], nueva, ahora)).toBeNull();
    expect(buscarRepetida([{ ...fila(1), destino_id: "d2" }], nueva, ahora)).toBeNull();
  });

  it("tolera el redondeo de la base sin dejar pasar una diferencia real", () => {
    expect(buscarRepetida([fila(1, 35.001)], nueva, ahora)?.id).toBe("f1");
    expect(buscarRepetida([fila(1, 35.1)], nueva, ahora)).toBeNull();
  });
});
