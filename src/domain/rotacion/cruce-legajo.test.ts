import { describe, it, expect } from "vitest";
import { egresadosSinCruzar, estaEnRotacion } from "./cruce-legajo";

const chofer = (
  apellido: string,
  nombre: string,
  extra: Partial<Parameters<typeof estaEnRotacion>[0]> = {},
) => ({
  id: `id-${apellido}-${nombre}`.toLowerCase(),
  apellido,
  nombre,
  rol: "chofer",
  estado: "baja",
  fecha_egreso: "2026-06-18",
  ...extra,
});

/** Las 16 que había cargadas del Excel, tal como están escritas ahí. */
const DEL_EXCEL = [
  { chofer_id: null, nombre: "PITTANA CARLOS" },
  { chofer_id: null, nombre: "PITTANA JORGE" },
  { chofer_id: null, nombre: "LAGANO GUILLERMO" },
  { chofer_id: null, nombre: "GOMEZ RICARDO" },
  { chofer_id: null, nombre: "CARDARELLI" },
  { chofer_id: null, nombre: "SALTO IVAN" },
];

describe("estaEnRotacion", () => {
  it("lo reconoce por el id cuando la baja la dejó el sistema", () => {
    const c = chofer("Caligiuri", "Silvio Amadeo");
    expect(estaEnRotacion(c, [{ chofer_id: c.id, nombre: "cualquier cosa" }])).toBe(true);
  });

  it("reconoce el nombre abreviado del Excel", () => {
    expect(estaEnRotacion(chofer("Salto", "Ivan Andres"), DEL_EXCEL)).toBe(true);
  });

  it("lo encuentra aunque el Excel figure por el SEGUNDO nombre", () => {
    // "GOMEZ RICARDO" es Matías Ricardo Alberto Gomez.
    expect(estaEnRotacion(chofer("Gomez", "Matías Ricardo Alberto"), DEL_EXCEL)).toBe(true);
  });

  it("acepta la fila que es sólo el apellido", () => {
    expect(estaEnRotacion(chofer("Cardarelli", "Facundo Eliseo"), DEL_EXCEL)).toBe(true);
  });

  it("NO confunde a dos personas del mismo apellido", () => {
    // El Excel tiene LAGANO GUILLERMO; Daniel Omar es otro Lagano y su baja falta.
    expect(estaEnRotacion(chofer("Lagano", "Daniel Omar"), DEL_EXCEL)).toBe(false);
    expect(estaEnRotacion(chofer("Lagano", "Guillermo Jesus"), DEL_EXCEL)).toBe(true);
  });

  it("tampoco confunde a los dos Pittana", () => {
    expect(estaEnRotacion(chofer("Pittana", "Jorge Armando"), DEL_EXCEL)).toBe(true);
    expect(estaEnRotacion(chofer("Pittana", "Eugenio Omar"), DEL_EXCEL)).toBe(false);
  });

  it("ignora acentos y mayúsculas", () => {
    expect(estaEnRotacion(chofer("Gomez", "Matías"), [{ chofer_id: null, nombre: "Gómez Matías" }])).toBe(
      true,
    );
  });

  it("dice que no cuando no está", () => {
    expect(estaEnRotacion(chofer("Caligiuri", "Silvio Amadeo"), DEL_EXCEL)).toBe(false);
  });
});

describe("egresadosSinCruzar", () => {
  it("lista sólo a los que faltan", () => {
    const faltan = egresadosSinCruzar(
      [
        chofer("Caligiuri", "Silvio Amadeo"),
        chofer("Salto", "Ivan Andres"),
        chofer("Clemente", "Jonatan Daniel"),
      ],
      DEL_EXCEL,
    );
    expect(faltan.map((c) => c.apellido)).toEqual(["Caligiuri", "Clemente"]);
  });

  it("no cuenta a los fleteros: son terceros, no nómina", () => {
    // Regla de Bárbara: "hay 14, igual dos son fleteros, no cuentan".
    const faltan = egresadosSinCruzar(
      [chofer("Fischer", "Agustín", { rol: "fletero" }), chofer("Fischer", "Pablo", { rol: "fletero" })],
      [],
    );
    expect(faltan).toEqual([]);
  });

  it("no cuenta a quien sigue activo", () => {
    const faltan = egresadosSinCruzar([chofer("Bermay", "Gustavo", { estado: "activo" })], []);
    expect(faltan).toEqual([]);
  });

  it("sin bajas cargadas, faltan todos los egresados de nómina", () => {
    const faltan = egresadosSinCruzar(
      [chofer("Uno", "Alberto"), chofer("Dos", "Beatriz"), chofer("Tres", "Carlos", { rol: "fletero" })],
      [],
    );
    expect(faltan).toHaveLength(2);
  });
});
