import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import DiaPedidoQuickAction from "./DiaPedidoQuickAction";

/**
 * El alta rápida del día pedido (audio de Bárbara, 10/08).
 *
 * Dos cosas que el pedido exige y que son fáciles de romper sin darse cuenta:
 * que un día suelto no obligue a completar "hasta", y que al elegir la persona
 * aparezca cuántos días lleva pedidos — "che flaco, vos me pediste el mes
 * pasado cuatro días".
 */

const { crearAusenciaAction, getDiasPedidosAnioAction, refresh } = vi.hoisted(() => ({
  crearAusenciaAction: vi.fn(async () => ({ success: true })),
  getDiasPedidosAnioAction: vi.fn(async () => ({ dias: 4, veces: 2 })),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));
vi.mock("../choferes/[slug]/actions", () => ({ crearAusenciaAction }));
vi.mock("./dias-pedidos-actions", () => ({
  getChoferesParaDiaPedidoAction: vi.fn(async () => [
    { id: "c1", nombre: "Gaston", apellido: "Saenz Buruaga" },
  ]),
  getDiasPedidosAnioAction,
}));

const abrir = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /Día pedido/ }));
  });
};

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe("DiaPedidoQuickAction", () => {
  it("se abre desde el dashboard sin salir de la pantalla", async () => {
    render(<DiaPedidoQuickAction />);
    await abrir();
    expect(screen.getByText("Registrar un día pedido")).toBeTruthy();
    // Los motivos que ella nombró, como atajo.
    expect(screen.getByRole("button", { name: "Turno médico" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Dentista" })).toBeTruthy();
  });

  it("un día suelto no obliga a completar “hasta”", async () => {
    render(<DiaPedidoQuickAction />);
    await abrir();

    // Elegir la persona por el combobox.
    await act(async () => {
      fireEvent.click(screen.getByRole("combobox"));
    });
    await act(async () => {
      fireEvent.click(screen.getByText("Saenz Buruaga, Gaston"));
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Turno médico" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Registrar" }));
    });

    expect(crearAusenciaAction).toHaveBeenCalledTimes(1);
    const [choferId, data] = crearAusenciaAction.mock.calls[0]!;
    expect(choferId).toBe("c1");
    // Sin "hasta", el fin es el mismo día — no queda un rango abierto.
    expect(data.fecha_fin).toBe(data.fecha_inicio);
    expect(data.tipo).toBe("Turno médico");
    // Y NO es vacaciones: si entrara como vacaciones descontaría del saldo.
    expect(data.es_vacaciones).toBe(false);
  });

  it("al elegir la persona dice cuántos días lleva pedidos en el año", async () => {
    render(<DiaPedidoQuickAction />);
    await abrir();
    await act(async () => {
      fireEvent.click(screen.getByRole("combobox"));
    });
    await act(async () => {
      fireEvent.click(screen.getByText("Saenz Buruaga, Gaston"));
    });

    expect(screen.getByText(/ya pidió 4 días este año, en 2 veces/i)).toBeTruthy();
  });

  it("no guarda sin motivo", async () => {
    render(<DiaPedidoQuickAction />);
    await abrir();
    await act(async () => {
      fireEvent.click(screen.getByRole("combobox"));
    });
    await act(async () => {
      fireEvent.click(screen.getByText("Saenz Buruaga, Gaston"));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Registrar" }));
    });

    expect(crearAusenciaAction).not.toHaveBeenCalled();
    expect(screen.getByText("Poné el motivo")).toBeTruthy();
  });
});
