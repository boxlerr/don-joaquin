import { describe, it, expect, vi } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import TabAumentos from "./TabAumentos";
import type { AumentoClienteHist } from "./actions-aumentos";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.ComponentProps<"a">) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("./actions-aumentos", () => ({
  obtenerAumentosClientes: vi.fn(async () => []),
  eliminarAumentoClienteTarifasAction: vi.fn(async () => ({ ok: true })),
}));

vi.mock("./CargarAumentoDialog", () => ({
  default: () => null,
}));

// Recharts no aporta nada en jsdom (mide el contenedor y no dibuja).
vi.mock("recharts", () => {
  const Nulo = () => null;
  return {
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    ComposedChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Bar: Nulo, Line: Nulo, XAxis: Nulo, YAxis: Nulo, CartesianGrid: Nulo, Tooltip: Nulo,
  };
});

/** Primer día del mes, `delta` meses respecto de hoy (los cálculos de la tab
 *  usan "últimos 12 meses" desde la fecha real). */
function mes(delta: number): string {
  const hoy = new Date();
  const d = new Date(hoy.getFullYear(), hoy.getMonth() + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

let nextId = 0;
function aumento(overrides: Partial<AumentoClienteHist>): AumentoClienteHist {
  nextId += 1;
  return {
    id: `a-${nextId}`,
    clienteId: null,
    clienteNombre: "LOMA NEGRA",
    vigenteDesde: mes(-1),
    porcentaje: 3,
    observaciones: null,
    createdAt: "2026-07-01T12:00:00Z",
    createdByNombre: "Julian",
    ...overrides,
  };
}

const CLIENTES = [{ id: "cli-1", nombre: "LOMA NEGRA" }];

// LOMA: dos aumentos del 10% en la ventana de 12 meses y uno viejo del 50%
// (afuera del interanual, adentro del total). YPF: un solo interanual del 40,17%.
const DATA: AumentoClienteHist[] = [
  aumento({ clienteNombre: "LOMA NEGRA", vigenteDesde: mes(-20), porcentaje: 50 }),
  aumento({ clienteNombre: "LOMA NEGRA", vigenteDesde: mes(-2), porcentaje: 10 }),
  aumento({ clienteNombre: "LOMA NEGRA", vigenteDesde: mes(-1), porcentaje: 10 }),
  aumento({
    clienteNombre: "YPF",
    vigenteDesde: mes(-3),
    porcentaje: 40.17,
    observaciones: "Interanual abr-25→abr-26 (arena Ibicuy a Añelo)",
  }),
];

describe("TabAumentos", () => {
  it("agrupa por cliente y compone interanual (12m) y acumulado total", () => {
    render(<TabAumentos aumentosIniciales={DATA} clientes={CLIENTES} canWrite />);

    // Lista: ambos clientes, ordenados por interanual desc (YPF 40,2 > LOMA 21).
    const lista = screen.getByText("Clientes con aumentos").parentElement!;
    const botones = within(lista).getAllByRole("button");
    expect(botones[0]).toHaveTextContent("YPF");
    expect(botones[0]).toHaveTextContent("+40,2%");
    expect(botones[1]).toHaveTextContent("LOMA NEGRA");
    expect(botones[1]).toHaveTextContent("+21%");
    expect(botones[1]).toHaveTextContent("3 aumentos");

    // Detalle por defecto: el primero (YPF), solo interanual.
    expect(screen.getByText("Interanual (12m)").parentElement!.parentElement)
      .toHaveTextContent("+40,2%");
    expect(screen.getByText("solo interanual")).toBeInTheDocument();
    expect(screen.getAllByText("Interanual").length).toBeGreaterThan(0); // badge en la fila
  });

  it("selecciona el cliente del link de métricas y muestra su historial completo", () => {
    render(
      <TabAumentos
        aumentosIniciales={DATA}
        clientes={CLIENTES}
        initialCliente="LOMA NEGRA"
        canWrite
      />,
    );

    // Interanual: 1,10 × 1,10 = +21%. Total: × 1,50 viejo = +81,5%.
    expect(screen.getByText("Interanual (12m)").parentElement!.parentElement)
      .toHaveTextContent("+21%");
    expect(screen.getByText("Acumulado total").parentElement!.parentElement)
      .toHaveTextContent("+81,5%");
    expect(screen.getByText("Aumentos cargados").parentElement!.parentElement)
      .toHaveTextContent("3");

    // Historial con quién lo cargó y botón de eliminar (canWrite).
    expect(screen.getAllByText(/Julian/).length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("Eliminar aumento").length).toBe(3);
  });

  it("cambia de cliente al hacer click en la lista", () => {
    render(<TabAumentos aumentosIniciales={DATA} clientes={CLIENTES} canWrite />);
    fireEvent.click(screen.getByRole("button", { name: /LOMA NEGRA/ }));
    expect(screen.getByText("Acumulado total").parentElement!.parentElement)
      .toHaveTextContent("+81,5%");
  });

  it("sin permiso de escritura no muestra cargar ni eliminar", () => {
    render(<TabAumentos aumentosIniciales={DATA} clientes={CLIENTES} canWrite={false} />);
    expect(screen.queryByText("Cargar aumento")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Eliminar aumento")).not.toBeInTheDocument();
  });

  it("muestra el estado vacío cuando no hay aumentos", () => {
    render(<TabAumentos aumentosIniciales={[]} clientes={CLIENTES} canWrite />);
    expect(screen.getByText(/Aún no hay aumentos de clientes/)).toBeInTheDocument();
  });
});
