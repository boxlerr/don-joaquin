import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import {
  parseNominaExcel,
  matchNominaContraRoster,
  mesDesdeNombreArchivo,
  parsePersona,
  type RosterNominaEntry,
} from "./parser-nomina";

function buildXlsx(hojas: Record<string, unknown[][]>): Uint8Array {
  const wb = XLSX.utils.book_new();
  for (const [nombre, aoa] of Object.entries(hojas)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa as (string | number | null)[][]), nombre);
  }
  return new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
}

// Réplica reducida de "IMPORTES SUELDOS JULIO 2026.xlsx": la nómina con el año
// arriba y los embargos repetidos a la derecha, y la hoja de bancos con los
// bloques repartidos en dos pares de columnas (A/B y D/E).
//
// HAIT cobra partido en dos bancos y la suma cierra; DIAZ cobra partido y NO
// cierra; SALTO figura sin importe; PAZ está en un banco pero no en la nómina.
const NOMINA: unknown[][] = [
  ["Año", 2026],
  ["Empleado", "Importe"],
  ["ACOSTA, Pablo Maximo - 148", 4423168.14, null, "JOAQUIN, Alan Alexis - 31", 215952.08],
  ["HAIT, Alejandro German - 38", 1300000, null, "RUCKERT, Carlos David  - 153", 570921.75],
  ["DIAZ, Pablo Ricardo - 14", 900000],
  ["SALTO, Maximiliano Miguel - 138", null],
  ["JOAQUIN, Nicolas - 11", 7500000],
  ["Total por Columnas", 14123168.14, null, null, 786873.83],
];

const BANCOS: unknown[][] = [
  ["BANCO CREDICOOP", null, null, "BANCO FRANCES", null],
  ["ACOSTA, Pablo Maximo - 148", 4423168.14, null, "HAIT, Alejandro German - 38", 500000],
  ["HAIT, Alejandro German - 38", 800000, null, "DIAZ, Pablo Ricardo - 14", 400000],
  [null, 5223168.14, null, null, 900000],
  [null, null, null, null, null],
  ["BANCO GALICIA", null, null, "EMBARGOS", null],
  ["DIAZ, Pablo Ricardo - 14", 450000, null, "JOAQUIN, Alan Alexis - 31", 215952.08],
  ["PAZ, Leonardo - 182", 100000, null, "RUCKERT, Carlos David  - 153", 570921.75],
  [null, 550000, null, null, 786873.83],
  [null, null, null, null, null],
  [null, null, null, "TOTAL SUELDOS", 6673168.14],
  [null, null, null, "SUELDOS + EMBARGOS", 7460041.97],
];

const parsed = () =>
  parseNominaExcel(buildXlsx({ Hoja1: NOMINA, Hoja2: BANCOS }), "IMPORTES SUELDOS JULIO 2026.xlsx");

describe("parseNominaExcel", () => {
  it("lee la nómina completa y el año", () => {
    const r = parsed();
    expect(r.anio).toBe(2026);
    expect(r.nomina).toHaveLength(5);
    expect(r.nomina[0]).toMatchObject({ persona: "ACOSTA, Pablo Maximo", legajo: 148, importe: 4423168.14 });
    expect(r.totales.nominaExcel).toBe(14123168.14);
  });

  it("encuentra los bloques aunque estén en columnas corridas", () => {
    const r = parsed();
    expect(r.bloques.map((b) => b.titulo)).toEqual([
      "BANCO CREDICOOP",
      "BANCO GALICIA",
      "BANCO FRANCES",
      "EMBARGOS",
    ]);
    const credicoop = r.bloques.find((b) => b.titulo === "BANCO CREDICOOP")!;
    expect(credicoop.banco).toBe("CREDICOOP");
    expect(credicoop.esEmbargo).toBe(false);
    expect(credicoop.filas).toHaveLength(2);
    expect(credicoop.totalExcel).toBe(5223168.14);
  });

  it("marca el bloque de embargos y no lo trata como banco", () => {
    const emb = parsed().bloques.find((b) => b.esEmbargo)!;
    expect(emb.banco).toBeNull();
    expect(emb.filas.map((f) => f.persona)).toEqual(["JOAQUIN, Alan Alexis", "RUCKERT, Carlos David"]);
  });

  it("no confunde 'TOTAL SUELDOS' con un bloque más", () => {
    const r = parsed();
    expect(r.totales.sueldosExcel).toBe(6673168.14);
    expect(r.totales.sueldosMasEmbargosExcel).toBe(7460041.97);
    expect(r.bloques.some((b) => b.titulo.startsWith("TOTAL"))).toBe(false);
  });

  it("acepta que una persona cobre en dos bancos si la suma cierra", () => {
    // HAIT: 800.000 en Credicoop + 500.000 en Francés = 1.300.000, igual que la nómina.
    expect(parsed().warnings.filter((w) => w.includes("HAIT"))).toHaveLength(0);
  });

  it("avisa cuando el reparto por bancos no da el importe de la nómina", () => {
    // DIAZ: 450.000 + 400.000 = 850.000 contra 900.000 de la nómina.
    expect(parsed().warnings.some((w) => w.startsWith("DIAZ") && w.includes("850.000"))).toBe(true);
  });

  it("avisa de la fila sin importe y de quien no aparece en ningún banco", () => {
    const w = parsed().warnings;
    expect(w.some((x) => x.includes("SALTO") && x.includes("sin importe"))).toBe(true);
    expect(w.some((x) => x.includes("JOAQUIN, Nicolas") && x.includes("sin banco"))).toBe(true);
  });

  it("avisa de quien está en un banco pero no en la nómina", () => {
    expect(parsed().warnings.some((w) => w.includes("PAZ, Leonardo") && w.includes("no está en la lista"))).toBe(true);
  });

  it("avisa cuando el total de un bloque no coincide con sus filas", () => {
    const roto = BANCOS.map((f) => [...f]);
    roto[3][1] = 999; // total de Credicoop cambiado a mano
    const r = parseNominaExcel(buildXlsx({ Hoja1: NOMINA, Hoja2: roto }), "julio 2026.xlsx");
    expect(r.warnings.some((w) => w.includes("BANCO CREDICOOP") && w.includes("no coincide"))).toBe(true);
  });

  it("junta a cada persona una sola vez, esté en la nómina, en un banco o en un embargo", () => {
    const r = parsed();
    // 5 de la nómina + PAZ (sólo en Galicia) + los 2 del bloque de embargos.
    // Van todas: si a alguien sólo se le retuvo un embargo, igual hay que poder
    // asignarle un legajo en la pantalla.
    expect(r.personas).toHaveLength(8);
    expect(new Set(r.personas.map((p) => p.etiqueta)).size).toBe(8);
    expect(r.personas.filter((p) => p.etiqueta.startsWith("HAIT"))).toHaveLength(1);
  });

  it("devuelve un error entendible si el archivo no es el de la nómina", () => {
    const r = parseNominaExcel(buildXlsx({ Hoja1: [["otra", "cosa"], [1, 2]] }), "x.xlsx");
    expect(r.nomina).toHaveLength(0);
    expect(r.warnings[0]).toContain("Empleado");
  });
});

describe("mesDesdeNombreArchivo", () => {
  it("entiende el nombre que manda Bárbara", () => {
    expect(mesDesdeNombreArchivo("IMPORTES SUELDOS JULIO 2026.xlsx")).toBe("2026-07-01");
    expect(mesDesdeNombreArchivo("importes sueldos diciembre 2025.xlsx")).toBe("2025-12-01");
  });

  it("entiende fechas escritas con números", () => {
    expect(mesDesdeNombreArchivo("nomina 2026-07.xlsx")).toBe("2026-07-01");
    expect(mesDesdeNombreArchivo("nomina 07-2026.xlsx")).toBe("2026-07-01");
  });

  it("usa el año de adentro del Excel cuando el nombre no lo trae", () => {
    expect(mesDesdeNombreArchivo("sueldos julio.xlsx", 2026)).toBe("2026-07-01");
  });

  it("no adivina: el archivo que llega sin mes obliga a elegirlo", () => {
    // WhatsApp reenvía los adjuntos como "Sin título": ahí no hay nada que leer.
    expect(mesDesdeNombreArchivo("Sin título.xlsx", 2026)).toBeNull();
    expect(mesDesdeNombreArchivo("IMPORTES SUELDOS JULIO.xlsx")).toBeNull();
  });
});

describe("parsePersona", () => {
  it("separa el número de legajo del nombre", () => {
    expect(parsePersona("ACOSTA, Pablo Maximo - 148")).toEqual({
      etiqueta: "ACOSTA, Pablo Maximo - 148",
      persona: "ACOSTA, Pablo Maximo",
      legajo: 148,
    });
  });

  it("aguanta los espacios de más y la falta de coma del Excel real", () => {
    expect(parsePersona("RUCKERT, Carlos David  - 153").persona).toBe("RUCKERT, Carlos David");
    expect(parsePersona("ASTEAZARAN Agustin  - 194")).toMatchObject({
      persona: "ASTEAZARAN Agustin",
      legajo: 194,
    });
  });

  it("no inventa legajo cuando el nombre no lo trae", () => {
    expect(parsePersona("PAZ, Leonardo").legajo).toBeNull();
  });
});

describe("matchNominaContraRoster", () => {
  const roster: RosterNominaEntry[] = [
    { id: "a", nombre: "Pablo Maximo", apellido: "Acosta", rol: "chofer", estado: "activo" },
    { id: "b", nombre: "Javier", apellido: "Acosta Fernandez", rol: "chofer", estado: "activo" },
    { id: "c", nombre: "Alejandro German", apellido: "Hait", rol: "administrativo", estado: "activo" },
    { id: "d", nombre: "Jonatan Matías", apellido: "Larrecochea", rol: "chofer", estado: "baja" },
    { id: "e", nombre: "Marcelo Ezequiel", apellido: "Larrecochea", rol: "chofer", estado: "baja" },
  ];
  const match = (etiqueta: string) =>
    matchNominaContraRoster([parsePersona(etiqueta)], roster)[0];

  it("cruza por apellido y nombre, sin acentos", () => {
    expect(match("ACOSTA, Pablo Maximo - 148")).toMatchObject({ choferId: "a", auto: true });
    expect(match("LARRECOCHEA, Jonatan Matias - 186")).toMatchObject({ choferId: "d", auto: true });
  });

  it("separa a dos hermanos del mismo apellido", () => {
    expect(match("LARRECOCHEA, Marcelo Ezequiel - 187").choferId).toBe("e");
  });

  it("no se queda con un apellido parecido si hay uno mejor", () => {
    expect(match("ACOSTA, Pablo Maximo - 148").candidatos[0].id).toBe("a");
  });

  it("deja sin asignar a quien no tiene legajo en el sistema", () => {
    const m = match("JOAQUIN, Nicolas - 11");
    expect(m.choferId).toBeNull();
    expect(m.candidatos).toHaveLength(0);
  });

  it("no auto-asigna cuando dos legajos empatan", () => {
    const gemelos: RosterNominaEntry[] = [
      { id: "x", nombre: "Juan", apellido: "Perez", rol: "chofer", estado: "activo" },
      { id: "y", nombre: "Juan", apellido: "Perez", rol: "chofer", estado: "activo" },
    ];
    const m = matchNominaContraRoster([parsePersona("PEREZ, Juan - 1")], gemelos)[0];
    expect(m.auto).toBe(false);
    expect(m.candidatos).toHaveLength(2);
  });
});
