import { describe, it, expect } from "vitest";
import { filtrarDestinos, hayFiltros, normalizar, textoFiltros } from "./filtros";
import type { ChoferEnDestino, DestinoResumen } from "./actions";

const chofer = (nombre: string, viajes = 1): ChoferEnDestino => ({
  chofer_id: nombre,
  chofer: nombre,
  rol: "chofer",
  fotoUrl: null,
  camion: "AF541MH",
  camionMarca: "Scania",
  viajes,
  km: 300 * viajes,
  toneladas: 38 * viajes,
  ultimo: "2026-07-29",
  detalle: [],
});

const destino = (nombre: string, choferes: ChoferEnDestino[]): DestinoResumen => ({
  destino: nombre,
  viajes: choferes.reduce((s, c) => s + c.viajes, 0),
  toneladas: choferes.reduce((s, c) => s + c.toneladas, 0),
  km: choferes.reduce((s, c) => s + c.km, 0),
  choferes,
  sinChofer: 0,
  sinChoferDetalle: [],
});

const DATOS: DestinoResumen[] = [
  destino("LOMASER", [chofer("Paz, Leonardo"), chofer("Pittana, Eugenio Omar")]),
  destino("(ESCOBAR) MAPEI", [chofer("Fernandez, José Luis")]),
  destino("RAMALLO", [chofer("Paz, Leonardo")]),
];

describe("normalizar", () => {
  it("ignora acentos y mayúsculas", () => {
    expect(normalizar("  (ESCOBAR) MAPEI ")).toBe("(escobar) mapei");
    expect(normalizar("José")).toBe("jose");
  });
});

describe("filtrarDestinos", () => {
  it("sin filtros devuelve todo tal cual", () => {
    expect(filtrarDestinos(DATOS)).toHaveLength(3);
    expect(filtrarDestinos(DATOS, {})).toHaveLength(3);
  });

  it("busca el destino por pedazo de nombre, sin acentos", () => {
    const r = filtrarDestinos(DATOS, { destino: "escobar" });
    expect(r.map((d) => d.destino)).toEqual(["(ESCOBAR) MAPEI"]);
  });

  it("buscando un chofer, deja sólo los destinos donde fue", () => {
    const r = filtrarDestinos(DATOS, { chofer: "pittana" });
    expect(r.map((d) => d.destino)).toEqual(["LOMASER"]);
    // Y dentro del destino, sólo ese chofer.
    expect(r[0]!.choferes.map((c) => c.chofer)).toEqual(["Pittana, Eugenio Omar"]);
  });

  it("un chofer que fue a dos destinos aparece en los dos", () => {
    const r = filtrarDestinos(DATOS, { chofer: "paz" });
    expect(r.map((d) => d.destino)).toEqual(["LOMASER", "RAMALLO"]);
  });

  it("los dos filtros a la vez se cruzan", () => {
    expect(filtrarDestinos(DATOS, { destino: "lomaser", chofer: "paz" })).toHaveLength(1);
    // Paz no fue a Escobar: no queda nada.
    expect(filtrarDestinos(DATOS, { destino: "escobar", chofer: "paz" })).toHaveLength(0);
  });

  it("no muta los datos originales", () => {
    filtrarDestinos(DATOS, { chofer: "paz" });
    expect(DATOS[0]!.choferes).toHaveLength(2);
  });

  it("una búsqueda que no encuentra nada devuelve vacío, no todo", () => {
    expect(filtrarDestinos(DATOS, { destino: "narnia" })).toEqual([]);
  });
});

describe("hayFiltros", () => {
  it("los espacios en blanco no cuentan como filtro", () => {
    expect(hayFiltros({})).toBe(false);
    expect(hayFiltros({ destino: "   " })).toBe(false);
    expect(hayFiltros({ chofer: "paz" })).toBe(true);
  });
});

describe("textoFiltros", () => {
  it("describe lo que trae el archivo", () => {
    expect(textoFiltros({})).toBeNull();
    expect(textoFiltros({ destino: "LOMASER" })).toBe('Filtrado por destino "LOMASER"');
    expect(textoFiltros({ destino: "LOMASER", chofer: "Paz" })).toBe(
      'Filtrado por destino "LOMASER" y chofer "Paz"',
    );
  });
});
