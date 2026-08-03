import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import ChequesList, { type ChequeRow } from "./ChequesList";

/**
 * Lo que importa acá es que un cheque nuestro y uno que recibimos no se
 * mezclen: era el reclamo concreto (un cheque propio sólo aparecía en "Todos").
 */

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("../actions", () => ({ eliminarChequeAction: vi.fn() }));

const base: ChequeRow = {
  id: "1",
  numero: null,
  tipo: "electronico",
  origen: "recibido",
  importe: 100,
  fecha_emision: null,
  fecha_vencimiento: "2026-08-05",
  librador_nombre: "Loma Negra",
  librador_cuit: null,
  concepto: null,
  estado: "cartera",
  entregado_a: null,
  sucursal_banco: null,
  cuenta_corriente: null,
  observaciones: null,
  banco: null,
  cliente: null,
};

const recibido: ChequeRow = { ...base, id: "r1", librador_nombre: "Loma Negra" };
const propio: ChequeRow = {
  ...base,
  id: "p1",
  origen: "propio",
  estado: "emitido",
  librador_nombre: "JOAQUIN HNOS SRL",
  entregado_a: "Gomeria del Centro",
  importe: 3000000,
};

function montar(cheques: ChequeRow[] = [recibido, propio]) {
  render(<ChequesList cheques={cheques} bancos={[]} libradores={[]} canWrite />);
}

const filas = () => screen.getAllByRole("row").slice(1); // sin el header
const textoDeFilas = () => filas().map((f) => f.textContent ?? "");

describe("ChequesList — separación por origen", () => {
  it("arranca en Recibidos y no muestra los cheques nuestros", () => {
    montar();
    expect(textoDeFilas().join()).toContain("Loma Negra");
    expect(textoDeFilas().join()).not.toContain("JOAQUIN HNOS SRL");
  });

  it("el tab Nuestros muestra el cheque propio y esconde el recibido", () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: /Nuestros/ }));
    expect(textoDeFilas().join()).toContain("JOAQUIN HNOS SRL");
    expect(textoDeFilas().join()).not.toContain("Loma Negra");
  });

  it("en Todos aparecen los dos, y el nuestro queda marcado", () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: /Todos\s*2/ }));
    const texto = textoDeFilas().join();
    expect(texto).toContain("Loma Negra");
    expect(texto).toContain("JOAQUIN HNOS SRL");
    expect(texto).toContain("Cheque nuestro");
  });

  it("los estados del segundo nivel cambian según el lado", () => {
    montar();
    expect(screen.getByRole("button", { name: "En cartera" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Emitidos" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Nuestros/ }));
    expect(screen.getByRole("button", { name: "Emitidos" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "En cartera" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Depositados" })).not.toBeInTheDocument();
  });

  it("un cheque nuestro muestra a quién se le entregó, no el cliente", () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: /Nuestros/ }));
    expect(textoDeFilas().join()).toContain("Gomeria del Centro");
  });
});

describe("ChequesList — acciones", () => {
  it("todo cheque se puede borrar, incluso uno anulado", () => {
    montar([{ ...recibido, estado: "anulado" }]);
    fireEvent.click(screen.getByRole("button", { name: "Acciones del cheque" }));
    expect(screen.getByRole("menuitem", { name: "Borrar cheque" })).toBeInTheDocument();
  });

  it("pide confirmación antes de borrar, con el librador y el importe", () => {
    montar([{ ...recibido, estado: "anulado", importe: 3000000 }]);
    fireEvent.click(screen.getByRole("button", { name: "Acciones del cheque" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Borrar cheque" }));

    const dialogo = screen.getByRole("dialog");
    expect(within(dialogo).getByText(/Borrar cheque/)).toBeInTheDocument();
    expect(dialogo.textContent).toContain("Loma Negra");
    expect(dialogo.textContent).toContain("3.000.000,00");
    expect(dialogo.textContent).toContain("no se puede deshacer");
  });

  it("un cheque nuestro se debita; nunca se deposita", () => {
    montar([propio]);
    fireEvent.click(screen.getByRole("button", { name: /Nuestros/ }));
    fireEvent.click(screen.getByRole("button", { name: "Acciones del cheque" }));
    expect(screen.getByRole("menuitem", { name: "Marcar como debitado" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /Depositar/ })).not.toBeInTheDocument();
  });

  it("un recibido en cartera se deposita; nunca se debita", () => {
    montar([recibido]);
    fireEvent.click(screen.getByRole("button", { name: "Acciones del cheque" }));
    expect(screen.getByRole("menuitem", { name: "Depositar en banco" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /debitado/ })).not.toBeInTheDocument();
  });
});
