import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import VacacionesClient, { agruparMeses } from "./VacacionesClient";
import { guardarSaldoVacacionesAction, guardarSaldosAnioAction } from "../[slug]/actions";
import type { VacacionesSaldoChofer, VacacionesPeriodo } from "./lib";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("../[slug]/actions", () => ({
  guardarSaldoVacacionesAction: vi.fn(async () => ({ success: true })),
  guardarSaldosAnioAction: vi.fn(async () => ({ success: true })),
  cancelarAusenciaAction: vi.fn(async () => ({ success: true })),
  crearAusenciaAction: vi.fn(async () => ({ success: true })),
  editarAusenciaAction: vi.fn(async () => ({ success: true })),
  getViajesChoferEnRangoAction: vi.fn(async () => []),
}));
vi.mock("./actions", () => ({
  recalcularDiasPorAntiguedadAction: vi.fn(async () => ({ success: true, actualizados: 0 })),
  guardarUmbralConfigAction: vi.fn(async () => ({ success: true })),
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

    // Encabezado de cada sector: el título manda y el conteo va al lado.
    const choferes = screen.getByRole("heading", { name: /Choferes/ });
    expect(choferes).toHaveTextContent("1");
    expect(screen.getByRole("heading", { name: /Taller/ })).toHaveTextContent("1");
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

// Casos del feedback del 27/07/2026: el cronograma arrancaba siempre en la
// semana en curso (no se podía mirar el mes que se está liquidando) y mezclaba
// a los que ya volvieron con los que están de vacaciones.
describe("VacacionesClient — ventana y filtro del cronograma", () => {
  const manana = new Date(hoy.getTime() + 86_400_000);
  const en2dias = new Date(hoy.getTime() + 2 * 86_400_000);
  // Alguien que aparece en la ventana pero HOY no está de vacaciones.
  const periodoFuturo: VacacionesPeriodo = {
    id: "p2",
    chofer_id: "c2",
    nombre: "Jonatan",
    apellido: "Heim",
    fecha_inicio: iso(manana),
    fecha_fin: iso(en2dias),
    dias: 2,
    estado: "autorizada",
    observaciones: null,
    anio_cargo: finPeriodoY,
    en_curso: false,
    viajes_conflicto: 0,
  };
  // Un período del mes pasado: antes era invisible desde esta pantalla.
  const mesPasado = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 10);
  const mesPasadoFin = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 14);
  const periodoViejo: VacacionesPeriodo = {
    ...periodoFuturo,
    id: "p3",
    fecha_inicio: iso(mesPasado),
    fecha_fin: iso(mesPasadoFin),
    dias: 5,
  };

  it("“Solo de vacaciones hoy” deja fuera a los que ya volvieron o todavía no salieron", () => {
    render(
      <VacacionesClient
        saldos={saldos}
        periodos={[...periodos, periodoFuturo]}
        finPeriodoY={finPeriodoY}
        canWrite
      />,
    );
    // Sin filtro aparecen los dos en el cronograma.
    expect(screen.getAllByTitle("Ver su saldo en la tabla de abajo")).toHaveLength(2);

    fireEvent.click(screen.getByText("Solo de vacaciones hoy"));
    const filas = screen.getAllByTitle("Ver su saldo en la tabla de abajo");
    expect(filas).toHaveLength(1);
    expect(filas[0]!).toHaveTextContent("Saenz Buruaga");
  });

  it("se puede navegar al mes anterior y ver lo que ya pasó", () => {
    render(
      <VacacionesClient
        saldos={saldos}
        periodos={[...periodos, periodoViejo]}
        finPeriodoY={finPeriodoY}
        canWrite
      />,
    );
    // Arranca en la semana en curso: el período del mes pasado no está.
    expect(screen.getAllByTitle("Ver su saldo en la tabla de abajo")).toHaveLength(1);

    // Modo "Un mes" + una vez para atrás.
    fireEvent.change(screen.getByDisplayValue("10 semanas"), { target: { value: "mes" } });
    fireEvent.click(screen.getByTitle("Mes anterior"));

    const filas = screen.getAllByTitle("Ver su saldo en la tabla de abajo");
    expect(filas).toHaveLength(1);
    expect(filas[0]!).toHaveTextContent("Heim");
    // Y aparece el botón para volver, porque la ventana ya no contiene hoy.
    expect(screen.getByText("Hoy")).toBeInTheDocument();
  });

  it("el filtro no queda aplicado (ni invisible) al pasar a la vista anual", () => {
    render(
      <VacacionesClient
        saldos={saldos}
        periodos={[...periodos, periodoFuturo]}
        finPeriodoY={finPeriodoY}
        canWrite
      />,
    );
    fireEvent.click(screen.getByText("Solo de vacaciones hoy"));
    expect(screen.getByText("Períodos en la ventana").parentElement!).toHaveTextContent("(1)");

    // En la vista anual el botón del filtro no existe: no puede seguir filtrando.
    fireEvent.click(screen.getByText("Año"));
    expect(screen.queryByText("Solo de vacaciones hoy")).not.toBeInTheDocument();
    expect(screen.getByText("Períodos en la ventana").parentElement!).toHaveTextContent("(2)");
  });

  it("el máximo de ausentes puede definirse por mes", () => {
    const { rerender } = render(
      <VacacionesClient
        saldos={saldos}
        periodos={periodos}
        finPeriodoY={finPeriodoY}
        canWrite
        choferesActivos={60}
      />,
    );
    // Modo auto: 10% de 60 = 6
    expect(screen.getByText(/máximo: 6 por semana/)).toBeInTheDocument();

    rerender(
      <VacacionesClient
        saldos={saldos}
        periodos={periodos}
        finPeriodoY={finPeriodoY}
        canWrite
        choferesActivos={60}
        umbralConfig={{ modo: "fijo", porcentaje: 10, minimo: 4, fijo: 3, porMes: { 12: 15 } }}
      />,
    );
    expect(screen.getByText(/máximo: 3 por semana/)).toBeInTheDocument();
    expect(screen.getByText(/1 mes\/es aparte/)).toBeInTheDocument();
  });
});

describe("VacacionesClient — edición de saldo", () => {
  it("cambiar de vista con una fila abierta cierra la edición en vez de guardar por el camino equivocado", () => {
    vi.mocked(guardarSaldoVacacionesAction).mockClear();
    vi.mocked(guardarSaldosAnioAction).mockClear();
    render(<VacacionesClient saldos={saldos} periodos={periodos} finPeriodoY={finPeriodoY} canWrite />);

    fireEvent.click(screen.getByText("Por año"));
    fireEvent.click(screen.getAllByTitle(/Editar los días/)[0]!);
    expect(screen.getByTitle("Guardar")).toBeInTheDocument();

    // Antes la fila seguía abierta y el ✓ guardaba con la acción de la otra vista.
    fireEvent.click(screen.getByText("Resumen"));
    expect(screen.queryByTitle("Guardar")).not.toBeInTheDocument();
    expect(guardarSaldoVacacionesAction).not.toHaveBeenCalled();
    expect(guardarSaldosAnioAction).not.toHaveBeenCalled();
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
