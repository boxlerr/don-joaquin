import { describe, it, expect } from "vitest";
import {
  coincide,
  contarFiltros,
  etiquetaTipo,
  FILTROS_VACIOS,
  normalizar,
  opcionesDe,
  pasaFiltros,
  rangoAnios,
  type UnidadBuscable,
} from "./filtros";

const FLOTA: UnidadBuscable[] = [
  {
    patente: "AA244ZI",
    marca: "Mercedes Benz",
    modelo: "FR-695 VERSION 1735 45",
    ano: 2016,
    capacidad_tn: 35,
    tipo: "tractor",
    estado: "activo",
    chofer_nombre: "Iglesias Franco Ezequiel",
    acoplados_vinculados: ["AE388DU"],
  },
  {
    patente: "AA696BJ",
    marca: "Scania",
    modelo: "291-9310 B4X2",
    ano: 2016,
    capacidad_tn: 35,
    tipo: "tractor",
    estado: "activo",
    chofer_nombre: "Cartasso Hector Alejo",
  },
  {
    patente: "AF123XX",
    marca: "Iveco",
    modelo: "S-WAY 480",
    ano: 2024,
    capacidad_tn: 38,
    tipo: "tractor",
    estado: "activo",
    chofer_nombre: null,
  },
  {
    patente: "AG999ZZ",
    marca: "Iveco",
    modelo: "TECTOR",
    ano: 2020,
    capacidad_tn: 35,
    tipo: "chasis_rigido",
    estado: "mantenimiento",
    chofer_nombre: null,
  },
  { patente: "AA244ZJ", marca: null, modelo: null, ano: null, capacidad_tn: 38, tipo: "tractor" },
];

describe("normalizar", () => {
  it("saca acentos, mayúsculas y separadores", () => {
    expect(normalizar("Mercedés-Benz")).toBe("mercedes benz");
    expect(normalizar("  SCANIA   291/9310 ")).toBe("scania 291 9310");
    expect(normalizar("chasis_rigido")).toBe("chasis rigido");
  });
});

describe("coincide — el caso que se reportó", () => {
  it("escribir 'iveco' trae los Iveco", () => {
    const r = FLOTA.filter((u) => coincide(u, "iveco"));
    expect(r.map((u) => u.patente)).toEqual(["AF123XX", "AG999ZZ"]);
  });

  it("sigue andando por patente y por chofer", () => {
    expect(FLOTA.filter((u) => coincide(u, "AA244ZI")).map((u) => u.patente)).toEqual(["AA244ZI"]);
    expect(FLOTA.filter((u) => coincide(u, "cartasso")).map((u) => u.patente)).toEqual(["AA696BJ"]);
  });

  it("encuentra por año, modelo, tipo y acoplado vinculado", () => {
    expect(FLOTA.filter((u) => coincide(u, "2016")).length).toBe(2);
    expect(FLOTA.filter((u) => coincide(u, "s-way")).map((u) => u.patente)).toEqual(["AF123XX"]);
    expect(FLOTA.filter((u) => coincide(u, "chasis rigido")).map((u) => u.patente)).toEqual([
      "AG999ZZ",
    ]);
    expect(FLOTA.filter((u) => coincide(u, "AE388DU")).map((u) => u.patente)).toEqual(["AA244ZI"]);
  });

  it("varias palabras angostan en vez de sumar", () => {
    expect(FLOTA.filter((u) => coincide(u, "iveco 2024")).map((u) => u.patente)).toEqual([
      "AF123XX",
    ]);
    expect(FLOTA.filter((u) => coincide(u, "iveco 2016")).length).toBe(0);
  });

  it("no le importan los acentos ni las mayúsculas", () => {
    expect(FLOTA.filter((u) => coincide(u, "MERCEDES")).map((u) => u.patente)).toEqual(["AA244ZI"]);
    expect(FLOTA.filter((u) => coincide(u, "mercedés benz")).map((u) => u.patente)).toEqual([
      "AA244ZI",
    ]);
  });

  it("sin búsqueda pasan todas, y los espacios no cuentan", () => {
    expect(FLOTA.filter((u) => coincide(u, "")).length).toBe(FLOTA.length);
    expect(FLOTA.filter((u) => coincide(u, "   ")).length).toBe(FLOTA.length);
  });

  it("no rompe con una unidad sin datos", () => {
    expect(coincide(FLOTA[4]!, "AA244ZJ")).toBe(true);
    expect(coincide(FLOTA[4]!, "iveco")).toBe(false);
  });
});

describe("pasaFiltros", () => {
  it("sin filtros pasa todo", () => {
    expect(FLOTA.every((u) => pasaFiltros(u, FILTROS_VACIOS))).toBe(true);
  });

  it("marca", () => {
    const f = { ...FILTROS_VACIOS, marcas: ["Iveco"] };
    expect(FLOTA.filter((u) => pasaFiltros(u, f)).length).toBe(2);
  });

  it("varias marcas suman", () => {
    const f = { ...FILTROS_VACIOS, marcas: ["Iveco", "Scania"] };
    expect(FLOTA.filter((u) => pasaFiltros(u, f)).length).toBe(3);
  });

  it("tipo y capacidad", () => {
    expect(FLOTA.filter((u) => pasaFiltros(u, { ...FILTROS_VACIOS, tipos: ["tractor"] })).length).toBe(4);
    expect(FLOTA.filter((u) => pasaFiltros(u, { ...FILTROS_VACIOS, capacidades: [38] })).length).toBe(2);
  });

  it("rango de años, con las dos puntas incluidas", () => {
    const f = { ...FILTROS_VACIOS, anioDesde: 2016, anioHasta: 2020 };
    expect(FLOTA.filter((u) => pasaFiltros(u, f)).map((u) => u.patente)).toEqual([
      "AA244ZI",
      "AA696BJ",
      "AG999ZZ",
    ]);
  });

  it("la que no tiene año cargado queda afuera del rango", () => {
    expect(pasaFiltros(FLOTA[4]!, { ...FILTROS_VACIOS, anioDesde: 2000 })).toBe(false);
  });

  it("los filtros se combinan entre sí", () => {
    const f = { ...FILTROS_VACIOS, marcas: ["Iveco"], tipos: ["tractor"] };
    expect(FLOTA.filter((u) => pasaFiltros(u, f)).map((u) => u.patente)).toEqual(["AF123XX"]);
  });
});

describe("contarFiltros", () => {
  it("cuenta cada valor y el rango como uno solo", () => {
    expect(contarFiltros(FILTROS_VACIOS)).toBe(0);
    expect(contarFiltros({ ...FILTROS_VACIOS, marcas: ["Iveco", "Scania"] })).toBe(2);
    expect(contarFiltros({ ...FILTROS_VACIOS, anioDesde: 2020, anioHasta: 2024 })).toBe(1);
    expect(contarFiltros({ ...FILTROS_VACIOS, anioDesde: 2020 })).toBe(1);
  });
});

describe("opcionesDe", () => {
  it("ordena por cantidad y saca los vacíos", () => {
    const o = opcionesDe(FLOTA, (u) => u.marca);
    expect(o.map((x) => `${x.valor}:${x.n}`)).toEqual(["Iveco:2", "Mercedes Benz:1", "Scania:1"]);
  });

  it("aplica la etiqueta", () => {
    const o = opcionesDe(FLOTA, (u) => u.tipo, etiquetaTipo);
    expect(o[0]).toEqual({ valor: "tractor", label: "Tractor", n: 4 });
  });
});

describe("rangoAnios", () => {
  it("devuelve el mínimo y el máximo reales", () => {
    expect(rangoAnios(FLOTA)).toEqual({ min: 2016, max: 2024 });
  });
  it("null si no hay ninguno cargado", () => {
    expect(rangoAnios([{ patente: "X" }])).toBeNull();
  });
});
