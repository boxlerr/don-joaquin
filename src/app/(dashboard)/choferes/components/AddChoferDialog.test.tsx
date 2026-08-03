import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import AddChoferDialog from "./AddChoferDialog";

vi.mock("../actions", () => ({
  addChoferAction: vi.fn(async () => ({ success: true })),
}));

const abrir = async () => {
  fireEvent.click(screen.getByText("Nuevo legajo"));
  await screen.findByText("Agregar nuevo legajo");
};

const renderDialog = () =>
  render(
    <AddChoferDialog>
      <button type="button">Nuevo legajo</button>
    </AddChoferDialog>,
  );

describe("AddChoferDialog", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("pide los datos que muestra el legajo, no solo los mínimos", async () => {
    renderDialog();
    await abrir();

    // Domicilio, provincia, banco y AFIP se cargaban después entrando a editar.
    expect(screen.getByPlaceholderText("Calle y número")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Ej: Buenos Aires")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("22 dígitos")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Ej: 00123456789")).toBeInTheDocument();
  });

  it("guarda borrador y lo retoma después de perder la pantalla", async () => {
    renderDialog();
    await abrir();

    fireEvent.change(screen.getByPlaceholderText("Ej: Juan"), { target: { value: "Nicolás" } });
    fireEvent.change(screen.getByPlaceholderText("Ej: Pérez"), { target: { value: "Quiroga" } });

    await waitFor(() => expect(localStorage.getItem("dj:legajo-nuevo:borrador")).not.toBeNull());

    // Se cierra la pestaña / se corta la luz: el componente arranca de cero.
    cleanup();
    renderDialog();
    await abrir();

    expect(screen.getByPlaceholderText("Ej: Juan")).toHaveValue("Nicolás");
    expect(screen.getByPlaceholderText("Ej: Pérez")).toHaveValue("Quiroga");
    expect(screen.getByText(/Retomamos el borrador/)).toBeInTheDocument();
  });

  it("aguanta la fecha de ingreso a medio cambiar", async () => {
    // El caso que rompía en producción: el input date pasa por "" mientras se
    // corrige la fecha, y el cálculo del período de prueba tiraba "Invalid time
    // value" en pleno render → se caía toda la pantalla.
    renderDialog();
    await abrir();

    const fecha = document.querySelector('input[name="fecha_ingreso"]') as HTMLInputElement;
    fireEvent.change(fecha, { target: { value: "" } });
    expect(screen.getByText("Agregar nuevo legajo")).toBeInTheDocument();
    expect(screen.getByText(/Se calcula cuando completes/)).toBeInTheDocument();

    fireEvent.change(fecha, { target: { value: "2026-07-14" } });
    expect(screen.getByText("14/07/2026")).toBeInTheDocument();
    expect(screen.getByText("14/01/2027")).toBeInTheDocument();
  });

  it("descartar el borrador limpia el formulario y lo guardado", async () => {
    renderDialog();
    await abrir();

    fireEvent.change(screen.getByPlaceholderText("Ej: Juan"), { target: { value: "Nicolás" } });
    await waitFor(() => expect(localStorage.getItem("dj:legajo-nuevo:borrador")).not.toBeNull());

    fireEvent.click(screen.getByText("Descartar"));

    expect(screen.getByPlaceholderText("Ej: Juan")).toHaveValue("");
    await waitFor(() => expect(localStorage.getItem("dj:legajo-nuevo:borrador")).toBeNull());
  });
});
