"use server";

import { requireSeccion } from "@/lib/auth";
import {
  buildMultiSheetWorkbook,
  type CellValue,
  type ProColumn,
  type ProSection,
} from "@/lib/excel/professional-sheet";
import { getResumenDestinosAction } from "./actions";
import { filasDetalle, filaChofer, fmtFechaExport, siHay, SIN_CHOFER } from "./export-filas";
import { filtrarDestinos, textoFiltros, type FiltrosResumen } from "./filtros";

/**
 * El resumen por destino, en Excel.
 *
 * Los datos se vuelven a leer en el servidor con las mismas fechas y las mismas
 * búsquedas que tiene la pantalla: el cliente manda los filtros, no las filas.
 * Así el archivo no puede traer algo distinto de lo que se estaba mirando, ni
 * quedarse con datos viejos si alguien cargó un viaje en el medio.
 *
 * Van dos hojas porque son dos preguntas distintas: "a quién mandé a cada
 * lugar" (una fila por chofer, con el subtotal del destino) y "cuáles fueron
 * esos viajes" (una fila por viaje, para cruzar contra el remito).
 */

const MONEY_FMT = '"$" #,##0.00';

const COLS_DESTINO: ProColumn[] = [
  { header: "Chofer", width: 30, align: "l" },
  { header: "Camión", width: 13 },
  { header: "Viajes", width: 9, numFmt: "#,##0" },
  { header: "Toneladas", width: 12, numFmt: "#,##0.0" },
  { header: "KM", width: 11, numFmt: "#,##0" },
  { header: "Último viaje", width: 14 },
];

const COLS_VIAJES: ProColumn[] = [
  { header: "Destino", width: 26, align: "l" },
  { header: "Chofer", width: 28, align: "l" },
  { header: "Camión", width: 13 },
  { header: "Fecha", width: 12 },
  { header: "Desde", width: 24, align: "l" },
  { header: "Remito", width: 14 },
  { header: "Material", width: 30, align: "l" },
  { header: "Cliente", width: 26, align: "l" },
  { header: "KM", width: 10, numFmt: "#,##0" },
  { header: "Toneladas", width: 12, numFmt: "#,##0.0" },
  { header: "Importe", width: 16, numFmt: MONEY_FMT },
];

export async function exportarResumenDestinosAction(
  desde: string,
  hasta: string,
  filtros: FiltrosResumen = {},
): Promise<{ filename: string; base64: string } | { error: string }> {
  await requireSeccion("viajes_listado", "read");

  const datos = await getResumenDestinosAction(desde, hasta);
  const destinos = filtrarDestinos(datos.destinos, filtros);

  if (destinos.length === 0) {
    return {
      error: "No hay viajes para exportar en este período con esos filtros.",
    };
  }

  const periodo =
    desde === hasta ? fmtFechaExport(desde) : `${fmtFechaExport(desde)} al ${fmtFechaExport(hasta)}`;
  const fuente = textoFiltros(filtros) ?? undefined;

  // Hoja 1 — un bloque por destino, con su subtotal. Los que no tienen chofer
  // asignado van como una fila más, porque son trabajo que todavía falta dar.
  const secciones: ProSection[] = destinos.map((d) => {
    const rows: CellValue[][] = d.choferes.map(filaChofer);
    if (d.sinChofer > 0) {
      rows.push([SIN_CHOFER, "—", d.sinChofer, null, null, "—"]);
    }
    return {
      label: `${d.destino} — ${d.viajes} viaje${d.viajes !== 1 ? "s" : ""}`,
      rows,
      subtotals: [["TOTAL", null, d.viajes, siHay(d.toneladas), siHay(d.km), null]],
    };
  });

  // Hoja 2 — viaje por viaje, incluidos los que no tienen chofer.
  const filasViajes = filasDetalle(destinos);

  const totalTn = destinos.reduce((s, d) => s + d.toneladas, 0);
  const totalKm = destinos.reduce((s, d) => s + d.km, 0);
  const totalViajes = destinos.reduce((s, d) => s + d.viajes, 0);
  const totalImporte = filasViajes.reduce(
    (s, f) => s + (typeof f[10] === "number" ? f[10] : 0),
    0,
  );

  const buffer = await buildMultiSheetWorkbook([
    {
      name: "Por destino",
      opts: {
        columns: COLS_DESTINO,
        title: "A dónde fueron — resumen por destino",
        subtitle: `${periodo} · ${totalViajes} viajes en ${destinos.length} destinos`,
        fuente,
        sections: secciones,
      },
    },
    {
      name: "Viaje por viaje",
      opts: {
        columns: COLS_VIAJES,
        title: "A dónde fueron — detalle",
        subtitle: `${periodo} · ${filasViajes.length} viajes`,
        fuente,
        rows: filasViajes,
        totals: [
          "TOTAL",
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          siHay(totalKm),
          siHay(totalTn),
          siHay(totalImporte),
        ],
      },
    },
  ]);

  const sufijo = desde === hasta ? desde : `${desde}_${hasta}`;
  return {
    filename: `a_donde_fueron_${sufijo}.xlsx`,
    base64: buffer.toString("base64"),
  };
}
