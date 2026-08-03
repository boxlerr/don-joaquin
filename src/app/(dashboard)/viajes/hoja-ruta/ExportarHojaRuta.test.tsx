import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ExportarHojaRuta from "./ExportarHojaRuta";

/**
 * Lo que importa de este componente es la URL que le arma al endpoint de export:
 * es el contrato con /viajes/hoja-ruta/export.
 */

const CHOFER_ID = "f423d72e-4cf1-4a4d-b6d2-186728089e62";

function abrir(props: Partial<React.ComponentProps<typeof ExportarHojaRuta>> = {}) {
  render(
    <ExportarHojaRuta
      mes="2026-07"
      choferId={CHOFER_ID}
      choferLabel="PEREZ, Juan"
      {...props}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /Exportar a Excel/ }));
}

const linkDescargar = () => screen.queryByRole("link", { name: /Descargar/ });

describe("ExportarHojaRuta", () => {
  it("por defecto baja el mes que se está viendo, con todos los choferes", () => {
    abrir();
    expect(linkDescargar()).toHaveAttribute("href", "/viajes/hoja-ruta/export?mes=2026-07");
  });

  it("histórico", () => {
    abrir({ mes: "total" });
    expect(linkDescargar()).toHaveAttribute("href", "/viajes/hoja-ruta/export?mes=total");
  });

  it("una sola hoja: la del chofer abierto", () => {
    abrir();
    fireEvent.click(screen.getByRole("button", { name: "Solo PEREZ" }));
    expect(linkDescargar()).toHaveAttribute(
      "href",
      `/viajes/hoja-ruta/export?mes=2026-07&chofer=${CHOFER_ID}`,
    );
  });

  it("sin chofer abierto, la opción de una sola hoja está deshabilitada", () => {
    abrir({ choferId: null, choferLabel: null });
    const btn = screen.getByRole("button", { name: "Un solo chofer" });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(linkDescargar()).toHaveAttribute("href", "/viajes/hoja-ruta/export?mes=2026-07");
  });

  it("por rango: propone el mes que se está viendo y manda desde/hasta", () => {
    abrir();
    fireEvent.click(screen.getByRole("button", { name: "Un rango" }));
    expect(linkDescargar()).toHaveAttribute(
      "href",
      "/viajes/hoja-ruta/export?desde=2026-07-01&hasta=2026-07-31",
    );
  });

  it("rango editado a mano, de un solo chofer", () => {
    abrir();
    fireEvent.click(screen.getByRole("button", { name: "Un rango" }));
    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2026-05-10" } });
    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2026-07-15" } });
    fireEvent.click(screen.getByRole("button", { name: "Solo PEREZ" }));
    expect(linkDescargar()).toHaveAttribute(
      "href",
      `/viajes/hoja-ruta/export?desde=2026-05-10&hasta=2026-07-15&chofer=${CHOFER_ID}`,
    );
  });

  it("rango dado vuelta: no deja descargar y lo dice", () => {
    abrir();
    fireEvent.click(screen.getByRole("button", { name: "Un rango" }));
    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2026-07-15" } });
    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2026-05-10" } });
    expect(linkDescargar()).toBeNull();
    expect(screen.getByText(/posterior a la del final/)).toBeInTheDocument();
  });

  it("rango a medio completar: tampoco deja descargar", () => {
    abrir();
    fireEvent.click(screen.getByRole("button", { name: "Un rango" }));
    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "" } });
    expect(linkDescargar()).toBeNull();
  });
});
