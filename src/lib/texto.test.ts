import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CARACTERES_DESTINO,
  CARACTERES_ORIGEN,
  coincideBusqueda,
  coincideEnAlguno,
  coincideTerminos,
  normalizarTexto,
} from "./texto";

describe("normalizarTexto", () => {
  it("saca acentos y pasa a minúsculas", () => {
    expect(normalizarTexto("Agustín")).toBe("agustin");
    expect(normalizarTexto("BENÍTEZ")).toBe("benitez");
    expect(normalizarTexto("Asteazarán")).toBe("asteazaran");
  });

  it("trata la ñ como n", () => {
    expect(normalizarTexto("Muñoz")).toBe("munoz");
    expect(normalizarTexto("Peña")).toBe("pena");
  });

  it("colapsa espacios y recorta", () => {
    expect(normalizarTexto("  Surra,   Agustin  ")).toBe("surra, agustin");
    // El espacio duro que llega pegado desde Excel cuenta como espacio.
    expect(normalizarTexto("Pago  Nación")).toBe("pago nacion");
  });

  it("conserva un acento suelto (tecla muerta), igual que unaccent en Postgres", () => {
    expect(normalizarTexto("´")).toBe("´");
    expect(normalizarTexto("^")).toBe("^");
  });

  it("traduce los signos que unaccent también traduce", () => {
    expect(normalizarTexto("Gasoil – YPF")).toBe("gasoil - ypf");
    expect(normalizarTexto("Gasoil — YPF")).toBe("gasoil - ypf");
    expect(normalizarTexto("D’Angelo")).toBe("d'angelo");
    expect(normalizarTexto("“Ruta 9”")).toBe('"ruta 9"');
  });

  it("tolera null, undefined y no-strings", () => {
    expect(normalizarTexto(null)).toBe("");
    expect(normalizarTexto(undefined)).toBe("");
    expect(normalizarTexto(123)).toBe("123");
  });
});

describe("coincideBusqueda", () => {
  it("encuentra con y sin acento en cualquier dirección", () => {
    expect(coincideBusqueda("Asteazarán, Agustín", "agustin")).toBe(true);
    expect(coincideBusqueda("Asteazaran, Agustin", "agustín")).toBe(true);
    expect(coincideBusqueda("Benítez, Sergio Agustín", "benitez")).toBe(true);
    expect(coincideBusqueda("Fischer, Agustín", "AGUSTIN")).toBe(true);
  });

  it("una búsqueda vacía no filtra", () => {
    expect(coincideBusqueda("lo que sea", "")).toBe(true);
    expect(coincideBusqueda("lo que sea", "   ")).toBe(true);
  });

  it("sigue descartando lo que no coincide", () => {
    expect(coincideBusqueda("Goity, Agustin", "perez")).toBe(false);
  });

  it("no rompe con valores nulos", () => {
    expect(coincideBusqueda(null, "agustin")).toBe(false);
    expect(coincideBusqueda(null, "")).toBe(true);
  });
});

describe("coincideEnAlguno", () => {
  it("alcanza con que coincida un campo", () => {
    expect(coincideEnAlguno(["Benítez", "AB123CD", null], "ab123")).toBe(true);
    expect(coincideEnAlguno(["Benítez", "AB123CD"], "benitez")).toBe(true);
    expect(coincideEnAlguno(["Benítez", "AB123CD"], "zzz")).toBe(false);
  });
});

describe("coincideTerminos", () => {
  it("busca por palabras sueltas sin importar el orden", () => {
    expect(coincideTerminos(["Surra", "Agustín Lauriano"], "agustin surra")).toBe(true);
    expect(coincideTerminos(["Surra", "Agustín Lauriano"], "lauriano agustin")).toBe(true);
    expect(coincideTerminos(["Surra", "Agustín Lauriano"], "agustin perez")).toBe(false);
  });
});

describe("paridad con public.sin_acentos() de Postgres", () => {
  // Estos casos son los que se rompen si las dos implementaciones se separan:
  // el buscador de Caja, Gastos y Viajes normaliza acá y compara contra una
  // columna que Postgres normalizó allá. Si cambia una, tiene que cambiar la
  // otra (migración 20260730_busqueda_sin_acentos).
  const casos: [string, string][] = [
    ["Pago  Nación", "pago nacion"],
    ["  Peaje Ruta 9  ", "peaje ruta 9"],
    ["Gasoil – YPF Ruta 5", "gasoil - ypf ruta 5"],
    ["ACOPLADO Ñandú", "acoplado nandu"],
    ["Benítez, Sergio Agustín", "benitez, sergio agustin"],
  ];
  it.each(casos)("normaliza %j a %j", (entrada, esperado) => {
    expect(normalizarTexto(entrada)).toBe(esperado);
  });

  it("la tabla de caracteres está alineada uno a uno", () => {
    expect([...CARACTERES_ORIGEN]).toHaveLength([...CARACTERES_DESTINO].length);
  });

  // Este es el candado: la migración lleva una copia literal de las dos cadenas.
  // Si alguien toca la tabla en texto.ts y se olvida del SQL, este test falla e
  // imprime lo que hay que pegar en la migración.
  it("la migración SQL usa exactamente la misma tabla", () => {
    const sql = readFileSync(
      join(__dirname, "../../supabase/migrations/20260730_busqueda_sin_acentos.sql"),
      "utf8",
    );
    const m = sql.match(/translate\(\s*txt,\s*e'((?:[^']|'')*)',\s*'((?:[^']|'')*)'\s*\)/);
    expect(m, "no se encontró el translate() en la migración").not.toBeNull();
    const [, origenSql, destinoSql] = m!;
    expect(origenSql!.replace(/''/g, "'")).toBe(CARACTERES_ORIGEN);
    expect(destinoSql!.replace(/''/g, "'")).toBe(CARACTERES_DESTINO);
  });
});
