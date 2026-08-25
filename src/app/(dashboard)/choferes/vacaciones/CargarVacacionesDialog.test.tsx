import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import CargarVacacionesDialog, { type OcupacionRango } from "./CargarVacacionesDialog";
import { guardarUmbralConfigAction } from "./actions";
import { UMBRAL_DEFAULT } from "./umbral";

vi.mock("../[slug]/actions", () => ({
  crearAusenciaAction: vi.fn(async () => ({ success: true })),
  getViajesChoferEnRangoAction: vi.fn(async () => []),
  previsualizarRepartoAction: vi.fn(async () => []),
}));
vi.mock("./actions", () => ({
  guardarUmbralConfigAction: vi.fn(async () => ({ success: true })),
}));

const CHOFER = { chofer_id: "c1", nombre: "Gaston", apellido: "Saenz Buruaga" };

/** El rango de la prueba cae siempre dentro de una sola semana (lunes a domingo). */
const SEMANA = "2026-08-03";

function renderDialog(over: Partial<React.ComponentProps<typeof CargarVacacionesDialog>> = {}) {
  const ocupacionEn = vi.fn(
    (): OcupacionRango => ({ semana: SEMANA, ocupados: 3, tope: 8 }),
  );
  return render(
    <CargarVacacionesDialog
      open
      onOpenChange={() => {}}
      onSuccess={() => {}}
      choferes={[CHOFER]}
      choferFijo={CHOFER}
      inicioPreset="2026-08-04"
      finPreset="2026-08-07"
      ocupacionEn={ocupacionEn}
      tope={{ config: UMBRAL_DEFAULT, activos: 76, editable: true }}
      {...over}
    />,
  );
}

/**
 * El `Label` de Base UI no le pone `for` al input en jsdom, así que
 * `getByLabelText` no lo encuentra. Los dos únicos `input[type=date]` del
 * diálogo son "Desde" y "Hasta", en ese orden.
 */
function campoDesde(): HTMLInputElement {
  return document.querySelectorAll<HTMLInputElement>('input[type="date"]')[0]!;
}

describe("CargarVacacionesDialog — tope de gente por semana", () => {
  beforeEach(() => vi.clearAllMocks());

  it("dice cuánta gente ya está de vacaciones y contra qué tope", () => {
    renderDialog();
    expect(screen.getByText(/ya hay/)).toBeInTheDocument();
    expect(screen.getByText("3 de 8")).toBeInTheDocument();
    // El rango entra en una sola semana: no hace falta nombrarla.
    expect(screen.getByText(/Esa semana/)).toBeInTheDocument();
  });

  it("explica de dónde sale el tope, sin repetir el número", () => {
    renderDialog();
    expect(
      screen.getByText(/10% de los 76 activos, nunca menos de 4/),
    ).toBeInTheDocument();
  });

  it("avisa cuando la semana ya llegó al tope", () => {
    renderDialog({
      ocupacionEn: () => ({ semana: SEMANA, ocupados: 8, tope: 8 }),
    });
    expect(screen.getByText(/llegó al tope/)).toBeInTheDocument();
  });

  it("nombra la semana ajustada cuando el rango toca más de una", () => {
    renderDialog({
      inicioPreset: "2026-08-04",
      finPreset: "2026-08-20",
      ocupacionEn: () => ({ semana: "2026-08-17", ocupados: 7, tope: 8 }),
    });
    expect(screen.getByText(/La semana del 17\/08\/2026/)).toBeInTheDocument();
  });

  it("no ofrece cambiar el tope a quien no puede escribir", () => {
    renderDialog({ tope: { config: UMBRAL_DEFAULT, activos: 76, editable: false } });
    expect(screen.queryByRole("button", { name: /Cambiar el tope/ })).toBeNull();
  });

  it("abre el editor en el mismo diálogo y vuelve con las fechas puestas", () => {
    renderDialog();
    fireEvent.change(campoDesde(), { target: { value: "2026-08-05" } });
    expect(campoDesde().value).toBe("2026-08-05");

    fireEvent.click(screen.getByRole("button", { name: /Cambiar el tope/ }));

    // El editor está a la vista y el formulario de carga, escondido.
    expect(screen.getByText(/Cuánta gente puede irse de vacaciones a la vez/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Guardar tope/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Volver a cargar vacaciones/ }));

    // Vuelve con lo que había escrito: el formulario se escondió, no se desmontó.
    expect(campoDesde().value).toBe("2026-08-05");
    expect(screen.queryByRole("button", { name: /Guardar tope/ })).toBeNull();
  });

  it("guarda el tope y cierra el editor sin perder el formulario", async () => {
    const onTopeGuardado = vi.fn();
    renderDialog({ onTopeGuardado });
    fireEvent.change(campoDesde(), { target: { value: "2026-08-05" } });

    fireEvent.click(screen.getByRole("button", { name: /Cambiar el tope/ }));
    fireEvent.click(screen.getByRole("button", { name: /Guardar tope/ }));

    await vi.waitFor(() => expect(onTopeGuardado).toHaveBeenCalledOnce());
    expect(guardarUmbralConfigAction).toHaveBeenCalledOnce();
    await vi.waitFor(() =>
      expect(screen.queryByRole("button", { name: /Guardar tope/ })).toBeNull(),
    );
    expect(campoDesde().value).toBe("2026-08-05");
  });

  it("las semanas sugeridas muestran el tope al lado del conteo", () => {
    renderDialog({
      inicioPreset: undefined,
      finPreset: undefined,
      sugerencias: [{ inicio: "2026-09-07", fin: "2026-09-13", ocupados: 2, umbral: 8 }],
    });
    const sug = screen.getByRole("button", { name: /07\/09\/2026/ });
    expect(within(sug).getByText(/2 de 8/)).toBeInTheDocument();
  });
});
