import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import VacacionesClient, { agruparMeses } from "./VacacionesClient";
import type { VacacionesSaldoChofer, VacacionesPeriodo } from "./lib";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("../[slug]/actions", () => ({
  guardarSaldoVacacionesAction: vi.fn(async () => ({ success: true })),
  cancelarAusenciaAction: vi.fn(async () => ({ success: true })),
  crearAusenciaAction: vi.fn(async () => ({ success: true })),
  editarAusenciaAction: vi.fn(async () => ({ success: true })),
  getViajesChoferEnRangoAction: vi.fn(async () => []),
}));
vi.mock("./actions", () => ({
  recalcularDiasPorAntiguedadAction: vi.fn(async () => ({ success: true, actualizados: 0 })),
}));

// Fechas relativas a hoy para que el período caiga en la ventana visible.
const iso = (d: Date) => d.toISOString().slice(0, 10);
const hoy = new Date();
const finPeriodoY = hoy.getFullYear();
const en3dias = new Date(hoy.getTime() + 3 * 86_400_000);

function saldo(overrides: Partial<VacacionesSaldoChofer>): VacacionesSaldoChofer {
  return {
    chofer_id: "c1",
    nombre: "Gaston",
    apellido: "Saenz Buruaga",
    sector: "Chofer",
    fecha_ingreso: "2015-09-01",
    anios: 11,
    hito: "★ ≥10 años",
    corresponden: 28,
    adeudados: 7,
    total: 35,
    tomados: 14,
    disponibles: 35,
    saldos_anio: [
      { anio: finPeriodoY - 1, otorgados: 28, usados: 21, saldo: 7, observaciones: null },
      { anio: finPeriodoY, otorgados: 28, usados: 0, saldo: 28, observaciones: null },
    ],
    dias_segun_antiguedad: 28,
    desfasaje: false,
    vence_saldo: `31/12/${finPeriodoY}`,
    vence_periodo: `Oct ${finPeriodoY + 1}`,
    proximo_hito: "37 meses → 20 años",
    semaforo: "🔴",
    en_vacaciones_ahora: false,
    ...overrides,
  };
}

const saldos: VacacionesSaldoChofer[] = [
  saldo({}),
  saldo({
    chofer_id: "c2",
    nombre: "Jonatan",
    apellido: "Heim",
    sector: "Taller",
    adeudados: 0,
    semaforo: "🟢",
    vence_saldo: null,
    en_vacaciones_ahora: true,
  }),
];

const periodos: VacacionesPeriodo[] = [
  {
    id: "p1",
    chofer_id: "c1",
    nombre: "Gaston",
    apellido: "Saenz Buruaga",
    fecha_inicio: iso(hoy),
    fecha_fin: iso(en3dias),
    dias: 4,
    estado: "autorizada",
    observaciones: null,
    anio_cargo: finPeriodoY - 1,
    en_curso: true,
  },
];

describe("VacacionesClient", () => {
  it("renderiza KPIs, cronograma con barra proporcional y períodos con año de cargo", () => {
    render(<VacacionesClient saldos={saldos} periodos={periodos} finPeriodoY={finPeriodoY} canWrite />);

    // KPIs
    expect(screen.getByText(`Con saldo ${finPeriodoY - 1} por vencer`)).toBeInTheDocument();
    expect(screen.getByText("De vacaciones ahora")).toBeInTheDocument();

    // Buscadores: el del cronograma (empleado) + el de la tabla de saldos.
    // La toolbar de arriba ya no tiene buscador (era redundante).
    expect(screen.getByPlaceholderText("Buscar empleado…")).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText("Buscar…").length).toBeGreaterThanOrEqual(1);

    // Cronograma: fila del empleado con botón que salta a la tabla
    const filaCrono = screen.getAllByTitle("Ver su saldo en la tabla de abajo");
    expect(filaCrono.length).toBeGreaterThanOrEqual(1);

    // Toggles de las dos listas nuevas.
    expect(screen.getByText("Tarjetas")).toBeInTheDocument();
    expect(screen.getByText("Por año")).toBeInTheDocument();
    expect(screen.getByText("Timeline")).toBeInTheDocument();
    expect(screen.getByText("Lista")).toBeInTheDocument();

    // Período (vista timeline por defecto): badge con días + año que descuenta.
    expect(screen.getByText(`4d · ${finPeriodoY - 1}`)).toBeInTheDocument();

    // Tarjetas (vista por defecto): pill "Vence 31/12" para quien tiene saldo viejo.
    expect(screen.getAllByText(new RegExp(`31/12/${finPeriodoY}`)).length).toBeGreaterThanOrEqual(1);

    // Subtotales por sector en el encabezado del grupo (tarjetas).
    expect(screen.getByText(/Choferes · 1/)).toBeInTheDocument();
    expect(screen.getByText(/Taller · 1/)).toBeInTheDocument();
  });

  it("la vista Resumen muestra la columna Vence con saldo y período", () => {
    render(<VacacionesClient saldos={saldos} periodos={periodos} finPeriodoY={finPeriodoY} canWrite />);
    fireEvent.click(screen.getByText("Resumen"));
    expect(screen.getAllByText(`31/12/${finPeriodoY}`).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(`per. ${finPeriodoY}: Oct ${finPeriodoY + 1}`).length).toBeGreaterThanOrEqual(1);
  });

  it("clic en un período abre el detalle con acciones", () => {
    render(<VacacionesClient saldos={saldos} periodos={periodos} finPeriodoY={finPeriodoY} canWrite />);
    const barra = screen.getAllByTitle(/clic: detalle/)[0]!;
    fireEvent.click(barra);
    expect(screen.getByText("Ver saldo en la tabla")).toBeInTheDocument();
    expect(screen.getByText("Abrir legajo")).toBeInTheDocument();
    expect(screen.getByText("Quitar")).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`descuenta del saldo ${finPeriodoY - 1}`))).toBeInTheDocument();
  });

  it("la vista Por año muestra saldo/otorgados de cada año como la planilla", () => {
    render(<VacacionesClient saldos={saldos} periodos={periodos} finPeriodoY={finPeriodoY} canWrite />);
    fireEvent.click(screen.getByText("Por año"));
    expect(screen.getByText(`Saldo ${finPeriodoY - 1}`)).toBeInTheDocument();
    expect(screen.getByText(`Saldo ${finPeriodoY}`)).toBeInTheDocument();
    // Saenz: 7 de 28 del año pasado y 28/28 del actual
    expect(screen.getAllByText("/28").length).toBeGreaterThanOrEqual(2);
  });

  it("el buscador filtra las filas de la tabla", () => {
    render(<VacacionesClient saldos={saldos} periodos={periodos} finPeriodoY={finPeriodoY} canWrite />);
    fireEvent.change(screen.getByPlaceholderText("Buscar empleado…"), { target: { value: "heim" } });
    expect(screen.getAllByText(/Heim, Jonatan/).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/Saenz Buruaga, Gaston/)).not.toBeInTheDocument();
  });
});

describe("agruparMeses (banda de meses del cronograma)", () => {
  const semanas = (starts: string[]) => starts.map((start) => ({ start }));

  it("agrupa semanas consecutivas por mes y los colSpan suman el total", () => {
    // 5 semanas: 2 de julio, 2 de agosto, 1 de septiembre
    const { grupos, iniciosMes } = agruparMeses(
      semanas(["2026-07-20", "2026-07-27", "2026-08-03", "2026-08-10", "2026-08-31"]),
    );
    expect(grupos.map((g) => g.span)).toEqual([2, 3]); // jul x2, ago+ago+ago(31 sigue siendo agosto)
    expect(grupos.reduce((a, g) => a + g.span, 0)).toBe(5);
    expect([...iniciosMes]).toEqual([0, 2]);
    expect(grupos[0]!.label).toBe("Jul 26");
    expect(grupos[1]!.label).toBe("Ago 26");
  });

  it("cruza el fin de año sin romperse (Dic 26 → Ene 27)", () => {
    const { grupos } = agruparMeses(semanas(["2026-12-21", "2026-12-28", "2027-01-04"]));
    expect(grupos.map((g) => g.label)).toEqual(["Dic 26", "Ene 27"]);
    expect(grupos.map((g) => g.span)).toEqual([2, 1]);
  });

  it("52 semanas (año completo): los colSpan siempre cubren todas las columnas", () => {
    const starts: string[] = [];
    const base = new Date("2026-07-20T00:00:00");
    for (let i = 0; i < 52; i++) {
      const d = new Date(base.getTime() + i * 7 * 86_400_000);
      starts.push(d.toISOString().slice(0, 10));
    }
    const { grupos } = agruparMeses(semanas(starts));
    expect(grupos.reduce((a, g) => a + g.span, 0)).toBe(52);
  });
});
