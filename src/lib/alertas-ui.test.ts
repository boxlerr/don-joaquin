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

/**
 * "Documentos" mezcla papeles de choferes y de camiones, y por eso caía SIEMPRE
 * en la lista de avisos.
 *
 * Julián, 01/09/2026: *"si abro el atajo de documento que veo que son 2 me abre
 * notificaciones, no me lleva a donde están esos 2 documentos; podría llevarme a
 * legajos con los 2 legajos de los choferes ya filtrados"*. La regla que se
 * prueba acá es que se decide por lo que dice el NÚMERO GRANDE —los vencidos—,
 * no por todo lo que la tarjeta llegó a listar.
 */
describe("destinoDeGrupo · documentos", () => {
  const doc = (href: string | null, diasRestantes: number | null) => ({ href, diasRestantes });
  const LISTA = "/notificaciones?categoria=documentacion";

  it("el caso de la captura: los 2 vencidos son de choferes, el camión no está vencido", () => {
    // Tal cual la tarjeta del 01/09: 2 vencidos (Paz Leonardo, Salto Maximiliano)
    // y entre los próximos una VTV de camión. Antes ese camión arrastraba el
    // destino entero a la lista de avisos.
    expect(
      destinoDeGrupo({
        key: "vencimiento_docs",
        vencidos: 2,
        restantes: 0,
        restantesVencidos: 0,
        items: [
          doc("/choferes?documentoId=a", -30),
          doc("/choferes?documentoId=b", -8),
          doc("/choferes?documentoId=c", 1),
          doc("/camiones?documentoId=d", 2),
          doc("/choferes?documentoId=e", 3),
        ],
      }),
    ).toBe("/choferes?rapido=vencidos");
  });

  it("con los vencidos repartidos entre choferes y camiones, entra a la lista", () => {
    expect(
      destinoDeGrupo({
        key: "vencimiento_docs",
        vencidos: 2,
        restantesVencidos: 0,
        items: [doc("/choferes?documentoId=a", -30), doc("/camiones?documentoId=b", -2)],
      }),
    ).toBe(LISTA);
  });

  it("sin nada vencido, el número grande es el total: abre lo que está por vencer", () => {
    expect(
      destinoDeGrupo({
        key: "vencimiento_docs",
        vencidos: 0,
        restantes: 0,
        items: [doc("/choferes?documentoId=a", 3), doc("/choferes?documentoId=b", 5)],
      }),
    ).toBe("/choferes?rapido=por_vencer");
  });

  it("si quedaron vencidos fuera del recorte no se puede saber de qué lado son", () => {
    // El grupo viaja recortado. Con vencidos que no viajaron, clasificar por los
    // que sí llegaron sería adivinar con media lista.
    expect(
      destinoDeGrupo({
        key: "vencimiento_docs",
        vencidos: 9,
        restantesVencidos: 7,
        items: [doc("/choferes?documentoId=a", -30), doc("/choferes?documentoId=b", -8)],
      }),
    ).toBe(LISTA);
  });

  it("todo de camiones va a la lista: la flota todavía no filtra por documento vencido", () => {
    expect(
      destinoDeGrupo({
        key: "vencimiento_docs",
        vencidos: 2,
        restantesVencidos: 0,
        items: [doc("/camiones?documentoId=a", -4), doc("/camiones?documentoId=b", -1)],
      }),
    ).toBe(LISTA);
  });

  it("un aviso sin href no arrastra a nadie: se entra a la lista", () => {
    expect(
      destinoDeGrupo({
        key: "vencimiento_docs",
        vencidos: 2,
        restantesVencidos: 0,
        items: [doc("/choferes?documentoId=a", -30), doc(null, -8)],
      }),
    ).toBe(LISTA);
  });
});
