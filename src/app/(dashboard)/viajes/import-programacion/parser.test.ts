import { describe, it, expect } from "vitest";
import {
  aFechaISO,
  aToneladas,
  agruparEnCircuitos,
  claveColumna,
  corto,
  detectarFormato,
  parsearFilasExcel,
  parsearTextoPdf,
  tramosDelCircuito,
  type FilaCruda,
} from "./parser";

/** El encabezado real del archivo que manda Loma Negra. */
const ENCABEZADO: FilaCruda = [
  "ID Orden Flete", "Nº etapa", "Nº transporte", "N° Trans.Previo", "N° Trans.Posterior",
  "Fecha entrega", "Centro", "Clase de viaje", "Nombre cliente", "Destinat.mcía.",
  "Nom.proveedor", "Calle", "Población", "Desc. Región", "Material", "Descripción",
  "Ctd.de pedido", "UM venta", "Pallet Retorno",
];

/** Dos filas reales del archivo del 29/07: la ida y la vuelta de un circuito. */
const FILAS: FilaCruda[] = [
  ENCABEZADO,
  [
    "6100062748", "1", "210061753", "", "210061773", "2026-07-29", "A111",
    "Transferencia entre Plantas", "FÁBRICA RAMALLO", "FÁBRICA RAMALLO", "",
    "PARQUE COMIRSA", "RAMALLO", "Buenos Aires", "30010", "CEMENTO CPC E 40 ENSACADO",
    "38000", "KG", "",
  ],
  [
    "6100062748", "2", "210061773", "210061753", "", "2026-07-29", "A109",
    "Transferencia entre Plantas", "LOMASER", "LOMASER", "",
    "Ruta Nacional 205 - Km 50,5", "Vicente Casares - Cañuelas", "Buenos Aires",
    "30033", "ESCORIA ALTO HORNO DESP", "35000", "KG", "",
  ],
];

describe("detectarFormato", () => {
  const bytes = (...b: number[]) => new Uint8Array([...b, 0, 0, 0, 0]);

  it("reconoce por los bytes, no por la extensión", () => {
    // Un xlsx renombrado a .pdf sigue siendo un zip.
    expect(detectarFormato(bytes(0x50, 0x4b), "programacion.pdf")).toBe("excel");
    expect(detectarFormato(bytes(0x25, 0x50, 0x44, 0x46), "cosa.xlsx")).toBe("pdf");
  });

  it("reconoce el .xls viejo", () => {
    expect(detectarFormato(bytes(0xd0, 0xcf, 0x11, 0xe0), "viejo.xls")).toBe("excel");
  });

  it("sin firma cae en la extensión", () => {
    expect(detectarFormato(bytes(1, 2, 3), "prog.xlsx")).toBe("excel");
    expect(detectarFormato(bytes(1, 2, 3), "prog.pdf")).toBe("pdf");
    expect(detectarFormato(bytes(1, 2, 3), "prog.txt")).toBe("desconocido");
    expect(detectarFormato(bytes(1, 2, 3))).toBe("desconocido");
  });
});

describe("corto — el número como lo anota Nico", () => {
  it("son los últimos cinco dígitos", () => {
    expect(corto("210061753")).toBe("61753");
    expect(corto("210061012")).toBe("61012");
  });
  it("ignora lo que no sea dígito", () => {
    expect(corto(" 2100-61773 ")).toBe("61773");
  });
});

describe("aFechaISO", () => {
  it("EL BUG: una fecha de Excel se lee en UTC, no en hora local", () => {
    // ExcelJS materializa el día a medianoche UTC. Leyéndolo con getDate(), en
    // Argentina daba el día anterior y los viajes entraban un día antes.
    expect(aFechaISO(new Date("2026-07-29T00:00:00Z"))).toBe("2026-07-29");
    expect(aFechaISO(new Date("2026-01-01T00:00:00Z"))).toBe("2026-01-01");
  });

  it("acepta texto ISO y dd/mm/aaaa", () => {
    expect(aFechaISO("2026-07-29")).toBe("2026-07-29");
    expect(aFechaISO("29/07/2026")).toBe("2026-07-29");
    expect(aFechaISO("9/7/26")).toBe("2026-07-09");
  });

  it("null cuando no se entiende", () => {
    expect(aFechaISO("")).toBeNull();
    expect(aFechaISO(null)).toBeNull();
    expect(aFechaISO("cualquier cosa")).toBeNull();
  });
});

describe("aToneladas", () => {
  it("los kilos del archivo pasan a toneladas", () => {
    expect(aToneladas("38000", "KG")).toBe(38);
    expect(aToneladas("35020", "KG")).toBe(35.02);
  });
  it("si ya viene en toneladas no se divide", () => {
    expect(aToneladas("38", "TN")).toBe(38);
  });
  it("null si no hay cantidad", () => {
    expect(aToneladas("", "KG")).toBeNull();
    expect(aToneladas("0", "KG")).toBeNull();
    expect(aToneladas("abc", "KG")).toBeNull();
  });
});

describe("claveColumna", () => {
  it("normaliza el encabezado real", () => {
    expect(claveColumna("Nº transporte")).toBe("n transporte");
    expect(claveColumna("N° Trans.Previo")).toBe("n trans previo");
    expect(claveColumna("Destinat.mcía.")).toBe("destinat mcia");
    expect(claveColumna("Ctd.de pedido")).toBe("ctd de pedido");
    expect(claveColumna("Población")).toBe("poblacion");
  });
});

describe("parsearFilasExcel — contra el archivo real", () => {
  const { filas, columnasNoReconocidas } = parsearFilasExcel(FILAS);

  it("saca las dos etapas", () => {
    expect(filas).toHaveLength(2);
  });

  it("mapea la ida completa", () => {
    expect(filas[0]).toEqual({
      ordenFlete: "6100062748",
      etapa: 1,
      nroTransporte: "210061753",
      nroCorto: "61753",
      transPrevio: null,
      transPosterior: "210061773",
      fecha: "2026-07-29",
      centro: "A111",
      claseViaje: "Transferencia entre Plantas",
      destino: "FÁBRICA RAMALLO",
      poblacion: "RAMALLO",
      material: "CEMENTO CPC E 40 ENSACADO",
      toneladas: 38,
    });
  });

  it("la vuelta trae su propio destino y tonelaje", () => {
    expect(filas[1]!.nroCorto).toBe("61773");
    expect(filas[1]!.destino).toBe("LOMASER");
    expect(filas[1]!.toneladas).toBe(35);
  });

  it("avisa qué columnas ignoró, para notar si el archivo cambia", () => {
    expect(columnasNoReconocidas).toContain("calle");
    expect(columnasNoReconocidas).toContain("pallet retorno");
  });

  it("no se rompe si cambian de orden las columnas", () => {
    const alReves = FILAS.map((f) => [...f].reverse());
    const r = parsearFilasExcel(alReves);
    expect(r.filas).toHaveLength(2);
    expect(r.filas[0]!.nroTransporte).toBe("210061753");
  });

  it("descarta las filas sin número de transporte", () => {
    const conBasura = [...FILAS, ["", "", "", "", ""] as FilaCruda];
    expect(parsearFilasExcel(conBasura).filas).toHaveLength(2);
  });

  it("un archivo vacío no rompe", () => {
    expect(parsearFilasExcel([])).toEqual({ filas: [], columnasNoReconocidas: [] });
  });
});

describe("agruparEnCircuitos", () => {
  const { filas } = parsearFilasExcel(FILAS);

  it("junta la ida con la vuelta, que es el par que anota Nico", () => {
    const c = agruparEnCircuitos(filas);
    expect(c).toHaveLength(1);
    expect(c[0]!.ordenFlete).toBe("6100062748");
    expect(c[0]!.etapas.map((e) => e.nroCorto)).toEqual(["61753", "61773"]);
  });

  it("ordena las etapas aunque vengan al revés", () => {
    const c = agruparEnCircuitos([filas[1]!, filas[0]!]);
    expect(c[0]!.etapas.map((e) => e.etapa)).toEqual([1, 2]);
  });

  it("una fila sin orden de flete es su propio circuito", () => {
    const suelta = { ...filas[0]!, ordenFlete: "" };
    const c = agruparEnCircuitos([suelta]);
    expect(c).toHaveLength(1);
    expect(c[0]!.ordenFlete).toBe("");
  });
});

describe("tramosDelCircuito", () => {
  it("el origen de una etapa es el destino de la anterior", () => {
    const { filas } = parsearFilasExcel(FILAS);
    const t = tramosDelCircuito(agruparEnCircuitos(filas)[0]!);
    expect(t[0]!.origen).toBeNull(); // la primera no lo trae el archivo
    expect(t[0]!.destino).toBe("FÁBRICA RAMALLO");
    expect(t[1]!.origen).toBe("FÁBRICA RAMALLO");
    expect(t[1]!.destino).toBe("LOMASER");
  });
});

describe("parsearTextoPdf", () => {
  it("reconoce las filas por el número de transporte", () => {
    const texto = [
      "Programación de viajes",
      "6100062748  1  210061753  2026-07-29  A111  FÁBRICA RAMALLO",
      "6100062748  2  210061773  2026-07-29  A109  LOMASER",
    ].join("\n");
    const r = parsearTextoPdf(texto);
    expect(r.map((f) => f.nroCorto)).toEqual(["61753", "61773"]);
    expect(r[0]!.fecha).toBe("2026-07-29");
    expect(r[0]!.centro).toBe("A111");
  });

  it("es conservador: lo que no puede afirmar queda vacío", () => {
    const r = parsearTextoPdf("210061753 sin nada más");
    expect(r[0]!.destino).toBeNull();
    expect(r[0]!.toneladas).toBeNull();
  });

  it("no repite un transporte que aparece dos veces", () => {
    const r = parsearTextoPdf("210061753 algo\n210061753 otra vez");
    expect(r).toHaveLength(1);
  });

  it("un PDF que no es la programación devuelve vacío en vez de basura", () => {
    expect(parsearTextoPdf("Factura A 0001-00001234\nTotal $ 50.000")).toEqual([]);
  });
});
