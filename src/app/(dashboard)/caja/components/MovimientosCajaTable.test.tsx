import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import MovimientosCajaTable from "./MovimientosCajaTable";
import type { CajaMovimientoRow } from "../actions";

vi.mock("../actions", () => ({
  getCajaMovimientosAction: vi.fn(),
  setMovimientoPrivadoAction: vi.fn(),
}));

import { getCajaMovimientosAction } from "../actions";

const mockGet = getCajaMovimientosAction as ReturnType<typeof vi.fn>;

const BASE: CajaMovimientoRow = {
  id: "1",
  fecha: "2026-08-24",
  tipo: "egreso",
  categoria: "pago_proveedor",
  categoria_libre: null,
  tipo_gasto_nombre: "Cubiertas",
  concepto: "Dos cubiertas para el AG556LU",
  monto: 540000,
  medio: "efectivo",
  vinculado_a: null,
  usuario: "Bárbara",
  privado: false,
  caja: "diaria",
  destino: {
    href: "/mantenimiento",
    seccion: "Mantenimiento",
    area: "mantenimiento",
    requiereSeccion: "mantenimiento_servicios",
  },
};

function montar(rows: CajaMovimientoRow[]) {
  mockGet.mockResolvedValue({ data: rows, hasMore: false, count: rows.length });
  return render(
    <MovimientosCajaTable
      tiposGasto={[]}
      desde="2026-08-01"
      hasta="2026-08-31"
      onRangeChange={() => {}}
    />,
  );
}

describe("MovimientosCajaTable — el movimiento lleva a su sección", () => {
  beforeEach(() => vi.clearAllMocks());

  it("la fila entera es un link a la pantalla del tipo de movimiento", async () => {
    montar([BASE]);
    // Se dibuja dos veces (tabla en escritorio, tarjeta en celular): las dos
    // apuntan al mismo lado.
    const links = await screen.findAllByRole("link", {
      name: /Abrir en Mantenimiento: Dos cubiertas/,
    });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute("href", "/mantenimiento");
  });

  it("sin destino no hay link: no se promete un atajo que no existe", async () => {
    montar([{ ...BASE, id: "2", destino: null }]);
    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    await screen.findAllByText("Dos cubiertas para el AG556LU");
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("muestra la categoría escrita a mano en vez de 'Otro'", async () => {
    montar([
      {
        ...BASE,
        id: "3",
        tipo: "ingreso",
        categoria: "otro",
        categoria_libre: "Venta de chatarra",
        tipo_gasto_nombre: null,
        concepto: "Chatarra del taller",
      },
    ]);
    expect((await screen.findAllByText("Venta de chatarra")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Otro")).toBeNull();
  });
});
