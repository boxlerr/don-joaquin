import { describe, it, expect } from "vitest";
import {
  novedadesRecientes,
  novedadesVisibles,
  NOVEDADES,
  type AccesoNovedades,
  type Novedad,
} from "./novedades";
import { SECCION_BY_CODIGO } from "./secciones";
import { AREAS_VACIAS } from "./permisos-nivel";

const base = { tipo: "mejora", ver: "todos" } as const;

const LISTA: Novedad[] = [
  { ...base, id: "hoy", fecha: "2026-08-10", titulo: "de hoy" },
  { ...base, id: "cuatro-dias", fecha: "2026-08-06", titulo: "de hace cuatro días" },
  { ...base, id: "mes-pasado", fecha: "2026-07-20", titulo: "del mes pasado" },
  { ...base, id: "futuro", fecha: "2026-08-31", titulo: "del futuro (typo al cargarla)" },
];

describe("novedadesRecientes", () => {
  it("trae solo las de la ventana, de la más nueva a la más vieja", () => {
    expect(novedadesRecientes("2026-08-10", 10, LISTA).map((n) => n.titulo)).toEqual([
      "de hoy",
      "de hace cuatro días",
    ]);
  });

  it("no muestra novedades con fecha futura", () => {
    // Una fecha mal tipeada no puede quedar clavada arriba de todo para siempre.
    expect(novedadesRecientes("2026-08-10", 365, LISTA).map((n) => n.titulo)).not.toContain(
      "del futuro (typo al cargarla)",
    );
  });

  it("incluye el borde exacto de la ventana", () => {
    expect(novedadesRecientes("2026-08-10", 4, LISTA).map((n) => n.titulo)).toContain(
      "de hace cuatro días",
    );
    expect(novedadesRecientes("2026-08-10", 3, LISTA).map((n) => n.titulo)).not.toContain(
      "de hace cuatro días",
    );
  });

  it("en una semana sin cambios no devuelve nada", () => {
    expect(novedadesRecientes("2026-12-01", 10, LISTA)).toEqual([]);
  });

  it("aguanta una fecha inválida sin romper el pop-up", () => {
    expect(novedadesRecientes("", 10, LISTA)).toEqual([]);
  });
});

/**
 * El filtro por permisos. Es la parte que no se puede probar a ojo: anunciarle a
 * alguien una pantalla que no puede abrir le cuenta que existe y encima le
 * rebota el click.
 */
describe("novedadesVisibles", () => {
  const CONFIDENCIALES: Novedad[] = [
    { id: "publica", fecha: "2026-08-10", tipo: "mejora", ver: "todos", titulo: "para cualquiera" },
    {
      id: "prestamos",
      fecha: "2026-08-10",
      tipo: "nuevo",
      ver: "prestamos",
      titulo: "cuotas del banco",
    },
    {
      id: "compliance",
      fecha: "2026-08-10",
      tipo: "nuevo",
      ver: "compliance",
      titulo: "checklist de Loma",
    },
  ];

  const acceso = (a: Partial<AccesoNovedades>): AccesoNovedades => ({
    secciones: {},
    areas: {},
    ...a,
  });

  it("la de sección confidencial no le aparece a quien no la tiene", () => {
    const visto = novedadesVisibles(CONFIDENCIALES, acceso({ secciones: { prestamos: "none" } }));
    expect(visto.map((n) => n.id)).toEqual(["publica"]);
  });

  it("le aparece a quien sí tiene la sección", () => {
    const visto = novedadesVisibles(CONFIDENCIALES, acceso({ secciones: { prestamos: "read" } }));
    expect(visto.map((n) => n.id)).toEqual(["publica", "prestamos"]);
  });

  it("las que apuntan a un área piden el permiso del área", () => {
    const visto = novedadesVisibles(CONFIDENCIALES, acceso({ areas: { compliance: "write" } }));
    expect(visto.map((n) => n.id)).toEqual(["publica", "compliance"]);
  });

  it("sin permisos resueltos falla cerrado: solo lo público", () => {
    // Si la consulta de permisos vuelve vacía, una novedad de menos no le
    // arruina el día a nadie; anunciar Préstamos a quien no puede verlo, sí.
    expect(novedadesVisibles(CONFIDENCIALES, acceso({})).map((n) => n.id)).toEqual(["publica"]);
  });
});

describe("la lista cargada", () => {
  it("tiene fecha ISO y título", () => {
    // Barata pero atrapa el error real: agregar un renglón con la fecha en
    // formato argentino rompe el orden y la ventana sin avisar.
    for (const n of NOVEDADES) {
      expect(n.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(n.titulo.trim().length).toBeGreaterThan(0);
    }
  });

  it("no repite ids", () => {
    // El id es la memoria de "esta ya la vi": repetido, dos novedades se apagan
    // de a una y la segunda no se muestra nunca.
    const ids = NOVEDADES.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("cada una declara un alcance que existe", () => {
    // El campo es obligatorio (lo pide el tipo), pero un código inventado
    // compilaría igual si mañana se ensancha el tipo: acá se cae.
    for (const n of NOVEDADES) {
      const valido = n.ver === "todos" || n.ver in SECCION_BY_CODIGO || n.ver in AREAS_VACIAS;
      expect(valido, `alcance desconocido en "${n.id}": ${n.ver}`).toBe(true);
    }
  });
});
