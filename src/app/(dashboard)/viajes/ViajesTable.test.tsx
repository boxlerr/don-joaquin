import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import ViajesTable from "./components/ViajesTable";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("./actions", () => ({
  getViajesAction: vi.fn(),
}));

import { getViajesAction } from "./actions";

const mockGetViajes = getViajesAction as ReturnType<typeof vi.fn>;

// Datos de formulario de gasto: el panel de gastos los recibe por prop desde la
// página. En los tests basta un stub vacío (no se ejercita el panel acá).
const EMPTY_GASTO_FORM_DATA = {
  tiposGasto: [],
  viajes: [],
  camiones: [],
  choferes: [],
};

const SAMPLE_VIAJES = [
  {
    id: "1",
    codigo: "VJ-001",
    fecha_viaje: "2024-01-15",
    origen: "Rosario",
    destino: "Buenos Aires",
    km_totales: 350,
    estado: "cerrado",
    facturado: true,
  },
  {
    id: "2",
    codigo: "VJ-002",
    fecha_viaje: "2024-01-20",
    origen: "Córdoba",
    destino: "Santa Fe",
    km_totales: 200,
    estado: "en_curso",
    facturado: false,
  },
];

describe("ViajesTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows skeleton rows while loading", () => {
    mockGetViajes.mockReturnValue(new Promise(() => {})); // never resolves
    render(<ViajesTable gastoFormData={EMPTY_GASTO_FORM_DATA} />);
    // Skeleton rows render as empty cells — check loading state via aria or skeleton presence
    const rows = document.querySelectorAll("[data-slot='skeleton']");
    expect(rows.length).toBeGreaterThan(0);
  });

  it("shows empty state when no viajes returned", async () => {
    mockGetViajes.mockResolvedValue({ data: [], hasMore: false, count: 0 });
    render(<ViajesTable gastoFormData={EMPTY_GASTO_FORM_DATA} />);
    await waitFor(() => {
      expect(screen.getByText("Sin viajes registrados")).toBeInTheDocument();
    });
  });

  it("renders rows with viaje data", async () => {
    mockGetViajes.mockResolvedValue({
      data: SAMPLE_VIAJES,
      hasMore: false,
      count: 2,
    });
    render(<ViajesTable gastoFormData={EMPTY_GASTO_FORM_DATA} />);
    await waitFor(() => {
      expect(screen.getByText("Rosario")).toBeInTheDocument();
      expect(screen.getByText("Buenos Aires")).toBeInTheDocument();
      expect(screen.getByText("Córdoba")).toBeInTheDocument();
    });
  });

  it("shows 'Cargar más' button when hasMore is true", async () => {
    mockGetViajes.mockResolvedValue({
      data: SAMPLE_VIAJES,
      hasMore: true,
      count: 50,
    });
    render(<ViajesTable gastoFormData={EMPTY_GASTO_FORM_DATA} />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /cargar más/i })).toBeInTheDocument();
    });
  });

  it("hides 'Cargar más' when hasMore is false", async () => {
    mockGetViajes.mockResolvedValue({
      data: SAMPLE_VIAJES,
      hasMore: false,
      count: 2,
    });
    render(<ViajesTable gastoFormData={EMPTY_GASTO_FORM_DATA} />);
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /cargar más/i })).not.toBeInTheDocument();
    });
  });

  it("shows error message on action failure", async () => {
    mockGetViajes.mockResolvedValue({ error: "No se pudo cargar los viajes." });
    render(<ViajesTable gastoFormData={EMPTY_GASTO_FORM_DATA} />);
    await waitFor(() => {
      expect(screen.getByText("No se pudo cargar los viajes.")).toBeInTheDocument();
    });
  });

  it("passes choferId to getViajesAction", async () => {
    mockGetViajes.mockResolvedValue({ data: [], hasMore: false, count: 0 });
    render(<ViajesTable choferId="abc-123" gastoFormData={EMPTY_GASTO_FORM_DATA} />);
    await waitFor(() => {
      expect(mockGetViajes).toHaveBeenCalledWith(
        expect.objectContaining({ choferId: "abc-123" })
      );
    });
  });
});
