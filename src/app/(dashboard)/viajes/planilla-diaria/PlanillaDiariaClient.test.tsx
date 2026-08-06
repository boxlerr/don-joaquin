import { describe, it, expect, vi } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import PlanillaDiariaClient from "./PlanillaDiariaClient";
import type { PlanillaDiariaData } from "./actions";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("./actions", () => ({
  guardarPlanillaDiariaAction: vi.fn(),
}));

vi.mock("./ImprimirPlanillaButton", () => ({
  default: () => null,
}));

vi.mock("./CambiosDrawer", () => ({
  default: () => null,
}));

const CAMIONES = [
  { id: "cam-a", label: "AD916TF" },
  { id: "cam-b", label: "AE601GF" },
  { id: "cam-c", label: "AF696CW" },
];

/** Planilla de una fecha pasada (historial, solo lectura). */
function historial(
  overrides: Partial<PlanillaDiariaData["choferes"][number]>[] = [],
): PlanillaDiariaData {
  const base = [
    {
      chofer_id: "ch-1",
      nombre: "Marcelo",
      apellido: "Bustos",
      camion_habitual_id: "cam-a",
      camion_habitual_patente: "AD916TF",
      camion_asignado_id: "cam-b",
      // Ese día pasó de AD916TF a AE601GF.
      camion_previo_id: "cam-a",
      camion_previo_patente: "AD916TF",
      observaciones: null,
    },
    {
      chofer_id: "ch-2",
      nombre: "Pablo",
      apellido: "Acosta",
      camion_habitual_id: "cam-c",
      camion_habitual_patente: "AF696CW",
      camion_asignado_id: "cam-c",
      // Sin cambio: el previo es el mismo camión.
      camion_previo_id: "cam-c",
      camion_previo_patente: "AF696CW",
      observaciones: null,
    },
  ];

  return {
    fecha: "2026-07-13",
    hoy: "2026-07-21",
    editable: false,
    choferes: base.map((c, i) => ({ ...c, ...(overrides[i] ?? {}) })),
    camiones: CAMIONES,
    guardado_por: "Bárbara Joaquín",
    guardado_el: "2026-07-13T12:36:13.000Z",
    fechas_guardadas: ["2026-07-06", "2026-07-13"],
    fechas_con_cambios: ["2026-07-13"],
    fecha_anterior: "2026-07-06",
    hay_planilla: true,
    vigente_desde: null,
  };
}

function filaDe(apellido: string): HTMLElement {
  return screen.getByText(new RegExp(`^${apellido},`)).closest("tr") as HTMLElement;
}

/** Planilla de HOY (editable). */
function hoy(
  overrides: Partial<PlanillaDiariaData["choferes"][number]>[] = [],
): PlanillaDiariaData {
  const base = historial();
  return {
    ...base,
    fecha: "2026-07-21",
    editable: true,
    choferes: base.choferes.map((c, i) => ({
      ...c,
      camion_previo_id: c.camion_asignado_id,
      ...(overrides[i] ?? {}),
    })),
  };
}

describe("PlanillaDiariaClient · buscador", () => {
  it("filtra por apellido", () => {
    render(<PlanillaDiariaClient data={hoy()} />);

    fireEvent.change(screen.getByLabelText("Buscar"), { target: { value: "acos" } });

    expect(screen.getByText(/^Acosta,/)).toBeInTheDocument();
    expect(screen.queryByText(/^Bustos,/)).not.toBeInTheDocument();
  });

  it("filtra por patente del camión asignado", () => {
    render(<PlanillaDiariaClient data={hoy()} />);

    fireEvent.change(screen.getByLabelText("Buscar"), { target: { value: "AE601GF" } });

    expect(screen.getByText(/^Bustos,/)).toBeInTheDocument();
    expect(screen.queryByText(/^Acosta,/)).not.toBeInTheDocument();
  });

  it("encuentra sin escribir los acentos", () => {
    const data = hoy([{ apellido: "Asteazarán" }]);
    render(<PlanillaDiariaClient data={data} />);

    fireEvent.change(screen.getByLabelText("Buscar"), { target: { value: "asteazaran" } });

    expect(screen.getByText(/^Asteazarán,/)).toBeInTheDocument();
  });

  it("dice qué se buscó cuando no hay coincidencias", () => {
    render(<PlanillaDiariaClient data={hoy()} />);

    fireEvent.change(screen.getByLabelText("Buscar"), { target: { value: "zzz" } });

    expect(screen.getByText(/Ningún chofer ni patente coincide con "zzz"/)).toBeInTheDocument();
  });
});

describe("PlanillaDiariaClient · choferes sin camión", () => {
  it("los cuenta en el resumen del día", () => {
    const data = hoy([{ camion_asignado_id: null, camion_previo_id: null }]);
    render(<PlanillaDiariaClient data={data} />);

    expect(
      screen.getByTitle("Ver solo los choferes sin camión asignado").textContent,
    ).toMatch(/1 sin camión/);
  });

  it("marca la fila del chofer sin unidad, no sólo el conteo de arriba", () => {
    // El reclamo del 05/08: el conteo estaba arriba pero la fila no se distinguía
    // entre 62 — donde las otras dicen "habitual" quedaba un hueco.
    const data = hoy([{ camion_asignado_id: null, camion_previo_id: null }]);
    render(<PlanillaDiariaClient data={data} />);

    const fila = within(screen.getByRole("table")).getByText(/^Bustos,/)
      .closest("tr") as HTMLElement;
    expect(within(fila).getByText("Sin camión")).toBeInTheDocument();
    // La fila del que sí tiene camión no lleva la marca.
    const otra = within(screen.getByRole("table")).getByText(/^Acosta,/)
      .closest("tr") as HTMLElement;
    expect(within(otra).queryByText("Sin camión")).not.toBeInTheDocument();
  });

  it("deja aislar a los que no tienen unidad y volver atrás", () => {
    const data = hoy([{ camion_asignado_id: null, camion_previo_id: null }]);
    render(<PlanillaDiariaClient data={data} />);
    const grilla = () => within(screen.getByRole("table"));

    fireEvent.click(screen.getByTitle("Ver solo los choferes sin camión asignado"));
    expect(grilla().getByText(/^Bustos,/)).toBeInTheDocument();
    expect(grilla().queryByText(/^Acosta,/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByTitle("Ver todos los choferes"));
    expect(grilla().getByText(/^Acosta,/)).toBeInTheDocument();
  });

  it("no avisa nada si todos tienen camión", () => {
    render(<PlanillaDiariaClient data={hoy()} />);

    expect(screen.queryByText(/sin camión asignado\./)).not.toBeInTheDocument();
  });
});

describe("PlanillaDiariaClient · camión repetido", () => {
  it("dice qué patente está repetida y entre qué choferes", () => {
    // Los dos con cam-b: el caso de Schwindt y Cepeda con AF671SI.
    const data = hoy([{ camion_asignado_id: "cam-b" }, { camion_asignado_id: "cam-b" }]);
    render(<PlanillaDiariaClient data={data} />);

    const aviso = screen.getByText("Hay un camión asignado a dos choferes.")
      .parentElement as HTMLElement;
    const detalle = within(aviso).getByText("AE601GF").closest("li") as HTMLElement;
    expect(detalle.textContent).toMatch(/Bustos, Marcelo y Acosta, Pablo/);
  });

  it("apunta a la carga rápida para el viaje del otro chofer", () => {
    const data = hoy([{ camion_asignado_id: "cam-b" }, { camion_asignado_id: "cam-b" }]);
    render(<PlanillaDiariaClient data={data} />);

    expect(screen.getByText(/que sí permite/).textContent).toMatch(/Carga rápida/);
  });

  it("no muestra el cartel cuando no hay repetidos", () => {
    render(<PlanillaDiariaClient data={hoy()} />);

    expect(screen.queryByText(/asignado a dos choferes/)).not.toBeInTheDocument();
  });
});

describe("PlanillaDiariaClient · marca de cambio de camión", () => {
  it("muestra de qué camión a cuál pasó el chofer que cambió", () => {
    render(<PlanillaDiariaClient data={historial()} />);

    const fila = filaDe("Bustos");
    expect(within(fila).getByTitle("Cambió de AD916TF a AE601GF")).toBeInTheDocument();
  });

  it("no marca cambio en el chofer que siguió con el mismo camión", () => {
    render(<PlanillaDiariaClient data={historial()} />);

    const fila = filaDe("Acosta");
    expect(within(fila).getByText("—")).toBeInTheDocument();
  });

  it("cuenta los cambios del día y lo dice en el cartel del historial", () => {
    render(<PlanillaDiariaClient data={historial()} />);

    // El conteo del encabezado y el cartel del historial dicen lo mismo.
    expect(
      screen.getByTitle("Ver solo los que cambiaron").textContent,
    ).toMatch(/1 cambio de camión/);
    expect(
      screen.getByText(/respecto de la planilla del 06\/07\/2026/).textContent,
    ).toMatch(/1 cambio de camión/);
  });

  it("filtra a solo los choferes que cambiaron", () => {
    render(<PlanillaDiariaClient data={historial()} />);

    fireEvent.click(screen.getByTitle("Ver solo los que cambiaron"));

    expect(screen.getByText(/^Bustos,/)).toBeInTheDocument();
    expect(screen.queryByText(/^Acosta,/)).not.toBeInTheDocument();
  });

  it("muestra 'Sin camión' cuando el chofer se quedó sin unidad", () => {
    const data = historial([
      { camion_asignado_id: null, camion_previo_id: "cam-a", camion_previo_patente: "AD916TF" },
    ]);
    render(<PlanillaDiariaClient data={data} />);

    const fila = filaDe("Bustos");
    const cambio = within(fila).getByTitle("Cambió de AD916TF a sin camión");
    expect(within(cambio).getByText("Sin camión")).toBeInTheDocument();
  });

  it("arrastra la planilla vigente en un día sin planilla propia", () => {
    // La planilla sigue rigiendo hasta que se cambia: ese día no está "sin
    // asignar", tiene las mismas unidades y ningún cambio marcado.
    const base = historial();
    const data = {
      ...base,
      vigente_desde: "2026-07-06",
      choferes: base.choferes.map((c) => ({
        ...c,
        // Heredada: el previo es el mismo camión, así que no hay cambio.
        camion_previo_id: c.camion_asignado_id,
        camion_previo_patente: null,
      })),
    };
    render(<PlanillaDiariaClient data={data} />);

    expect(
      screen.getByText(/seguía vigente la del/).textContent,
    ).toMatch(/06\/07\/2026/);
    expect(within(filaDe("Bustos")).getByText("AE601GF")).toBeInTheDocument();
    expect(screen.queryByText(/cambios? de camión/)).not.toBeInTheDocument();
  });

  it("avisa cuando la fecha es anterior a la primera planilla", () => {
    const base = historial();
    const data = {
      ...base,
      hay_planilla: false,
      choferes: base.choferes.map((c) => ({
        ...c,
        camion_asignado_id: null,
        camion_previo_id: null,
        camion_previo_patente: null,
      })),
    };
    render(<PlanillaDiariaClient data={data} />);

    expect(screen.getByText(/No hay planilla registrada al 13\/07\/2026/)).toBeInTheDocument();
    expect(screen.queryByText(/cambios? de camión/)).not.toBeInTheDocument();
  });

  it("deja apagar el filtro aunque ya no queden cambios", () => {
    // Regresión: el chip se desmontaba al quedar 0 cambios y la planilla entera
    // quedaba escondida sin forma de volver.
    render(<PlanillaDiariaClient data={historial()} />);

    fireEvent.click(screen.getByTitle("Ver solo los que cambiaron"));
    expect(screen.queryByText(/^Acosta,/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByTitle("Ver todos los choferes"));
    expect(screen.getByText(/^Acosta,/)).toBeInTheDocument();
  });

  it("avisa cuando ese día no hubo ningún cambio", () => {
    const data = historial([
      { camion_asignado_id: "cam-a", camion_previo_id: "cam-a", camion_previo_patente: "AD916TF" },
    ]);
    render(<PlanillaDiariaClient data={data} />);

    expect(screen.getByText(/sin cambios de camión/)).toBeInTheDocument();
  });
});
