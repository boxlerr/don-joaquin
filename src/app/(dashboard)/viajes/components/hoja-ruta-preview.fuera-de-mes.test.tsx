import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import HojaRutaPreviewPanel from "./hoja-ruta-preview";
import type {
  HojaRutaPreviewState,
  SheetPreview,
  AsignacionSheet,
} from "../import-hoja-ruta/actions";

// El caso real: la "HOJA DE RUTA JUNIO" del 10/08 trajo 1.397 filas de junio,
// 25 de mayo, 4 de marzo y 1 de febrero. Las 30 de otros meses entran igual —el
// dato del Excel no se toca— pero se guardan con SU fecha, así que después NO
// salen al filtrar junio en la Hoja de ruta mensual. Antes eso no se avisaba en
// ningún lado y la diferencia parecía un import que se comió viajes.

const sheet = (sheetName: string): SheetPreview => ({
  sheetName,
  patentes: [],
  chofer: { status: "ok", id: `c-${sheetName}`, apellido: sheetName, nombre: "Test" },
  total: 1,
  vacios: 0,
  conRemito: 1,
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
});

const preview = (over: Partial<NonNullable<HojaRutaPreviewState>> = {}): HojaRutaPreviewState => ({
  ok: true,
  sheets: [sheet("SALTO MAXIMILIANO"), sheet("SCHMIDT")],
  filasFuturas: [],
  filasFueraDeMes: [
    {
      sheetName: "SALTO MAXIMILIANO",
      fecha: "2026-02-28",
      saleDe: "AÑELO",
      llegaA: "L. NEGRA",
      remito: "VACIO",
      importe: null,
      vacio: true,
    },
    {
      sheetName: "SCHMIDT",
      fecha: "2026-05-29",
      saleDe: "L. NEGRA",
      llegaA: "TIGRE",
      remito: "622584",
      importe: 867993.88,
      vacio: false,
    },
  ],
  summary: {
    totalSheets: 2,
    sheetsOk: 2,
    sheetsConWarning: 0,
    sheetsConError: 0,
    totalViajes: 100,
    totalImportables: 100,
    totalDuplicados: 0,
    totalImporte: 0,
    totalVacios: 1,
    totalPendientesFacturar: 0,
    totalTon: 0,
    totalKm: 0,
    fechaMin: "2026-02-28",
    fechaMax: "2026-06-30",
    mesPrincipal: "2026-06",
    porMes: [
      { mes: "2026-06", viajes: 98 },
      { mes: "2026-05", viajes: 1 },
      { mes: "2026-02", viajes: 1 },
    ],
  },
  warnings: [],
  asignaciones: [],
  choferesDisponibles: [],
  ...over,
});

const asignadas: AsignacionSheet[] = [
  { sheetName: "SALTO MAXIMILIANO", chofer_id: "c-SALTO MAXIMILIANO" },
  { sheetName: "SCHMIDT", chofer_id: "c-SCHMIDT" },
];

function montar(p: HojaRutaPreviewState, asignaciones: AsignacionSheet[]) {
  return render(
    <HojaRutaPreviewPanel
      preview={p!}
      asignaciones={asignaciones}
      onAsignar={vi.fn()}
      omitirFuturas={false}
      onOmitirFuturasChange={vi.fn()}
    />,
  );
}

describe("aviso de filas fuera del mes del archivo", () => {
  it("dice cuántas no son del mes y en qué mes quedan", () => {
    montar(preview(), asignadas);
    expect(screen.getByText(/2 filas no son de junio 2026/i)).toBeTruthy();
    // El reparto concreto, no un número suelto.
    expect(screen.getByText(/1 de mayo 2026, 1 de febrero 2026/i)).toBeTruthy();
  });

  it("avisa la consecuencia: no aparecen al filtrar por el mes del archivo", () => {
    montar(preview(), asignadas);
    expect(screen.getByText(/no van a aparecer al filtrar por junio 2026/i)).toBeTruthy();
  });

  it("«Ver cuáles» abre la lista con la fecha y el mes de destino de cada fila", () => {
    montar(preview(), asignadas);
    fireEvent.click(screen.getByRole("button", { name: /ver cuáles/i }));
    expect(screen.getAllByText("28/02/2026").length).toBeGreaterThan(0);
    expect(screen.getAllByText("29/05/2026").length).toBeGreaterThan(0);
    expect(screen.getAllByText("febrero 2026").length).toBeGreaterThan(0);
    expect(screen.getAllByText("mayo 2026").length).toBeGreaterThan(0);
  });

  it("no cuenta las filas de pestañas que no se van a importar", () => {
    // SCHMIDT sin chofer: su fila de mayo no entra, así que tampoco se avisa.
    montar(preview(), [
      { sheetName: "SALTO MAXIMILIANO", chofer_id: "c-SALTO MAXIMILIANO" },
      { sheetName: "SCHMIDT", chofer_id: null },
    ]);
    expect(screen.getByText(/Una fila no es de junio 2026/i)).toBeTruthy();
  });

  it("sin filas de otro mes no muestra el aviso ni la solapa", () => {
    montar(preview({ filasFueraDeMes: [] }), asignadas);
    expect(screen.queryByText(/no son de junio/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /otro mes/i })).toBeNull();
  });
});
