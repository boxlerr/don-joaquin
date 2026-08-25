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
  previsualizarRepartoAction: vi.fn(async () => []),
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

/** Los filtros de buscar/área/estado viven detrás del botón "Filtros" del
 *  encabezado. "De vacaciones hoy" NO: vive suelto en la barra, porque es la
 *  pregunta que más se hace y esconderla equivalía a sacarla. */
const abrirFiltros = () => fireEvent.click(screen.getByRole("button", { name: /Filtros/ }));

describe("VacacionesClient", () => {
  it("renderiza KPIs, cronograma con barra proporcional y períodos con año de cargo", () => {
    render(<VacacionesClient saldos={saldos} periodos={periodos} finPeriodoY={finPeriodoY} canWrite />);

    // KPIs
    expect(screen.getByText("Activos hoy")).toBeInTheDocument();
    expect(screen.getByText("En vacaciones")).toBeInTheDocument();
    expect(screen.getByText("Cobertura")).toBeInTheDocument();

    // Buscadores: el de la tabla de saldos siempre a la vista, y el de empleados
    // dentro del panel de filtros.
    expect(screen.getAllByPlaceholderText("Buscar…").length).toBeGreaterThanOrEqual(1);
    abrirFiltros();
    expect(screen.getByPlaceholderText("Buscar empleado…")).toBeInTheDocument();

    // Cronograma: fila del empleado con botón que salta a la tabla
    const filaCrono = screen.getAllByTitle("Ver su saldo en la tabla de abajo");
    expect(filaCrono.length).toBeGreaterThanOrEqual(1);

    // Toggle de la tabla de saldos. El de Timeline/Lista del panel de períodos se
    // eliminó: las dos vistas mostraban lo mismo.
    expect(screen.getByText("Tarjetas")).toBeInTheDocument();
    expect(screen.getByText("Por año")).toBeInTheDocument();

    // Tarjetas (vista por defecto): pill "Vence 31/12" para quien tiene saldo viejo.
    expect(screen.getAllByText(new RegExp(`31/12/${finPeriodoY}`)).length).toBeGreaterThanOrEqual(1);

    // Encabezado de cada sector: el título manda y el conteo va al lado.
    const choferes = screen.getByRole("heading", { name: /Choferes/ });
    expect(choferes).toHaveTextContent("1");
    expect(screen.getByRole("heading", { name: /Taller/ })).toHaveTextContent("1");

    // Período: los días y de qué año descuentan, escrito y no abreviado. Eso vive
    // en la vista de lista, que es la misma información en prosa.
    fireEvent.click(screen.getByText("Lista"));
    expect(
      screen.getAllByText(new RegExp(`descuenta del ${finPeriodoY - 1}`)).length,
    ).toBeGreaterThan(0);
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
    abrirFiltros();
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

  it("“Hoy” deja fuera a los que ya volvieron o todavía no salieron", () => {
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

    // Sin abrir nada: "Hoy" vive suelto en la barra. Estaba adentro del panel
    // de filtros y Bárbara lo reclamó como perdido — "yo veo que no estaba".
    fireEvent.click(screen.getByRole("button", { name: /De vacaciones hoy/ }));
    const filas = screen.getAllByTitle("Ver su saldo en la tabla de abajo");
    expect(filas).toHaveLength(1);
    expect(filas[0]!).toHaveTextContent("Saenz Buruaga");
  });

  it("“De vacaciones hoy” se ve sin abrir nada y dice cuántos son", () => {
    // Video de Bárbara del 10/08: "antes tenía esa opción y me los limpiaba…
    // yo veo que no estaba". El filtro seguía existiendo, pero adentro del panel
    // de filtros. Esconderlo dos clics adentro fue, para ella, sacarlo.
    render(
      <VacacionesClient
        saldos={saldos}
        periodos={[...periodos, periodoFuturo]}
        finPeriodoY={finPeriodoY}
        canWrite
      />,
    );
    const boton = screen.getByRole("button", { name: /De vacaciones hoy/ });
    expect(boton).toBeInTheDocument();
    // El número contesta la pregunta sin siquiera apretarlo.
    expect(boton).toHaveTextContent("1");
  });

  it("con nadie afuera lo dice de una, sin depender de la ventana que se mire", () => {
    // "Quiero apretar de vacaciones hoy y que me diga nadie, cero."
    render(
      <VacacionesClient
        saldos={saldos.map((s) => ({ ...s, en_vacaciones_ahora: false }))}
        periodos={[{ ...periodoFuturo }]}
        finPeriodoY={finPeriodoY}
        canWrite
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /De vacaciones hoy/ }));
    expect(screen.getByText("Hoy no hay nadie de vacaciones.")).toBeInTheDocument();
  });

  it("se puede navegar hacia atrás y volver a hoy", () => {
    render(
      <VacacionesClient
        saldos={saldos}
        periodos={[...periodos, periodoViejo]}
        finPeriodoY={finPeriodoY}
        canWrite
      />,
    );
    // La navegación por ventanas es de la vista de semanas (el calendario se
    // mueve de a un mes).
    fireEvent.click(screen.getByText("Semanas"));

    // Arranca en la semana en curso: el período del mes pasado no está.
    expect(screen.getAllByTitle("Ver su saldo en la tabla de abajo")).toHaveLength(1);

    // Una ventana para atrás. (El largo del rango se elige con el Select estilado
    // del sistema, que no se puede accionar sin user-event; lo que se prueba acá
    // es la navegación, que es lo que hacía falta para liquidar a fin de mes.)
    fireEvent.click(screen.getByTitle("Ventana anterior"));

    // Se habilita el botón para volver, porque la ventana ya no contiene hoy.
    expect(screen.getByText("Hoy")).toBeEnabled();
    // Y al volver, queda deshabilitado (ya estás mirando hoy).
    fireEvent.click(screen.getByText("Hoy"));
    expect(screen.getByText("Hoy")).toBeDisabled();
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
    fireEvent.click(screen.getByRole("button", { name: /De vacaciones hoy/ }));
    // Con el filtro puesto, en el cronograma queda sólo quien está hoy afuera.
    expect(screen.getAllByTitle("Ver su saldo en la tabla de abajo")).toHaveLength(1);

    // El filtro sigue existiendo (y aplicando) en la vista anual: antes el botón
    // desaparecía ahí y el filtro quedaba puesto sin nada que lo dijera.
    fireEvent.click(screen.getByText("Año"));
    expect(screen.getByRole("button", { name: /De vacaciones hoy/ })).toBeInTheDocument();

    // Y la lista, que también lo respeta, muestra sólo ese período.
    fireEvent.click(screen.getByText("Lista"));
    expect(screen.getByText("Quién se va de vacaciones").parentElement!).toHaveTextContent(
      "1 período en el mes que estás viendo",
    );
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

// Pedido de Julián (29/07/2026): "no me gusta que hagan referencia en ningún lado
// a que son datos cargados" y "no entiendo a qué se refiere período en la ventana".
describe("VacacionesClient — panel de quién se va", () => {
  it("no muestra las notas de importación abajo del nombre", () => {
    render(
      <VacacionesClient
        saldos={saldos}
        periodos={[
          { ...periodos[0]!, observaciones: "Import cronograma (VACACIONES 2, 21/07/2026)" },
        ]}
        finPeriodoY={finPeriodoY}
        canWrite
      />,
    );
    fireEvent.click(screen.getByText("Lista"));
    expect(screen.queryByText(/Import cronograma/)).not.toBeInTheDocument();
  });

  it("una nota escrita por una persona sí se muestra", () => {
    render(
      <VacacionesClient
        saldos={saldos}
        periodos={[{ ...periodos[0]!, observaciones: "Se va al casamiento del hermano" }]}
        finPeriodoY={finPeriodoY}
        canWrite
      />,
    );
    fireEvent.click(screen.getByText("Lista"));
    expect(screen.getByText("Se va al casamiento del hermano")).toBeInTheDocument();
  });

  it("dice cuándo vuelve a trabajar y de qué año descuenta", () => {
    render(
      <VacacionesClient
        saldos={saldos}
        periodos={periodos}
        finPeriodoY={finPeriodoY}
        canWrite
      />,
    );
    fireEvent.click(screen.getByText("Lista"));
    expect(screen.getAllByText(/vuelve el/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/descuenta del/).length).toBeGreaterThan(0);
  });

  // "Lista" volvió, pero como una vista del cronograma (calendario / semanas /
  // año / lista), no como el conmutador Timeline/Lista que tenía el panel de
  // períodos y que mostraba lo mismo dos veces.
  it("ya no hay conmutador Timeline/Lista", () => {
    render(
      <VacacionesClient
        saldos={saldos}
        periodos={periodos}
        finPeriodoY={finPeriodoY}
        canWrite
      />,
    );
    expect(screen.queryByText("Timeline")).not.toBeInTheDocument();
    // La única "Lista" que queda es la vista del cronograma, no el conmutador.
    expect(screen.getAllByText("Lista")).toHaveLength(1);
  });
});

// Rediseño del cronograma (06/08/2026): la vista que se abre primero es el
// calendario del mes, con una columna por día.
describe("VacacionesClient — calendario día por día", () => {
  const MES_CORTO = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const MES_LARGO = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const y = hoy.getFullYear();
  const m = hoy.getMonth(); // 0-based
  const dd = (n: number) => String(n).padStart(2, "0");
  /** Un día cualquiera del mes en curso. Del 10 al 16 existen en todos los meses,
   *  así que el período nunca se escapa de la ventana visible. */
  const diaDelMes = (n: number) => `${y}-${dd(m + 1)}-${dd(n)}`;

  const periodoDelMes: VacacionesPeriodo = {
    id: "pc1",
    chofer_id: "c1",
    nombre: "Gaston",
    apellido: "Saenz Buruaga",
    tipo: "Vacaciones",
    fecha_inicio: diaDelMes(10),
    fecha_fin: diaDelMes(16),
    dias: 7,
    estado: "autorizada",
    observaciones: null,
    anio_cargo: finPeriodoY,
    en_curso: false,
    viajes_conflicto: 0,
  };

  it("abre en el mes en curso y escribe el rango adentro de la barra", () => {
    render(
      <VacacionesClient saldos={saldos} periodos={[periodoDelMes]} finPeriodoY={finPeriodoY} canWrite />,
    );
    // El mes, escrito entero: "Agosto 2026", no "Ago 26".
    // El mes aparece dos veces: en la navegación y como rótulo de la tarjeta
    // "programadas" del encabezado.
    expect(screen.getAllByText(`${MES_LARGO[m]} ${y}`).length).toBe(2);
    // Siete días entran, así que la barra lleva sus fechas adentro.
    expect(screen.getAllByText(`10 – 16 ${MES_CORTO[m]}`).length).toBeGreaterThan(0);
    // Y sigue abriendo el detalle, como la vista de semanas.
    fireEvent.click(screen.getAllByTitle(/clic: detalle/)[0]!);
    expect(screen.getByText("Ver saldo en la tabla")).toBeInTheDocument();
  });

  it("marca los feriados con su nombre", () => {
    render(
      <VacacionesClient
        saldos={saldos}
        periodos={[periodoDelMes]}
        finPeriodoY={finPeriodoY}
        canWrite
        feriados={{ [diaDelMes(12)]: "Paso a la Inmortalidad del Gral. San Martín" }}
      />,
    );
    expect(screen.getAllByTitle(/Gral. San Martín/).length).toBeGreaterThan(0);
  });

  it("pliega la lista cuando hay más gente de la que entra en pantalla", () => {
    const muchos = Array.from({ length: 15 }, (_, i) =>
      saldo({ chofer_id: `m${i}`, nombre: `Nombre${i}`, apellido: `Apellido${i}` }),
    );
    const susPeriodos: VacacionesPeriodo[] = muchos.map((s, i) => ({
      ...periodoDelMes,
      id: `pm${i}`,
      chofer_id: s.chofer_id,
      nombre: s.nombre,
      apellido: s.apellido,
    }));
    render(
      <VacacionesClient saldos={muchos} periodos={susPeriodos} finPeriodoY={finPeriodoY} canWrite />,
    );
    // 12 a la vista y el resto detrás de un botón.
    expect(screen.getAllByTitle("Ver su saldo en la tabla de abajo")).toHaveLength(12);
    fireEvent.click(screen.getByText("3 empleados más"));
    expect(screen.getAllByTitle("Ver su saldo en la tabla de abajo")).toHaveLength(15);
  });
});
