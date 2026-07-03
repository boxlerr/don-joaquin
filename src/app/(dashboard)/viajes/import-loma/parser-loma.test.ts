import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseLomaXlsx } from "./parser-loma";

// Arma un buffer .xlsx con la hoja "Data" a partir de filas (header incluido),
// con la misma estructura del export real de Loma.
function xlsxDe(rows: unknown[][]): Buffer {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

const HEADER = [
  "Doc.Serv.Flete", "Posición", "Fe.contabil.", "ID Orden Flete", "Nº transporte",
  "Referencia", "Material", "Descripción", "Peso bruto", "UM peso bruto",
  "Peso neto", "UM peso neto", "Ctd.", "UM de cantidad", "Importe", "Moneda",
  "N° de Licencia", "Nombre Chofer", "ID Vehículo", "Placa Remolque 1",
  "Placa Remolque 2", "Placa Remolque 3", "In.act.transp.", "Hr.ac.in.trans.",
  "Fin.act.transp.", "HrActFinTransp", "Expedidor", "", "Dir.ubicación origen",
  "Destinatario", "", "Direc.ubic.destino", "Distancia Etapa", "Distancia total",
];

function fila(over: Record<string, unknown> = {}): unknown[] {
  const base: Record<string, unknown> = {
    "Doc.Serv.Flete": "4500021560",
    "Posición": "00010",
    "Fe.contabil.": "2026-06-22 00:00:00",
    "ID Orden Flete": "6100035050",
    "Nº transporte": "210032306",
    "Referencia": "0730R00294353",
    "Material": "1317",
    "Descripción": "ARENA AGRE GRANIT 0-6",
    "Peso bruto": "35,16",
    "UM peso bruto": "T",
    "Peso neto": "35.160",
    "UM peso neto": "KG",
    "Importe": 781902.5, // en el export real viene como número, no como texto
    "Moneda": "ARS",
    "Nombre Chofer": "ASTEAZARAN, AGUSTIN",
    "ID Vehículo": "AF696CR",
    "In.act.transp.": "2026-04-23 00:00:00",
    "Fin.act.transp.": "2026-05-02 00:00:00",
    "Expedidor": "A702",
    "Destinatario": "4002631",
    "Distancia total": 396,
    ...over,
  };
  return HEADER.map((h, i) => {
    // Las columnas sin header (nombre de expedidor/destinatario) van por índice.
    if (h === "" && HEADER[i - 1] === "Expedidor") return over["__expNombre"] ?? "CANTERA LA PREFERIDA";
    if (h === "" && HEADER[i - 1] === "Destinatario") return over["__destNombre"] ?? "RUTA9 KM 70";
    return base[h] ?? null;
  });
}

describe("parseLomaXlsx — tonelaje por Peso bruto", () => {
  it("toma el Peso bruto (tn descargadas), no el Peso neto", () => {
    const buf = xlsxDe([HEADER, fila({ "Peso bruto": "36,576", "UM peso bruto": "T", "Peso neto": "36", "UM peso neto": "T" })]);
    const { rows } = parseLomaXlsx(buf);
    expect(rows).toHaveLength(1);
    expect(rows[0].tonelaje).toBe(36.58); // bruto redondeado a 2 decimales
  });

  it("normaliza KG → toneladas cuando la UM del bruto es KG", () => {
    const buf = xlsxDe([HEADER, fila({ "Peso bruto": "35.160", "UM peso bruto": "KG" })]);
    const { rows } = parseLomaXlsx(buf);
    expect(rows[0].tonelaje).toBe(35.16);
  });

  it("cae al Peso neto si el export no trae la columna Peso bruto", () => {
    const headerSinBruto = HEADER.filter((h) => h !== "Peso bruto" && h !== "UM peso bruto");
    const filaCompleta = fila({ "Peso neto": "34,5", "UM peso neto": "T" });
    const idxs = HEADER.map((h, i) => (h === "Peso bruto" || h === "UM peso bruto" ? i : -1)).filter((i) => i >= 0);
    const filaSinBruto = filaCompleta.filter((_, i) => !idxs.includes(i));
    const buf = xlsxDe([headerSinBruto, filaSinBruto]);
    const { rows } = parseLomaXlsx(buf);
    expect(rows[0].tonelaje).toBe(34.5);
  });
});

describe("parseLomaXlsx — fechas", () => {
  it("usa In.act.transp. como fecha del viaje", () => {
    const buf = xlsxDe([HEADER, fila()]);
    const { rows } = parseLomaXlsx(buf);
    expect(rows[0].fecha).toBe("2026-04-23");
    expect(rows[0].fechaFin).toBe("2026-05-02");
  });

  it("descarta los años basura del SAP de Loma (ej. 2202) en Fin.act.transp.", () => {
    const buf = xlsxDe([HEADER, fila({ "Fin.act.transp.": "2202-06-22 00:00:00" })]);
    const { rows } = parseLomaXlsx(buf);
    expect(rows[0].fecha).toBe("2026-04-23");
    expect(rows[0].fechaFin).toBeNull();
  });
});

describe("parseLomaXlsx — datos del flete para completar el viaje", () => {
  it("trae remito (Referencia), material (Descripción) e importe", () => {
    const buf = xlsxDe([HEADER, fila()]);
    const { rows } = parseLomaXlsx(buf);
    expect(rows[0].remito).toBe("0730R00294353");
    expect(rows[0].material).toBe("ARENA AGRE GRANIT 0-6");
    expect(rows[0].importe).toBe(781902.5);
    expect(rows[0].nroTransporte).toBe("210032306");
  });
});
