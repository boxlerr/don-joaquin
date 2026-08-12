import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { useCambiosSinGuardar } from "./useCambiosSinGuardar";

function Pantalla({ hayCambios }: { hayCambios: boolean }) {
  useCambiosSinGuardar(hayCambios);
  return (
    <div>
      <a href="/viajes">Ir a viajes</a>
      <a href="#abajo">Bajar</a>
      <a href="/reporte.xlsx" download="">
        Descargar
      </a>
      <a href="/ayuda" target="_blank" rel="noreferrer">
        Ayuda
      </a>
    </div>
  );
}

/** Un clic como el que hace un usuario: burbujea y es cancelable. */
const clickear = (texto: string, init: MouseEventInit = {}) => {
  const evento = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...init });
  screen.getByText(texto).dispatchEvent(evento);
  return evento;
};

const disparaBeforeUnload = () => {
  const evento = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(evento);
  return evento;
};

describe("useCambiosSinGuardar", () => {
  beforeEach(() => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it("sin cambios no molesta a nadie", () => {
    render(<Pantalla hayCambios={false} />);

    expect(clickear("Ir a viajes").defaultPrevented).toBe(false);
    expect(window.confirm).not.toHaveBeenCalled();
    expect(disparaBeforeUnload().defaultPrevented).toBe(false);
  });

  it("con cambios, salir de la pantalla pregunta y se puede cancelar", () => {
    render(<Pantalla hayCambios />);

    const evento = clickear("Ir a viajes");

    expect(window.confirm).toHaveBeenCalled();
    expect(evento.defaultPrevented).toBe(true);
  });

  it("si confirma que sí, lo deja irse", () => {
    vi.mocked(window.confirm).mockReturnValue(true);
    render(<Pantalla hayCambios />);

    expect(clickear("Ir a viajes").defaultPrevented).toBe(false);
  });

  it("con cambios, cerrar la pestaña pide confirmación al navegador", () => {
    render(<Pantalla hayCambios />);

    expect(disparaBeforeUnload().defaultPrevented).toBe(true);
  });

  it("no molesta con un ancla a la misma página", () => {
    render(<Pantalla hayCambios />);

    expect(clickear("Bajar").defaultPrevented).toBe(false);
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it("no molesta al descargar un archivo: la pantalla no se va a ningún lado", () => {
    render(<Pantalla hayCambios />);

    expect(clickear("Descargar").defaultPrevented).toBe(false);
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it("no molesta con un link que abre en otra pestaña", () => {
    render(<Pantalla hayCambios />);

    expect(clickear("Ayuda").defaultPrevented).toBe(false);
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it("no molesta con ⌘+clic: eso abre en otra pestaña", () => {
    render(<Pantalla hayCambios />);

    expect(clickear("Ir a viajes", { metaKey: true }).defaultPrevented).toBe(false);
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it("al desmontar deja de escuchar", () => {
    const { unmount } = render(<Pantalla hayCambios />);
    unmount();

    expect(disparaBeforeUnload().defaultPrevented).toBe(false);
  });
});
