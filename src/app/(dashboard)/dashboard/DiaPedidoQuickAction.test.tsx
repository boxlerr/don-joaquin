import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import DiaPedidoQuickAction from "./DiaPedidoQuickAction";

/**
 * El alta rápida del día pedido (audios de Bárbara, 10/08 y 02/09).
 *
 * Lo que el pedido exige y es fácil de romper sin darse cuenta: que un día
 * suelto no obligue a completar "hasta"; que al elegir la persona aparezca
 * cuántos días lleva pedidos —"che flaco, vos me pediste el mes pasado cuatro
 * días"—; que se pueda dejar un detalle escrito ("me hubiera gustado aclarar
 * que el tipo se casa"); y que se pueda registrar el día aunque no haya motivo,
 * sin que descuente vacaciones ("le doy el día porque le doy el día").
 */

const { crearAusenciaAction, getDiasPedidosAnioAction, refresh } = vi.hoisted(() => ({
  crearAusenciaAction: vi.fn(async () => ({ success: true })),
  getDiasPedidosAnioAction: vi.fn(async () => ({ dias: 4, veces: 2 })),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));
vi.mock("@/app/(dashboard)/choferes/[slug]/actions", () => ({
  crearAusenciaAction,
  editarAusenciaAction: vi.fn(async () => ({ success: true })),
  getViajesChoferEnRangoAction: vi.fn(async () => []),
  getDiasPedidosAnioAction,
}));
vi.mock("./dias-pedidos-actions", () => ({
  getChoferesParaDiaPedidoAction: vi.fn(async () => [
    { id: "c1", nombre: "Gaston", apellido: "Saenz Buruaga" },
  ]),
}));

const abrir = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /Día pedido/ }));
  });
};

const elegirPersona = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole("combobox"));
  });
  await act(async () => {
    fireEvent.click(screen.getByText("Saenz Buruaga, Gaston"));
  });
};

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe("DiaPedidoQuickAction", () => {
  it("se abre desde el tablero sin salir de la pantalla", async () => {
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
    await elegirPersona();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Turno médico" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Registrar" }));
    });

    expect(crearAusenciaAction).toHaveBeenCalledTimes(1);
    const [choferId, data] = crearAusenciaAction.mock.calls[0]!;
    expect(choferId).toBe("c1");
    // Sin tocar "hasta", el fin es el mismo día — no queda un rango abierto.
    expect(data.fecha_fin).toBe(data.fecha_inicio);
    expect(data.tipo).toBe("Turno médico");
    // Y NO es vacaciones: si entrara como vacaciones descontaría del saldo.
    expect(data.es_vacaciones).toBe(false);
  });

  it("al elegir la persona dice cuántos días lleva pedidos en el año", async () => {
    render(<DiaPedidoQuickAction />);
    await abrir();
    await elegirPersona();

    expect(screen.getByText(/ya pidió 4 días en \d{4}, en 2 veces/i)).toBeTruthy();
  });

  it("no guarda sin motivo", async () => {
    render(<DiaPedidoQuickAction />);
    await abrir();
    await elegirPersona();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Registrar" }));
    });

    expect(crearAusenciaAction).not.toHaveBeenCalled();
    expect(screen.getByText("Poné el motivo")).toBeTruthy();
  });

  // "Le doy el día porque le doy el día": el día queda registrado igual, no
  // descuenta vacaciones y no es una falta.
  it("“Sin motivo” alcanza para registrar el día, y no es una falta", async () => {
    render(<DiaPedidoQuickAction />);
    await abrir();
    await elegirPersona();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Sin motivo" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Registrar" }));
    });

    expect(crearAusenciaAction).toHaveBeenCalledTimes(1);
    const [, data] = crearAusenciaAction.mock.calls[0]!;
    expect(data.tipo).toBe("Sin motivo");
    expect(data.es_vacaciones).toBe(false);
    // Pidió el día y se lo dieron: no es una ausencia injustificada.
    expect(data.justificada).toBe(true);
  });

  // "Le puse trámite, pero me hubiera gustado aclarar que el tipo se casa."
  it("guarda el detalle escrito además del motivo", async () => {
    render(<DiaPedidoQuickAction />);
    await abrir();
    await elegirPersona();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Trámite" }));
    });
    await act(async () => {
      fireEvent.change(screen.getByLabelText(/Detalle/), { target: { value: "Se casa" } });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Registrar" }));
    });

    const [, data] = crearAusenciaAction.mock.calls[0]!;
    expect(data.tipo).toBe("Trámite");
    expect(data.observaciones).toBe("Se casa");
  });
});
