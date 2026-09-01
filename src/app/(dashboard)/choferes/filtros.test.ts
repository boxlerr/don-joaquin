import { describe, it, expect } from "vitest";
import {
  DOCS_VACIO,
  FILTROS_AVANZADOS_VACIOS,
  aniosEnLaEmpresa,
  contarAvanzados,
  contarFiltros,
  hayFiltros,
  normalizarFiltros,
  FILTROS_VACIOS,
  filtrosDesdeUrl,
  opcionesDe,
  ordenar,
  pasaAvanzados,
  pasaEstado,
  pasaRapido,
  rolDe,
  urgenciaDocs,
  type ChoferListado,
  type DocsResumen,
} from "./filtros";

const hoy = new Date("2026-08-07T12:00:00Z");
const haceAnios = (n: number) => {
  const d = new Date(hoy);
  d.setFullYear(d.getFullYear() - n);
  return d.toISOString().slice(0, 10);
};

function persona(o: Partial<ChoferListado> = {}): ChoferListado {
  return {
    id: "c1",
    nombre: "Pablo",
    apellido: "Acosta",
    dni: "26157850",
    cuil: "20-26157850-7",
    telefono: "11-53296907",
    localidad: "AZUL",
    estado: "activo",
    rol: "chofer",
    fecha_ingreso: haceAnios(3),
    camion_patente: "AF696CW",
    camion_marca: "Iveco",
    ...o,
  };
}

const docs = (o: Partial<DocsResumen> = {}): DocsResumen => ({ ...DOCS_VACIO, ...o });

describe("rolDe", () => {
  it("trata como chofer al legacy sin rol y a cualquier valor raro", () => {
    expect(rolDe({})).toBe("chofer");
    expect(rolDe({ rol: null })).toBe("chofer");
    expect(rolDe({ rol: "cualquier_cosa" })).toBe("chofer");
    expect(rolDe({ rol: "fletero" })).toBe("fletero");
  });
});

describe("pasaEstado", () => {
  it("'período de prueba' son los primeros 6 meses, y nunca un egresado", () => {
    const nuevo = persona({ fecha_ingreso: haceAnios(0) });
    const viejo = persona({ fecha_ingreso: haceAnios(3) });
    expect(pasaEstado(nuevo, "periodo_prueba")).toBe(true);
    expect(pasaEstado(viejo, "periodo_prueba")).toBe(false);
    // Alguien que entró hace poco pero ya se fue no está "en prueba".
    expect(
      pasaEstado(persona({ fecha_ingreso: haceAnios(0), estado: "baja" }), "periodo_prueba"),
    ).toBe(false);
  });
});

describe("pasaRapido", () => {
  it("distingue sin documentos de todo al día", () => {
    const c = persona();
    expect(pasaRapido(c, "sin_documentos", docs())).toBe(true);
    expect(pasaRapido(c, "sin_documentos", docs({ total: 3, alDia: 3 }))).toBe(false);
  });

  it("vencidos y por vencer miran cada uno lo suyo", () => {
    const c = persona();
    const conVencido = docs({ total: 2, vencidos: 1, alDia: 1 });
    expect(pasaRapido(c, "vencidos", conVencido)).toBe(true);
    expect(pasaRapido(c, "por_vencer", conVencido)).toBe(false);
  });

  it("un campo con sólo espacios cuenta como vacío", () => {
    expect(pasaRapido(persona({ localidad: "   " }), "sin_localidad", docs())).toBe(true);
    expect(pasaRapido(persona({ telefono: "" }), "sin_telefono", docs())).toBe(true);
    expect(pasaRapido(persona(), "sin_localidad", docs())).toBe(false);
  });
});

describe("filtros avanzados", () => {
  it("cuenta grupos, no valores", () => {
    expect(contarAvanzados(FILTROS_AVANZADOS_VACIOS)).toBe(0);
    expect(
      contarAvanzados({ ...FILTROS_AVANZADOS_VACIOS, localidades: ["AZUL", "MONTE", "OLAVARRIA"] }),
    ).toBe(1);
    expect(
      contarAvanzados({ ...FILTROS_AVANZADOS_VACIOS, localidades: ["AZUL"], camion: "sin" }),
    ).toBe(2);
  });

  it("filtra por localidad y por marca", () => {
    const c = persona();
    expect(pasaAvanzados(c, { ...FILTROS_AVANZADOS_VACIOS, localidades: ["AZUL"] })).toBe(true);
    expect(pasaAvanzados(c, { ...FILTROS_AVANZADOS_VACIOS, localidades: ["MONTE"] })).toBe(false);
    expect(pasaAvanzados(c, { ...FILTROS_AVANZADOS_VACIOS, marcas: ["Scania"] })).toBe(false);
  });

  it("con/sin camión", () => {
    const con = persona();
    const sin = persona({ camion_patente: null });
    expect(pasaAvanzados(con, { ...FILTROS_AVANZADOS_VACIOS, camion: "con" })).toBe(true);
    expect(pasaAvanzados(con, { ...FILTROS_AVANZADOS_VACIOS, camion: "sin" })).toBe(false);
    expect(pasaAvanzados(sin, { ...FILTROS_AVANZADOS_VACIOS, camion: "sin" })).toBe(true);
  });

  it("los tramos de antigüedad no se pisan y quien no tiene fecha queda afuera", () => {
    const tramo = (anios: number) =>
      (["menos_1", "1_5", "5_10", "mas_10"] as const).filter((t) =>
        pasaAvanzados(persona({ fecha_ingreso: haceAnios(anios) }), {
          ...FILTROS_AVANZADOS_VACIOS,
          antiguedad: t,
        }),
      );
    expect(tramo(0)).toEqual(["menos_1"]);
    expect(tramo(3)).toEqual(["1_5"]);
    expect(tramo(7)).toEqual(["5_10"]);
    expect(tramo(15)).toEqual(["mas_10"]);
    // Justo en el borde cae en el tramo de arriba, no en los dos.
    expect(tramo(5)).toEqual(["5_10"]);
    expect(tramo(10)).toEqual(["mas_10"]);

    expect(
      pasaAvanzados(persona({ fecha_ingreso: null }), {
        ...FILTROS_AVANZADOS_VACIOS,
        antiguedad: "1_5",
      }),
    ).toBe(false);
  });

  it("legajo completo vs incompleto usa las reglas del legajo", () => {
    const completo = persona();
    const incompleto = persona({ cuil: null });
    expect(pasaAvanzados(completo, { ...FILTROS_AVANZADOS_VACIOS, legajo: "completo" })).toBe(true);
    expect(pasaAvanzados(incompleto, { ...FILTROS_AVANZADOS_VACIOS, legajo: "completo" })).toBe(
      false,
    );
    expect(pasaAvanzados(incompleto, { ...FILTROS_AVANZADOS_VACIOS, legajo: "incompleto" })).toBe(
      true,
    );
  });
});

describe("opcionesDe", () => {
  it("saca las opciones de los datos, con conteo y ordenadas por cantidad", () => {
    const gente = [
      persona({ id: "1", localidad: "AZUL" }),
      persona({ id: "2", localidad: "AZUL" }),
      persona({ id: "3", localidad: "MONTE" }),
      persona({ id: "4", localidad: "  " }),
      persona({ id: "5", localidad: null }),
    ];
    expect(opcionesDe(gente, (c) => c.localidad)).toEqual([
      { valor: "AZUL", label: "AZUL", n: 2 },
      { valor: "MONTE", label: "MONTE", n: 1 },
    ]);
  });
});

describe("urgenciaDocs", () => {
  it("un vencido pesa más que cualquier cantidad de por vencer", () => {
    expect(urgenciaDocs(docs({ total: 1, vencidos: 1 }))).toBeGreaterThan(
      urgenciaDocs(docs({ total: 50, porVencer: 50 })),
    );
  });

  it("sin documentos queda arriba de estar al día, y abajo de un vencimiento", () => {
    const sinNada = urgenciaDocs(docs());
    const alDia = urgenciaDocs(docs({ total: 5, alDia: 5 }));
    const porVencer = urgenciaDocs(docs({ total: 5, porVencer: 1, alDia: 4 }));
    expect(sinNada).toBeGreaterThan(alDia);
    expect(porVencer).toBeGreaterThan(sinNada);
  });
});

describe("ordenar", () => {
  const a = persona({ id: "a", apellido: "Acosta", fecha_ingreso: haceAnios(1) });
  const b = persona({ id: "b", apellido: "Zurita", fecha_ingreso: haceAnios(10) });
  const c = persona({ id: "c", apellido: "Medina", fecha_ingreso: null, cuil: null });
  const lista = [b, c, a];
  const resumen: Record<string, DocsResumen> = {
    a: docs({ total: 3, vencidos: 2, alDia: 1 }),
    b: docs({ total: 3, alDia: 3 }),
    c: docs(),
  };
  const docsDe = (id: string) => resumen[id] ?? DOCS_VACIO;
  const ids = (o: Parameters<typeof ordenar>[1]) => ordenar(lista, o, docsDe).map((x) => x.id);

  it("por apellido en los dos sentidos", () => {
    expect(ids("apellido_az")).toEqual(["a", "c", "b"]);
    expect(ids("apellido_za")).toEqual(["b", "c", "a"]);
  });

  it("quien no tiene fecha de ingreso va al final en los dos sentidos de antigüedad", () => {
    expect(ids("antiguedad_asc")).toEqual(["b", "a", "c"]);
    expect(ids("antiguedad_desc")).toEqual(["a", "b", "c"]);
  });

  it("por urgencia de documentación", () => {
    expect(ids("documentos")).toEqual(["a", "c", "b"]);
  });

  it("por legajo incompleto", () => {
    // A `c` le falta el CUIL Y la fecha de ingreso: dos bloqueantes.
    expect(ids("legajo")[0]).toBe("c");
  });
});

describe("hayFiltros", () => {
  it("el orden no cuenta como filtro", () => {
    expect(hayFiltros(FILTROS_VACIOS)).toBe(false);
    expect(hayFiltros({ ...FILTROS_VACIOS, orden: "documentos" })).toBe(false);
    expect(hayFiltros({ ...FILTROS_VACIOS, query: "  " })).toBe(false);
    expect(hayFiltros({ ...FILTROS_VACIOS, rapidos: ["vencidos"] })).toBe(true);
    expect(hayFiltros({ ...FILTROS_VACIOS, rol: "fletero" })).toBe(true);
  });
});

describe("pasaRapido — egresados", () => {
  it("un egresado no entra en ningún acceso rápido", () => {
    const egresado = persona({ estado: "baja", localidad: null, telefono: null });
    const todos = [
      "activos",
      "por_vencer",
      "vencidos",
      "sin_documentos",
      "sin_localidad",
      "sin_telefono",
    ] as const;
    // Son pendientes de carga y a alguien que ya se fue no se le reclama nada;
    // además viven en una sección aparte, así que el número del chip mentiría.
    for (const q of todos) {
      expect(pasaRapido(egresado, q, docs({ total: 1, vencidos: 1 }))).toBe(false);
    }
  });
});

describe("normalizarFiltros", () => {
  it("acepta basura sin romper y devuelve algo usable", () => {
    for (const basura of [null, undefined, 42, "texto", [], {}]) {
      const f = normalizarFiltros(basura);
      expect(f.rapidos).toEqual([]);
      expect(f.avanzados.localidades).toEqual([]);
      expect(f.query).toBe("");
      expect(hayFiltros(f)).toBe(false);
    }
  });

  it("rescata una búsqueda guardada de una versión vieja sin tirar la pantalla", () => {
    // Forma anterior: sin `avanzados` ni `rapidos`. Entraba tal cual al estado y
    // `f.rapidos.length` reventaba en pleno render.
    const vieja = { rol: "chofer", estado: "activo", orden: "apellido_az", query: "acosta" };
    const f = normalizarFiltros(vieja);
    expect(f.rol).toBe("chofer");
    expect(f.estado).toBe("activo");
    expect(f.query).toBe("acosta");
    expect(f.rapidos).toEqual([]);
    expect(f.avanzados).toEqual(FILTROS_AVANZADOS_VACIOS);
  });

  it("descarta valores que ya no existen en vez de dejarlos pasar", () => {
    const f = normalizarFiltros({
      rol: "inventado",
      estado: "inventado",
      orden: "inventado",
      rapidos: ["vencidos", "ya_no_existe", 7],
      avanzados: { localidades: ["AZUL", 3], antiguedad: "inventado", camion: "sin" },
    });
    expect(f.rol).toBe("todos");
    expect(f.estado).toBe("todos");
    expect(f.orden).toBe("apellido_az");
    expect(f.rapidos).toEqual(["vencidos"]);
    expect(f.avanzados.localidades).toEqual(["AZUL"]);
    expect(f.avanzados.antiguedad).toBe("todas");
    // Lo que sí es válido se conserva.
    expect(f.avanzados.camion).toBe("sin");
  });
});

describe("contarFiltros", () => {
  it("suma cada cosa que angosta, y el orden no cuenta", () => {
    expect(contarFiltros(FILTROS_VACIOS)).toBe(0);
    expect(contarFiltros({ ...FILTROS_VACIOS, orden: "documentos" })).toBe(0);
    expect(
      contarFiltros({
        ...FILTROS_VACIOS,
        rol: "chofer",
        query: "azul",
        rapidos: ["vencidos", "sin_telefono"],
        avanzados: { ...FILTROS_AVANZADOS_VACIOS, localidades: ["AZUL"], camion: "sin" },
      }),
    ).toBe(6); // rol + query + 2 rápidos + localidad + camión
  });
});

describe("aniosEnLaEmpresa", () => {
  it("cuenta años cumplidos, no calendarios", () => {
    expect(aniosEnLaEmpresa("2020-08-08", new Date("2026-08-07"))).toBe(5);
    expect(aniosEnLaEmpresa("2020-08-07", new Date("2026-08-07"))).toBe(6);
    expect(aniosEnLaEmpresa(null)).toBeNull();
  });
});

/**
 * Abrir Legajos ya filtrado desde un aviso.
 *
 * El pop-up del día decía "Documentos · 2 vencidos" y el pie caía en la lista de
 * avisos: había que rearmar a mano el filtro que produjo el número (Julián,
 * 01/09/2026). Lo que se cuida acá es que un link roto o viejo abra la pantalla
 * entera en vez de romperla.
 */
describe("filtrosDesdeUrl", () => {
  it("activa el acceso rápido pedido y ordena por urgencia", () => {
    const f = filtrosDesdeUrl("vencidos");
    expect(f.rapidos).toEqual(["vencidos"]);
    expect(f.orden).toBe("documentos");
  });

  it("acepta varios separados por coma, porque los chips se acumulan", () => {
    expect(filtrosDesdeUrl("vencidos,sin_telefono").rapidos).toEqual(["vencidos", "sin_telefono"]);
  });

  it("descarta lo que no es un acceso rápido conocido", () => {
    expect(filtrosDesdeUrl("no_existe").rapidos).toEqual([]);
    expect(filtrosDesdeUrl("no_existe,vencidos").rapidos).toEqual(["vencidos"]);
  });

  it("sin parámetro deja la pantalla como estaba", () => {
    expect(filtrosDesdeUrl(null)).toEqual(FILTROS_VACIOS);
    expect(filtrosDesdeUrl(undefined)).toEqual(FILTROS_VACIOS);
    expect(filtrosDesdeUrl("")).toEqual(FILTROS_VACIOS);
  });

  it("no repite un chip aunque venga dos veces", () => {
    expect(filtrosDesdeUrl("vencidos,vencidos").rapidos).toEqual(["vencidos"]);
  });

  it("un acceso rápido que no habla de documentos no cambia el orden", () => {
    expect(filtrosDesdeUrl("sin_telefono").orden).toBe(FILTROS_VACIOS.orden);
  });
});
