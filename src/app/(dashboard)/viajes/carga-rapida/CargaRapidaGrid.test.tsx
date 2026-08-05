import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import CargaRapidaGrid from "./CargaRapidaGrid";
import type { ViajeFormData } from "../actions";
import { createViajesBatchAction } from "../actions";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("../actions", () => ({
  createViajesBatchAction: vi.fn(),
  getImporteSugeridoAction: vi.fn(),
}));

const DATA: ViajeFormData = {
  clientes: [{ id: "cli-ypf", label: "YPF" }],
  choferes: [
    { id: "ch-schwindt", label: "Schwindt, Jorge Fernando", camionId: "cam-671" },
    // Cepeda no tiene unidad fija: al duplicar la fila, el camión NO se pisa solo.
    { id: "ch-cepeda", label: "Cepeda, Tomas Ariel", camionId: null },
  ],
  camiones: [
    { id: "cam-671", label: "AF671SI" },
    { id: "cam-109", label: "AC109RC" },
  ],
  tipos_carga: [{ id: "tc-arena", label: "Arena granel" }],
  puntos_ruta: [{ id: "pr-1", label: "IBICUY" }],
  circuitos: [],
};

const mockBatch = vi.mocked(createViajesBatchAction);

/** Deja la pantalla con cliente elegido y una fila con chofer + camión. */
function prepararUnaFila() {
  render(<CargaRapidaGrid data={DATA} />);
  fireEvent.click(screen.getByText("Seleccioná un cliente..."));
  fireEvent.click(screen.getByText("YPF"));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CargaRapidaGrid · el botón no se queda colgado", () => {
  it("sale de 'Guardando...' y muestra el error cuando la acción del servidor tira", async () => {
    // Regresión del 05/08: el alta de dos filas con el mismo destino nuevo hacía
    // tirar la acción, no había try/catch y el botón quedaba en "Guardando..."
    // para siempre, sin guardar nada y sin decirlo.
    mockBatch.mockRejectedValue(new Error("No se pudo dar de alta el lugar \"LAJE41\"."));
    prepararUnaFila();

    fireEvent.click(screen.getByRole("button", { name: /Guardar 1 viaje/ }));

    await waitFor(() =>
      expect(screen.getByText(/No se pudieron guardar los viajes/)).toBeInTheDocument(),
    );
    expect(screen.getByText(/LAJE41/)).toBeInTheDocument();
    expect(screen.queryByText("Guardando...")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Guardar 1 viaje/ })).toBeEnabled();
  });

  it("no borra las filas cargadas cuando falla, para poder reintentar", async () => {
    mockBatch.mockRejectedValue(new Error("se cortó la red"));
    prepararUnaFila();
    fireEvent.change(screen.getByPlaceholderText("Destino..."), {
      target: { value: "LAJE41" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Guardar 1 viaje/ }));

    await waitFor(() =>
      expect(screen.getByText(/Las filas quedaron cargadas/)).toBeInTheDocument(),
    );
    expect(screen.getByPlaceholderText("Destino...")).toHaveValue("LAJE41");
  });

  it("limpia la grilla cuando sí se guardó", async () => {
    mockBatch.mockResolvedValue({ ok: true, creados: 1 });
    prepararUnaFila();
    fireEvent.change(screen.getByPlaceholderText("Destino..."), {
      target: { value: "LAJE41" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Guardar 1 viaje/ }));

    await waitFor(() =>
      expect(screen.getByText("1 viaje(s) creados correctamente.")).toBeInTheDocument(),
    );
    expect(screen.getByPlaceholderText("Destino...")).toHaveValue("");
  });
});

describe("CargaRapidaGrid · camión repetido entre filas", () => {
  it("marca la patente repetida y a quiénes, sin bloquear el guardado", () => {
    render(<CargaRapidaGrid data={DATA} />);

    // Fila 1: Schwindt trae AF671SI por su asignación fija.
    fireEvent.click(screen.getAllByText("— Elegí —")[0]);
    fireEvent.click(screen.getByText("Schwindt, Jorge Fernando"));
    // Se duplica la fila y se le cambia el chofer a Cepeda, que no tiene unidad
    // fija: el camión queda igual y las dos filas comparten AF671SI.
    fireEvent.click(screen.getByTitle("Duplicar fila"));
    fireEvent.click(screen.getAllByText("Schwindt, Jorge Fernando")[1]);
    fireEvent.click(screen.getByText("Cepeda, Tomas Ariel"));

    const aviso = screen.getByText("Hay un camión repetido en dos filas.")
      .parentElement as HTMLElement;
    const detalle = within(aviso).getByText("AF671SI").closest("li") as HTMLElement;
    expect(detalle.textContent).toMatch(
      /Schwindt, Jorge Fernando y Cepeda, Tomas Ariel/,
    );
    // Se avisa, no se bloquea: el chofer puede haberle pasado la unidad al otro.
    expect(screen.getByRole("button", { name: /Guardar 2 viajes/ })).toBeEnabled();
  });

  it("no dice nada cuando cada fila tiene su camión", () => {
    render(<CargaRapidaGrid data={DATA} />);

    fireEvent.click(screen.getAllByText("— Elegí —")[0]);
    fireEvent.click(screen.getByText("Schwindt, Jorge Fernando"));

    expect(screen.queryByText(/camión repetido/)).not.toBeInTheDocument();
  });
});
