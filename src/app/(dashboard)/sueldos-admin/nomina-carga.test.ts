import { describe, it, expect } from "vitest";
import { armarCargaNomina } from "./nomina-carga";
import type { NominaParseResult } from "./parser-nomina";

const MES = "2026-07-01";

/** Sólo los campos que mira `armarCargaNomina`; el resto no interviene. */
function parseado(
  nomina: { etiqueta: string; importe: number | null }[],
  bloques: {
    banco: string | null;
    esEmbargo?: boolean;
    filas: { etiqueta: string; importe: number }[];
  }[],
): NominaParseResult {
  return {
    mesSugerido: MES,
    anio: 2026,
    nomina: nomina.map((f, i) => ({
      etiqueta: f.etiqueta,
      persona: f.etiqueta,
      legajo: null,
      rowNum: i + 3,
      importe: f.importe,
    })),
    bloques: bloques.map((b) => ({
      titulo: b.esEmbargo ? "EMBARGOS" : `BANCO ${b.banco}`,
      banco: b.banco,
      esEmbargo: !!b.esEmbargo,
      totalExcel: null,
      filas: b.filas.map((f, i) => ({
        etiqueta: f.etiqueta,
        persona: f.etiqueta,
        legajo: null,
        rowNum: i + 2,
        importe: f.importe,
      })),
    })),
    totales: { nominaExcel: null, sueldosExcel: null, sueldosMasEmbargosExcel: null },
    personas: [],
    warnings: [],
  };
}

/** Los bancos ya vienen escritos como el sistema los escribe. */
const canon = (b: string) => b;

function armar(
  parsed: NominaParseResult,
  opts: Partial<Parameters<typeof armarCargaNomina>[0]> = {},
) {
  return armarCargaNomina({
    parsed,
    mes: MES,
    asignaciones: {},
    bancosPorChofer: new Map(),
    canon,
    usuarioId: "u1",
    completarBancos: true,
    ...opts,
  });
}

describe("armarCargaNomina", () => {
  it("carga un pago por banco y completa el legajo vacío", () => {
    const parsed = parseado(
      [{ etiqueta: "ACOSTA - 1", importe: 100 }],
      [{ banco: "Provincia", filas: [{ etiqueta: "ACOSTA - 1", importe: 100 }] }],
    );
    const r = armar(parsed, { asignaciones: { "ACOSTA - 1": "c1" } });

    expect(r.pagos).toEqual([
      { chofer_id: "c1", mes: MES, concepto: "sueldo", banco: "Provincia", importe: 100, orden: 0, created_by: "u1" },
    ]);
    expect(r.cuentas).toEqual([
      expect.objectContaining({ chofer_id: "c1", banco: "Provincia", principal: true, orden: 0 }),
    ]);
    expect(r.omitidos).toHaveLength(0);
  });

  it("reparte a quien cobra en tres bancos y deja principal el más grande", () => {
    const parsed = parseado(
      [{ etiqueta: "HAIT - 38", importe: 2088 }],
      [
        { banco: "Credicoop", filas: [{ etiqueta: "HAIT - 38", importe: 788 }] },
        { banco: "Galicia", filas: [{ etiqueta: "HAIT - 38", importe: 800 }] },
        { banco: "Francés", filas: [{ etiqueta: "HAIT - 38", importe: 500 }] },
      ],
    );
    const r = armar(parsed, { asignaciones: { "HAIT - 38": "c1" } });

    expect(r.pagos).toHaveLength(3);
    expect(r.pagos.reduce((s, p) => s + p.importe, 0)).toBe(2088);
    // Galicia es el importe mayor: va primera y es la que se espeja en el legajo.
    expect(r.cuentas.map((c) => [c.banco, c.principal, c.orden])).toEqual([
      ["Galicia", true, 0],
      ["Credicoop", false, 1],
      ["Francés", false, 2],
    ]);
  });

  it("carga sin banco a quien está en la nómina y en ningún banco", () => {
    // Si no entrara, el total cargado no daría el del Excel y nadie sabría por qué.
    const parsed = parseado([{ etiqueta: "JOAQUIN - 11", importe: 7500 }], []);
    const r = armar(parsed, { asignaciones: { "JOAQUIN - 11": "c9" } });

    expect(r.pagos).toEqual([
      expect.objectContaining({ chofer_id: "c9", concepto: "sueldo", banco: null, importe: 7500 }),
    ]);
    expect(r.cuentas).toHaveLength(0);
  });

  it("omite a quien no tiene legajo, sin cargarle nada", () => {
    const parsed = parseado(
      [{ etiqueta: "SIN LEGAJO - 4", importe: 2470 }],
      [{ banco: "Francés", filas: [{ etiqueta: "SIN LEGAJO - 4", importe: 2470 }] }],
    );
    const r = armar(parsed, { asignaciones: {} });

    expect(r.pagos).toHaveLength(0);
    expect(r.cuentas).toHaveLength(0);
    expect(r.omitidos).toEqual([{ etiqueta: "SIN LEGAJO - 4", importe: 2470 }]);
  });

  it("no carga nada de la fila que viene sin importe, pero tampoco la da por omitida", () => {
    const parsed = parseado([{ etiqueta: "SALTO - 138", importe: null }], []);
    const r = armar(parsed, { asignaciones: { "SALTO - 138": "c5" } });

    expect(r.pagos).toHaveLength(0);
    expect(r.omitidos).toHaveLength(0);
  });

  it("guarda los embargos aparte del sueldo y admite dos de la misma persona", () => {
    const parsed = parseado(
      [{ etiqueta: "ALAN - 31", importe: 1727 }],
      [
        { banco: "Nación", filas: [{ etiqueta: "ALAN - 31", importe: 1727 }] },
        {
          banco: null,
          esEmbargo: true,
          filas: [
            { etiqueta: "ALAN - 31", importe: 215 },
            { etiqueta: "ALAN - 31", importe: 287 },
          ],
        },
      ],
    );
    const r = armar(parsed, { asignaciones: { "ALAN - 31": "c1" } });

    const embargos = r.pagos.filter((p) => p.concepto === "embargo");
    expect(embargos).toHaveLength(2);
    expect(embargos.every((e) => e.banco === null)).toBe(true);
    // El sueldo no incluye el embargo: el Excel los suma por separado.
    expect(r.pagos.filter((p) => p.concepto === "sueldo")[0].importe).toBe(1727);
    // El embargo no aporta ninguna cuenta: la única que se crea es la del banco
    // por el que cobra ("EMBARGOS" no es un banco).
    expect(r.cuentas.map((c) => c.banco)).toEqual(["Nación"]);
  });

  it("no repite un banco que el legajo ya tenía", () => {
    const parsed = parseado(
      [{ etiqueta: "ROSSI - 29", importe: 100 }],
      [{ banco: "Credicoop", filas: [{ etiqueta: "ROSSI - 29", importe: 100 }] }],
    );
    const r = armar(parsed, {
      asignaciones: { "ROSSI - 29": "c1" },
      bancosPorChofer: new Map([["c1", ["Credicoop"]]]),
    });

    expect(r.cuentas).toHaveLength(0);
    expect(r.bancosSinConfirmar).toHaveLength(0);
  });

  it("agrega el banco nuevo sin tocar el que ya estaba marcado como principal", () => {
    // Caso real de julio: el legajo de DE LIBANO decía Santander y el Excel lo
    // trae en Provincia. Se cargan los dos y se avisa; nadie decide por él.
    const parsed = parseado(
      [{ etiqueta: "DE LIBANO - 174", importe: 3911 }],
      [{ banco: "Provincia", filas: [{ etiqueta: "DE LIBANO - 174", importe: 3911 }] }],
    );
    const r = armar(parsed, {
      asignaciones: { "DE LIBANO - 174": "c1" },
      bancosPorChofer: new Map([["c1", ["Santander"]]]),
    });

    expect(r.cuentas).toEqual([
      expect.objectContaining({ banco: "Provincia", principal: false }),
    ]);
    expect(r.bancosSinConfirmar).toEqual([{ choferId: "c1", banco: "Santander" }]);
  });

  it("no toca los legajos cuando se pide no completarlos", () => {
    const parsed = parseado(
      [{ etiqueta: "ACOSTA - 1", importe: 100 }],
      [{ banco: "Provincia", filas: [{ etiqueta: "ACOSTA - 1", importe: 100 }] }],
    );
    const r = armar(parsed, { asignaciones: { "ACOSTA - 1": "c1" }, completarBancos: false });

    expect(r.pagos).toHaveLength(1);
    expect(r.cuentas).toHaveLength(0);
    expect(r.bancosSinConfirmar).toHaveLength(0);
  });

  it("no repite la cuenta si el Excel nombra dos veces el mismo banco", () => {
    // Una clave repetida haría fallar el insert entero, no sólo esa fila.
    const parsed = parseado(
      [{ etiqueta: "ACOSTA - 1", importe: 300 }],
      [
        { banco: "Provincia", filas: [{ etiqueta: "ACOSTA - 1", importe: 100 }] },
        { banco: "Provincia", filas: [{ etiqueta: "ACOSTA - 1", importe: 200 }] },
      ],
    );
    const r = armar(parsed, { asignaciones: { "ACOSTA - 1": "c1" } });

    expect(r.pagos).toHaveLength(2); // los dos importes se cargan
    expect(r.cuentas).toHaveLength(1); // pero es un solo banco
  });
});
