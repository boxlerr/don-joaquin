import { describe, it, expect } from "vitest";
import { destinoDeGrupo, textoSobre } from "./alertas-ui";

/**
 * A dónde lleva cada tarjeta del resumen del día.
 *
 * Julián, 27/08/2026: *"si le hago click al resumen de cheques que me lleve a
 * cheques y ya me filtre"*. Lo que se cuida acá es que el destino sea el filtro
 * que esa pantalla ya tiene —no una ruta inventada— y que una categoría sin
 * destino propio no termine en cualquier lado.
 */
describe("destinoDeGrupo", () => {
  const item = (href: string | null) => ({ href });

  it("cheques abre exactamente lo que dice su número", () => {
    // Con vencidos, el número grande son ESOS: el click los abre a ellos.
    expect(destinoDeGrupo({ key: "cheques_vencidos", vencidos: 3, items: [item("/cheques")] })).toBe(
      "/cheques?vista=vencidos",
    );
    // Sin nada vencido, el número es el total: se abre todo lo que está avisando.
    expect(destinoDeGrupo({ key: "cheques_vencidos", vencidos: 0, items: [item("/cheques")] })).toBe(
      "/cheques?vista=avisos",
    );
  });

  it("entra por lo vencido si hay algo vencido, y si no por lo que se viene", () => {
    expect(destinoDeGrupo({ key: "impuestos", vencidos: 11, items: [] })).toBe(
      "/impuestos?estado=vencido",
    );
    expect(destinoDeGrupo({ key: "impuestos", vencidos: 0, items: [] })).toBe(
      "/impuestos?estado=por_vencer",
    );
    expect(destinoDeGrupo({ key: "prestamos_vencimiento", vencidos: 1, items: [] })).toBe(
      "/prestamos?foco=vencidas",
    );
    expect(destinoDeGrupo({ key: "prestamos_vencimiento", vencidos: 0, items: [] })).toBe(
      "/prestamos",
    );
  });

  it("sin destino propio, la sección común de sus avisos", () => {
    expect(
      destinoDeGrupo({ key: "mantenimiento", vencidos: 0, items: [item("/mantenimiento?tab=insumos")] }),
    ).toBe("/mantenimiento");
  });

  it("si los avisos van a secciones distintas, la lista de avisos", () => {
    // El caso de documentación antes de tener destino propio: camiones y
    // choferes son dos pantallas y ninguna de las dos es "la del grupo".
    expect(
      destinoDeGrupo({ key: "otros_avisos", vencidos: 0, items: [item("/camiones"), item("/choferes")] }),
    ).toBe("/notificaciones");
    expect(destinoDeGrupo({ items: [] })).toBe("/notificaciones");
  });
});

/**
 * El ícono de la categoría va sobre su color pleno: el glifo tiene que leerse
 * ahí encima, sea cual sea el color que le toque a la categoría.
 */
describe("textoSobre", () => {
  it("blanco sobre los colores del menú, que son medios u oscuros", () => {
    expect(textoSobre("#D97706")).toBe("#FFFFFF"); // ámbar de Finanzas
    expect(textoSobre("#6366F1")).toBe("#FFFFFF"); // índigo de Flota
    expect(textoSobre("#047857")).toBe("#FFFFFF"); // verde de RRHH
  });

  it("oscuro sobre un color claro, que si no el ícono desaparece", () => {
    expect(textoSobre("#FDE68A")).toBe("#1E293B");
    expect(textoSobre("#FFFFFF")).toBe("#1E293B");
  });

  it("un valor que no es hex no rompe: blanco y sigue", () => {
    expect(textoSobre("rgb(1,2,3)")).toBe("#FFFFFF");
  });
});
