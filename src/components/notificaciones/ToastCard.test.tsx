import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import ToastCard from "./ToastCard";
import type { ToastData } from "./toastStore";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("./useNotificaciones", () => ({
  useNotificaciones: () => ({ marcarVista: vi.fn() }),
}));

afterEach(cleanup);

const base: ToastData = {
  key: "chequevenc-1",
  variant: "single",
  severidad: "critica",
  titulo: "Cheque para depositar hoy — Loma Negra",
  mensaje: "Cheque de $7.812.199,31 de Loma Negra vence hoy: depositalo o cedelo.",
  href: "/cheques",
};

/**
 * El cartel que salta en la esquina. Pedido de Julián (27/08/2026): que el aviso
 * del cheque *"salte tipo red social"*. Lo que se cuida acá es que el que no se
 * puede postergar se vea distinto y diga que va a volver.
 */
describe("ToastCard", () => {
  it("el aviso insistente dice que vuelve hasta que se resuelva", () => {
    render(<ToastCard toast={{ ...base, insistente: true }} onDismiss={vi.fn()} />);

    expect(screen.getByText(/Cheque para depositar hoy/)).toBeInTheDocument();
    expect(screen.getByText(/sigue apareciendo hasta que se resuelva/i)).toBeInTheDocument();
  });

  it("uno común no promete que vuelve", () => {
    render(<ToastCard toast={{ ...base, severidad: "info" }} onDismiss={vi.fn()} />);

    expect(screen.queryByText(/sigue apareciendo/i)).toBeNull();
  });

  it("se tiñe con el color de su categoría, el mismo del menú", () => {
    const { container } = render(
      <ToastCard toast={{ ...base, categoria: "cheques_vencidos" }} onDismiss={vi.fn()} />,
    );

    // El ámbar de Finanzas, que es donde vive Cheques en el menú.
    const tarjeta = container.firstElementChild as HTMLElement;
    expect(tarjeta.style.borderLeftColor).toBe("rgb(217, 119, 6)");
  });
});
