import { describe, it, expect } from "vitest";
import {
  OMITIR_SHEET,
  choferRealDe,
  contarImportables,
  sheetsSinChofer,
  sheetsMissingSinResolver,
} from "./hoja-ruta-preview";
import type { SheetPreview } from "../import-hoja-ruta/actions";
import type { AsignacionSheet } from "../import-hoja-ruta/actions";

// Estas cuentas son las que habilitan el botón de confirmar y las que dicen
// cuántos viajes se van a crear. Un error acá se paga con viajes de menos (o con
// un import bloqueado sin motivo visible).

const sheet = (over: Partial<SheetPreview> & { sheetName: string }): SheetPreview => ({
  patentes: [],
  chofer: { status: "ok", id: "c1", apellido: "Salto", nombre: "Maxi" },
  total: 10,
  vacios: 0,
  conRemito: 10,
  pendientesFacturar: 0,
  yaImportados: 0,
  viasRuta5: 0,
  viasRuta22: 0,
  sumaImporte: 0,
  sumaTon: 0,
  sumaKm: 0,
  sumaKmVacios: 0,
  warnings: [],
  viajes: [],
  ...over,
});

describe("choferRealDe", () => {
  it("omitir no es un chofer: la pestaña no importa nada", () => {
    const asign: AsignacionSheet[] = [{ sheetName: "A", chofer_id: OMITIR_SHEET }];
    expect(choferRealDe(asign, "A")).toBeNull();
  });

  it("sin decisión tampoco", () => {
    expect(choferRealDe([{ sheetName: "A", chofer_id: null }], "A")).toBeNull();
  });

  it("con chofer asignado devuelve su id", () => {
    expect(choferRealDe([{ sheetName: "A", chofer_id: "c9" }], "A")).toBe("c9");
  });
});

describe("contarImportables", () => {
  it("descuenta los duplicados de cada pestaña", () => {
    const sheets = [sheet({ sheetName: "A", total: 10, yaImportados: 3 })];
    expect(contarImportables(sheets, [{ sheetName: "A", chofer_id: "c1" }])).toBe(7);
  });

  it("una pestaña omitida no aporta ninguno", () => {
    const sheets = [
      sheet({ sheetName: "A", total: 10, yaImportados: 3 }),
      sheet({ sheetName: "B", total: 5 }),
    ];
    const asign: AsignacionSheet[] = [
      { sheetName: "A", chofer_id: "c1" },
      { sheetName: "B", chofer_id: OMITIR_SHEET },
    ];
    expect(contarImportables(sheets, asign)).toBe(7);
  });

  it("una pestaña donde TODO está duplicado no aporta ninguno", () => {
    const sheets = [sheet({ sheetName: "A", total: 4, yaImportados: 4 })];
    expect(contarImportables(sheets, [{ sheetName: "A", chofer_id: "c1" }])).toBe(0);
  });
});

describe("sheetsSinChofer", () => {
  it("cuenta las omitidas y las que no tienen decisión", () => {
    const sheets = [sheet({ sheetName: "A" }), sheet({ sheetName: "B" }), sheet({ sheetName: "C" })];
    const asign: AsignacionSheet[] = [
      { sheetName: "A", chofer_id: "c1" },
      { sheetName: "B", chofer_id: OMITIR_SHEET },
      { sheetName: "C", chofer_id: null },
    ];
    expect(sheetsSinChofer(sheets, asign).map((s) => s.sheetName)).toEqual(["B", "C"]);
  });
});

describe("sheetsMissingSinResolver", () => {
  const missing = (name: string) =>
    sheet({ sheetName: name, chofer: { status: "missing", sheetName: name } });

  it("una pestaña sin legajo y sin decisión bloquea (caso «Goiti»)", () => {
    const sheets = [missing("GOITI")];
    expect(sheetsMissingSinResolver(sheets, [{ sheetName: "GOITI", chofer_id: null }])).toHaveLength(1);
  });

  it("resuelta como «omitir» ya no bloquea", () => {
    const sheets = [missing("GOITI")];
    const asign: AsignacionSheet[] = [{ sheetName: "GOITI", chofer_id: OMITIR_SHEET }];
    expect(sheetsMissingSinResolver(sheets, asign)).toHaveLength(0);
  });

  it("resuelta asignándole un chofer existente tampoco bloquea", () => {
    const sheets = [missing("GOITI")];
    expect(sheetsMissingSinResolver(sheets, [{ sheetName: "GOITI", chofer_id: "c7" }])).toHaveLength(0);
  });

  it("una pestaña ambigua sin resolver NO bloquea (se puede importar sin ella)", () => {
    const sheets = [
      sheet({ sheetName: "CEJAS", chofer: { status: "ambiguo", candidatos: [] } }),
    ];
    expect(sheetsMissingSinResolver(sheets, [{ sheetName: "CEJAS", chofer_id: null }])).toHaveLength(0);
  });
});
