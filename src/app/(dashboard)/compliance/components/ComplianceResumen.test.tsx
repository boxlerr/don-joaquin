import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  ComplianceMetricas,
  ComplianceCategorias,
  ComplianceFiltros,
  FILTROS_VACIOS,
  aplicaFiltroEstado,
  hayFiltros,
} from "./ComplianceResumen";
import type { ComplianceEstadoRow } from "../types";

/**
 * La cabecera de Compliance, con lo que ya funcionó en Legajos: las métricas
 * arriba y que sean el filtro.
 *
 * Antes la pantalla eran 739 documentos detrás de tres acordeones cerrados, un
 * buscador y un checkbox "Solo pendientes": para saber cuántas VTV estaban
 * vencidas había que abrir "Unidades" y contar a ojo.
 */

function fila(over: Partial<ComplianceEstadoRow>): ComplianceEstadoRow {
  return {
    requisito_id: "r1",
    requisito_codigo: "VTV",
    requisito_nombre: "VTV",
    cliente_aplica: "AMBOS",
    nivel: "unidad",
    chofer_id: null,
    chofer_nombre: null,
    camion_id: "u1",
    camion_patente: "AE228WV",
    documento_id: null,
    documento_fuente: null,
    fecha_vencimiento: null,
    archivo_id: null,
    observaciones: null,
    estado: "vencido",
    dias_restantes: -74,
    ...over,
  } as ComplianceEstadoRow;
}

const ROWS: ComplianceEstadoRow[] = [
  fila({ estado: "vencido" }),
  fila({ estado: "vencido", camion_patente: "AG018WE" }),
  fila({ estado: "vigente", camion_patente: "AH385OK" }),
  fila({
    requisito_codigo: "LICENCIA",
    requisito_nombre: "Licencia de conducir",
    nivel: "chofer",
    estado: "vigente",
    camion_patente: null,
    chofer_nombre: "Juarez, Gonzalo",
  }),
  fila({
    requisito_codigo: "LICENCIA",
    requisito_nombre: "Licencia de conducir",
    nivel: "chofer",
    estado: "faltante",
    camion_patente: null,
    chofer_nombre: "Valerga, Andrés",
  }),
];

afterEach(() => cleanup());

describe("aplicaFiltroEstado", () => {
  it("“pendientes” junta lo que exige una acción, y nada más", () => {
    expect(aplicaFiltroEstado("vencido", "pendientes")).toBe(true);
    expect(aplicaFiltroEstado("por_vencer", "pendientes")).toBe(true);
    expect(aplicaFiltroEstado("faltante", "pendientes")).toBe(true);
    expect(aplicaFiltroEstado("vigente", "pendientes")).toBe(false);
  });

  it("“todos” no filtra nada", () => {
    for (const e of ["vencido", "por_vencer", "faltante", "vigente"] as const) {
      expect(aplicaFiltroEstado(e, "todos")).toBe(true);
    }
  });
});

describe("ComplianceMetricas", () => {
  it("cuenta cada estado por separado", () => {
    render(<ComplianceMetricas rows={ROWS} filtros={FILTROS_VACIOS} onChange={vi.fn()} />);
    const tarjeta = (label: string) =>
      screen.getByText(label).closest("[class*='rounded']")!.textContent ?? "";
    expect(tarjeta("Total")).toContain("5");
    expect(tarjeta("Vencidos")).toContain("2");
    expect(tarjeta("Al día")).toContain("2");
    expect(tarjeta("Sin cargar")).toContain("1");
  });

  it("tocar una métrica FILTRA, no navega a otra pantalla", () => {
    const onChange = vi.fn();
    render(<ComplianceMetricas rows={ROWS} filtros={FILTROS_VACIOS} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Ver solo los vencidos"));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ estado: "vencido" }));
  });

  it("volver a tocar la misma métrica saca el filtro", () => {
    const onChange = vi.fn();
    render(
      <ComplianceMetricas
        rows={ROWS}
        filtros={{ ...FILTROS_VACIOS, estado: "vencido" }}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByLabelText("Ver solo los vencidos"));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ estado: "todos" }));
  });
});

describe("ComplianceCategorias", () => {
  it("ordena primero el tipo que peor está", () => {
    render(<ComplianceCategorias rows={ROWS} filtros={FILTROS_VACIOS} onChange={vi.fn()} />);
    const items = screen.getAllByRole("button");
    // VTV tiene 2 vencidas; licencias, ninguna.
    expect(items[0]!).toHaveTextContent("VTV");
    expect(items[0]!).toHaveTextContent("2 vencidos");
  });

  it("tocar un tipo lo filtra", () => {
    const onChange = vi.fn();
    render(<ComplianceCategorias rows={ROWS} filtros={FILTROS_VACIOS} onChange={onChange} />);
    fireEvent.click(screen.getByText("Licencia de conducir"));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ requisito: "LICENCIA" }));
  });
});

describe("ComplianceFiltros", () => {
  it("con un filtro puesto dice cuántos estás viendo y deja limpiarlo", () => {
    // Un filtro puesto y olvidado hace creer que faltan documentos.
    const onChange = vi.fn();
    render(
      <ComplianceFiltros
        filtros={{ ...FILTROS_VACIOS, estado: "vencido" }}
        onChange={onChange}
        requisitos={[{ codigo: "VTV", nombre: "VTV" }]}
        mostrados={2}
        total={5}
      />,
    );
    expect(screen.getByText(/Mostrando/)).toHaveTextContent("Mostrando 2 de 5");
    fireEvent.click(screen.getByText("Limpiar filtros"));
    expect(onChange).toHaveBeenCalledWith(FILTROS_VACIOS);
  });

  it("sin filtros no muestra el recuento (no hay nada que aclarar)", () => {
    render(
      <ComplianceFiltros
        filtros={FILTROS_VACIOS}
        onChange={vi.fn()}
        requisitos={[]}
        mostrados={5}
        total={5}
      />,
    );
    expect(screen.queryByText(/Mostrando/)).toBeNull();
    expect(hayFiltros(FILTROS_VACIOS)).toBe(false);
  });
});
