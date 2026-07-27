import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TabClientes from "./TabClientes";
import type { AumentoClienteHist } from "./actions-aumentos";
import type { TarifaConRelaciones } from "./actions";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.ComponentProps<"a">) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("./actions-aumentos", () => ({
  obtenerAumentosClientes: vi.fn(async () => []),
  eliminarAumentoClienteTarifasAction: vi.fn(async () => ({ ok: true })),
}));
vi.mock("./actions", () => ({
  obtenerTarifas: vi.fn(async () => []),
  cambiarEstadoTarifa: vi.fn(async () => ({ ok: true })),
  buscarTarifaAplicable: vi.fn(async () => null),
}));
vi.mock("./CargarAumentoDialog", () => ({ default: () => null }));
vi.mock("./ModalNuevaTarifa", () => ({ default: () => null }));
vi.mock("./TarifaHistorialDrawer", () => ({ default: () => null }));

// Recharts no aporta nada en jsdom (mide el contenedor y no dibuja).
vi.mock("recharts", () => {
  const Nulo = () => null;
  return {
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    ComposedChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Bar: Nulo, Line: Nulo, XAxis: Nulo, YAxis: Nulo, CartesianGrid: Nulo, Tooltip: Nulo,
  };
});

/** Primer día del mes, `delta` meses respecto de hoy (los cálculos usan
 *  "últimos 12 meses" desde la fecha real). */
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
const AUMENTOS: AumentoClienteHist[] = [
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

const TARIFAS = [
  {
    id: "t-1",
    cliente_nombre: "LOMA NEGRA",
    ruta_label: "Olavarría → Campana",
    ruta_km: 380,
    modalidad: "por_tonelada",
    valor: 12500,
    moneda: "ARS",
    vigencia_desde: "2026-01-01",
    vigencia_hasta: null,
    activa: true,
    observaciones: null,
  },
] as unknown as TarifaConRelaciones[];

const render1 = (props: Partial<React.ComponentProps<typeof TabClientes>> = {}) =>
  render(
    <TabClientes
      tarifasIniciales={TARIFAS}
      aumentosIniciales={AUMENTOS}
      clientes={CLIENTES}
      rutas={[]}
      canWrite
      {...props}
    />,
  );

describe("TabClientes", () => {
  it("lista los clientes con sus tarifas y aumentos juntos", () => {
    render1({ initialCliente: "LOMA NEGRA" });

    const loma = screen.getByRole("button", { name: /LOMA NEGRA/ });
    expect(loma).toHaveTextContent("+21%"); // 1,10 × 1,10
    expect(loma).toHaveTextContent("1 tarifa");
    expect(loma).toHaveTextContent("3 aumentos");

    const ypf = screen.getByRole("button", { name: /YPF/ });
    expect(ypf).toHaveTextContent("+40,2%");
    expect(ypf).toHaveTextContent("0 tarifas");
    expect(ypf).toHaveTextContent("1 aumento");
  });

  it("muestra tarifas y aumentos del cliente elegido en la misma pantalla", () => {
    render1({ initialCliente: "LOMA NEGRA" });

    // Interanual: 1,10 × 1,10 = +21%. Total: × 1,50 viejo = +81,5%.
    expect(screen.getByText("Interanual (12m)").parentElement!.parentElement).toHaveTextContent("+21%");
    expect(screen.getByText("Acumulado total").parentElement!.parentElement).toHaveTextContent("+81,5%");
    expect(screen.getByText("Aumentos cargados").parentElement!.parentElement).toHaveTextContent("3");

    // Las dos tablas conviven.
    expect(screen.getByText("Tarifas")).toBeInTheDocument();
    expect(screen.getByText("Olavarría → Campana")).toBeInTheDocument();
    expect(screen.getByText("Aumentos")).toBeInTheDocument();
    expect(screen.getAllByLabelText("Eliminar aumento")).toHaveLength(3);
  });

  it("un cliente con un solo aumento interanual se ve igual que el resto", () => {
    render1({ initialCliente: "YPF" });

    // Mismas tarjetas y mismo gráfico que Loma Negra: antes YPF no dibujaba nada
    // porque la serie descartaba los aumentos interanuales.
    expect(screen.getByText("Interanual (12m)").parentElement!.parentElement).toHaveTextContent("+40,2%");
    expect(screen.getByText("solo interanual")).toBeInTheDocument();
    expect(screen.getByText("Evolución de aumentos")).toBeInTheDocument();
    expect(screen.queryByText(/Todavía no hay aumentos cargados/)).not.toBeInTheDocument();
    // Y avisa que no tiene tarifas propias, en vez de esconder la sección.
    expect(screen.getByText(/no tiene tarifas propias/)).toBeInTheDocument();
  });

  it("cambia de cliente al hacer click en la lista", () => {
    render1({ initialCliente: "YPF" });
    fireEvent.click(screen.getByRole("button", { name: /LOMA NEGRA/ }));
    expect(screen.getByText("Acumulado total").parentElement!.parentElement).toHaveTextContent("+81,5%");
  });

  it("el rango del gráfico se puede acotar", () => {
    render1({ initialCliente: "LOMA NEGRA" });
    // "Todo" incluye el aumento de hace 20 meses; "12m" lo deja afuera.
    fireEvent.click(screen.getByRole("button", { name: "12m" }));
    expect(screen.getByRole("button", { name: "12m" })).toHaveClass("text-primary");
  });

  it("las dos acciones de alta viven separadas y se llaman distinto", () => {
    render1({ initialCliente: "LOMA NEGRA" });
    // "Nueva tarifa de cliente" va con el buscador; "Cargar aumento" con el
    // cliente elegido. Juntas se confundían entre sí.
    expect(screen.getByRole("button", { name: /Nueva tarifa de cliente/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cargar aumento/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^\+ ?Nueva tarifa$/ })).not.toBeInTheDocument();
  });

  it("sin permiso de escritura no ofrece cargar ni eliminar", () => {
    render1({ initialCliente: "LOMA NEGRA", canWrite: false });
    expect(screen.queryByText("Cargar aumento")).not.toBeInTheDocument();
    expect(screen.queryByText("Nueva tarifa de cliente")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Eliminar aumento")).not.toBeInTheDocument();
  });

  it("estado vacío cuando no hay ni tarifas ni aumentos", () => {
    render1({ tarifasIniciales: [], aumentosIniciales: [] });
    expect(screen.getByText(/Todavía no hay ningún cliente/)).toBeInTheDocument();
  });
});
