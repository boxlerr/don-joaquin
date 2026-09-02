import { describe, it, expect } from "vitest";
import { fechaArgentinaAIso, parseCalendarioSecondi } from "./calendario-secondi";

/**
 * El fixture es el texto REAL que devuelve `unpdf` sobre el PDF que mandó
 * Nicolás el 02/09/2026 ("JOAQUIN NICOLAS.pdf", Estudio Secondi), copiado tal
 * cual — desordenado incluido. Es el punto del test: leído de arriba abajo el
 * título aparece ANTEÚLTIMO, así que cualquier parser que confíe en el orden
 * visual del PDF pasa la prueba a mano y falla con el archivo de verdad.
 */
const PDF_JOAQUIN_NICOLAS = [
  "CUIT 20-26402739-0",
  "IMPUESTO VENCIMIENTO",
  "Ingresos Brutos - CM03 15/09/2026",
  "IVA 18/09/2026",
  "Libro IVA Digital 18/09/2026",
  "Belgrano 2013, Olavarría",
  "(02284) - 430858",
  "infoestudio@estudio-secondi.com.ar",
  "CALENDARIO DE VENCIMIENTOS",
  "JOAQUIN NICOLAS",
].join("\n");

describe("parseCalendarioSecondi", () => {
  it("lee el PDF que mandó el estudio, con el texto en el orden en que sale", () => {
    const r = parseCalendarioSecondi(PDF_JOAQUIN_NICOLAS);

    expect(r.razonSocial).toBe("JOAQUIN NICOLAS");
    expect(r.cuit).toBe("20-26402739-0");
    expect(r.filas).toEqual([
      { nombre: "Ingresos Brutos - CM03", fechaVencimiento: "2026-09-15" },
      { nombre: "IVA", fechaVencimiento: "2026-09-18" },
      { nombre: "Libro IVA Digital", fechaVencimiento: "2026-09-18" },
    ]);
    expect(r.advertencias).toEqual([]);
  });

  it("no confunde el pie del estudio con un impuesto", () => {
    const r = parseCalendarioSecondi(PDF_JOAQUIN_NICOLAS);
    const nombres = r.filas.map((f) => f.nombre);
    expect(nombres).not.toContain("Belgrano 2013, Olavarría");
    expect(nombres.some((n) => n.includes("estudio-secondi"))).toBe(false);
  });

  it("respeta los nombres que ya traen una fecha adentro", () => {
    // Así están escritos los de Joaquín Hnos que ya se cargaron a mano.
    const r = parseCalendarioSecondi(
      [
        "CALENDARIO DE VENCIMIENTOS",
        "JOAQUIN HNOS S.R.L.",
        "CUIT 30-70908728-9",
        "IMPUESTO VENCIMIENTO",
        "SICORE pago 2da. Q 07-2026 11/09/2026",
        "Agente Ret. ARBA 1er. Q 09-2026 24/09/2026",
      ].join("\n"),
    );

    expect(r.razonSocial).toBe("JOAQUIN HNOS S.R.L.");
    expect(r.cuit).toBe("30-70908728-9");
    expect(r.filas).toEqual([
      { nombre: "SICORE pago 2da. Q 07-2026", fechaVencimiento: "2026-09-11" },
      { nombre: "Agente Ret. ARBA 1er. Q 09-2026", fechaVencimiento: "2026-09-24" },
    ]);
  });

  it("acepta el CUIT sin guiones y con espacios", () => {
    expect(parseCalendarioSecondi("CUIT 20264027390").cuit).toBe("20-26402739-0");
    expect(parseCalendarioSecondi("CUIT 30 70908728 9").cuit).toBe("30-70908728-9");
  });

  it("descarta la fila con una fecha que no existe, y lo dice", () => {
    const r = parseCalendarioSecondi(
      ["IMPUESTO VENCIMIENTO", "IVA 31/09/2026", "Libro IVA Digital 18/09/2026"].join("\n"),
    );
    expect(r.filas).toEqual([{ nombre: "Libro IVA Digital", fechaVencimiento: "2026-09-18" }]);
    expect(r.advertencias.join(" ")).toContain("31/09/2026");
  });

  it("un PDF escaneado avisa qué hacer en vez de devolver una lista vacía", () => {
    const r = parseCalendarioSecondi("   \n\n  ");
    expect(r.filas).toEqual([]);
    expect(r.advertencias.join(" ")).toContain("escaneo");
  });

  it("un PDF que no es el calendario no inventa filas", () => {
    const r = parseCalendarioSecondi("Factura A 0001-00001234\nTotal $ 125.000");
    expect(r.filas).toEqual([]);
    expect(r.advertencias.join(" ")).toContain("calendario del estudio");
  });
});

/**
 * El MISMO PDF, leído con `extractText(pdf, { mergePages: true })`: unpdf pega
 * todos los renglones en una sola línea separados por espacios. Es un caso real
 * y no hipotético — el importador nació llamándolo así y devolvía cero filas
 * sobre el archivo correcto (02/09/2026).
 */
const PDF_EN_UNA_SOLA_LINEA =
  "CUIT 20-26402739-0 IMPUESTO VENCIMIENTO Ingresos Brutos - CM03 15/09/2026 " +
  "IVA 18/09/2026 Libro IVA Digital 18/09/2026 Belgrano 2013, Olavarría " +
  "(02284) - 430858 infoestudio@estudio-secondi.com.ar CALENDARIO DE VENCIMIENTOS JOAQUIN NICOLAS";

describe("parseCalendarioSecondi sin saltos de línea", () => {
  it("saca las mismas tres filas aunque el PDF venga todo en un renglón", () => {
    const r = parseCalendarioSecondi(PDF_EN_UNA_SOLA_LINEA);
    expect(r.cuit).toBe("20-26402739-0");
    expect(r.razonSocial).toBe("JOAQUIN NICOLAS");
    expect(r.filas).toEqual([
      { nombre: "Ingresos Brutos - CM03", fechaVencimiento: "2026-09-15" },
      { nombre: "IVA", fechaVencimiento: "2026-09-18" },
      { nombre: "Libro IVA Digital", fechaVencimiento: "2026-09-18" },
    ]);
  });
});

describe("fechaArgentinaAIso", () => {
  it("convierte con y sin cero adelante", () => {
    expect(fechaArgentinaAIso("15/09/2026")).toBe("2026-09-15");
    expect(fechaArgentinaAIso("5/9/2026")).toBe("2026-09-05");
  });

  it("rechaza las que no existen en vez de correrlas al mes siguiente", () => {
    expect(fechaArgentinaAIso("31/09/2026")).toBeNull();
    expect(fechaArgentinaAIso("29/02/2027")).toBeNull();
    expect(fechaArgentinaAIso("15/13/2026")).toBeNull();
    expect(fechaArgentinaAIso("15/09/26")).toBeNull();
  });
});
