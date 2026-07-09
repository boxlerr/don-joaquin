import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseSueldosExcel, matchNombresContraRoster, type RosterEntry } from "./parser-sueldos";

// Serial de Excel para una fecha (días desde 1899-12-30).
function serial(y: number, m: number, d: number): number {
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000);
}

function buildXlsx(aoa: unknown[][]): Uint8Array {
  const ws = XLSX.utils.aoa_to_sheet(aoa as (string | number | null)[][]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Hoja1");
  return new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
}

// Réplica de la estructura real de "sueldos interanual.xlsx": bloques por mes,
// fecha que no cae el día 1, comisión con nombre viejo y nuevo, tabla suelta
// de porcentajes en el medio y fila de total sin nombre al pie.
const FIXTURE: unknown[][] = [
  [null, serial(2025, 6, 3), "FACTURACION", "SUELDO", "PORCENTAJE", null, null],
  [null, null, 1153842365.27, 4497227.98, 3.87, null, null],
  [null, null, null, null, null, null, null],
  [null, "SUELDO", "COMISION FLETEROS", "COMBUSTIBLE", "PLUS YPF", "SABADOS", "TOTAL"],
  ["PABLO", 2306585.16, 78015, 50000, 369629.82, 68712, 2872941.98],
  ["DARIO", 1857000, null, null, null, null, 1857000],
  ["MARCOS", null, null, null, 7000000, null, 7000000],
  [null, null, null, null, null, null, 11729941.98],
  [null, null, null, null, null, null, null],
  // Tabla suelta que NO es un bloque (se debe ignorar).
  [null, "PROMEDIO ANUAL DEL % DE SUELDO SOBRE FACTURACION", null, null, null, null, null],
  [null, "ENERO", 5.09, 1.1, 6.168, null, null],
  [null, "FEBRERO", 5.73, 1.2, 4.512, null, null],
  [null, null, null, null, null, null, null],
  // Bloque nuevo: header de comisión renombrado + columna AGUINALDO.
  [null, serial(2026, 3, 1), "FACTURACION", "SUELDO", "PORCENTAJE", null, null],
  [null, null, 1230718689.51, 6000000, 4.33, null, null],
  [null, "SUELDO", "COMISION LOGISTICA", "COMBUSTIBLE", "PLUS YPF", "SABADOS", "AGUINALDO", "TOTAL"],
  ["PABLO", 2966378.64, null, 50000, 373965.89, 137424, 100000, 3627768.53],
  // TOTAL que no cierra → warning.
  ["DARIO", 2298342.5, null, 290617, null, 1020000, null, 9999999],
  [null, null, null, null, null, null, null, 13627767.53],
];

describe("parseSueldosExcel", () => {
  const result = parseSueldosExcel(buildXlsx(FIXTURE));

  it("detecta los bloques por mes y normaliza la fecha al día 1", () => {
    expect(result.bloques.map((b) => b.mes)).toEqual(["2025-06-01", "2026-03-01"]);
  });

  it("lee la facturación de cada bloque", () => {
    expect(result.bloques[0].facturacion).toBeCloseTo(1153842365.27);
    expect(result.bloques[1].facturacion).toBeCloseTo(1230718689.51);
  });

  it("lee las filas con sus variables (comisión vieja y nueva)", () => {
    const jun = result.bloques[0];
    expect(jun.filas).toHaveLength(3);
    const pablo = jun.filas[0];
    expect(pablo).toMatchObject({
      nombre: "PABLO",
      sueldoBase: 2306585.16,
      comision: 78015,
      combustible: 50000,
      plusYpf: 369629.82,
      sabados: 68712,
      aguinaldo: 0,
    });
    const mar = result.bloques[1];
    expect(mar.filas[0].aguinaldo).toBe(100000);
    expect(mar.filas[0].combustible).toBe(50000);
  });

  it("tolera sueldo vacío (MARCOS oct-2025 style)", () => {
    const marcos = result.bloques[0].filas[2];
    expect(marcos.sueldoBase).toBeNull();
    expect(marcos.plusYpf).toBe(7000000);
  });

  it("ignora la tabla suelta de porcentajes y la fila de total", () => {
    expect(result.nombres).toEqual(["PABLO", "DARIO", "MARCOS"]);
  });

  it("avisa cuando la suma no coincide con el TOTAL del Excel", () => {
    expect(result.warnings.some((w) => w.includes("DARIO") && w.includes("no coincide"))).toBe(true);
    // La fila de PABLO cierra bien → un solo warning de suma.
    expect(result.warnings.filter((w) => w.includes("no coincide"))).toHaveLength(1);
  });
});

describe("parseSueldosExcel — fechas y filas raras", () => {
  it("acepta fecha en texto dd/mm/yyyy y mes ISO de un dígito", () => {
    const res = parseSueldosExcel(
      buildXlsx([
        [null, "01/06/2025", "FACTURACION", "SUELDO", "PORCENTAJE"],
        [null, null, 1000, 500, 50],
        [null, "SUELDO", "COMISION LOGISTICA", "COMBUSTIBLE", "PLUS YPF", "SABADOS", "TOTAL"],
        ["ANA", 500, null, null, null, null, 500],
        [null, null, null, null, null, null, 500],
        [null, "2025-7", "FACTURACION", "SUELDO", "PORCENTAJE"],
        [null, null, 2000, 600, 30],
        [null, "SUELDO", "COMISION LOGISTICA", "COMBUSTIBLE", "PLUS YPF", "SABADOS", "TOTAL"],
        ["ANA", 600, null, null, null, null, 600],
      ]),
    );
    expect(res.bloques.map((b) => b.mes)).toEqual(["2025-06-01", "2025-07-01"]);
  });

  it("avisa (no descarta en silencio) cuando la fecha del bloque es ilegible", () => {
    const res = parseSueldosExcel(
      buildXlsx([
        [null, "junio veinticinco", "FACTURACION", "SUELDO", "PORCENTAJE"],
        [null, null, 1000, 500, 50],
        [null, "SUELDO", "COMISION LOGISTICA", "COMBUSTIBLE", "PLUS YPF", "SABADOS", "TOTAL"],
        ["ANA", 500, null, null, null, null, 500],
      ]),
    );
    expect(res.bloques).toHaveLength(0);
    expect(res.warnings.some((w) => w.includes("fecha ilegible"))).toBe(true);
  });

  it("avisa cuando un nombre aparece dos veces en el mismo mes", () => {
    const res = parseSueldosExcel(
      buildXlsx([
        [null, serial(2025, 6, 1), "FACTURACION", "SUELDO", "PORCENTAJE"],
        [null, null, 1000, 1000, 100],
        [null, "SUELDO", "COMISION LOGISTICA", "COMBUSTIBLE", "PLUS YPF", "SABADOS", "TOTAL"],
        ["ANA", 500, null, null, null, null, 500],
        ["ANA", 500, null, null, null, null, 500],
      ]),
    );
    expect(res.warnings.some((w) => w.includes('"ANA"') && w.includes("más de una vez"))).toBe(true);
  });
});

describe("matchNombresContraRoster", () => {
  const roster: RosterEntry[] = [
    { id: "pablo", nombre: "Pablo Ricardo", apellido: "Gómez", rol: "administrativo" },
    { id: "noe", nombre: "Noelia Isabel", apellido: "Muzzio", rol: "administrativo" },
    { id: "jere", nombre: "Jeremias", apellido: "Pérez", rol: "administrativo" },
    { id: "jony", nombre: "Jonatan", apellido: "López", rol: "mantenimiento" },
    { id: "trejo", nombre: "Juan Carlos", apellido: "Trejo", rol: "mantenimiento" },
    { id: "anabela", nombre: "Anabela", apellido: "Suárez", rol: "administrativo" },
    { id: "ale", nombre: "Alejandro German", apellido: "Ruiz", rol: "administrativo" },
    { id: "alan", nombre: "Alan Alexis", apellido: "Díaz", rol: "mantenimiento" },
    { id: "jose-chofer", nombre: "José Luis", apellido: "Fernandez", rol: "chofer" },
    { id: "juan-chofer", nombre: "Juan", apellido: "Pérez", rol: "chofer" },
  ];

  const matches = matchNombresContraRoster(
    ["PABLO", "NOE", "JERE", "JONY", "TREJO", "ANABELLA", "JOSE", "ZZZZZ", "ALE", "ALAN"],
    roster,
  );
  const byName = Object.fromEntries(matches.map((m) => [m.nombreExcel, m]));

  it("matchea exacto, por prefijo (apodos) y por apellido", () => {
    expect(byName.PABLO).toMatchObject({ choferId: "pablo", auto: true });
    expect(byName.NOE).toMatchObject({ choferId: "noe", auto: true });
    expect(byName.JERE).toMatchObject({ choferId: "jere", auto: true });
    expect(byName.TREJO).toMatchObject({ choferId: "trejo", auto: true });
  });

  it("matchea apodos con prefijo común (JONY → JONATAN) y typos (ANABELLA → ANABELA)", () => {
    expect(byName.JONY).toMatchObject({ choferId: "jony", auto: true });
    expect(byName.ANABELLA).toMatchObject({ choferId: "anabela", auto: true });
  });

  it("NO auto-asigna cuando el único candidato es un chofer: queda como sugerencia", () => {
    expect(byName.JOSE).toMatchObject({ choferId: null, auto: false, sugeridoId: "jose-chofer" });
  });

  it("sin candidatos → sin match ni sugerencia", () => {
    expect(byName.ZZZZZ).toMatchObject({ choferId: null, auto: false, sugeridoId: null });
  });

  it("desempata por primer nombre: ALE → ALEjandro (no Alan ALExis), ALAN exacto", () => {
    expect(byName.ALE).toMatchObject({ choferId: "ale", auto: true });
    expect(byName.ALAN).toMatchObject({ choferId: "alan", auto: true });
  });
});
