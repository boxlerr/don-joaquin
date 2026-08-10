import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import ChoferesList from "./ChoferesList";
import type { DocsResumen } from "../filtros";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    storage: {
      from: () => ({ getPublicUrl: () => ({ data: { publicUrl: "" } }) }),
    },
  }),
}));

vi.mock("../actions", () => ({
  updateChoferEstadoAction: vi.fn(async () => ({ success: true })),
  reactivarChoferAction: vi.fn(async () => ({ success: true })),
  deleteChoferAction: vi.fn(async () => ({ success: true })),
  egresarChoferAction: vi.fn(async () => ({ success: true })),
  uploadFotoChoferAction: vi.fn(async () => ({ success: true })),
  deleteFotoChoferAction: vi.fn(async () => ({ success: true })),
}));

type ChoferTest = Parameters<typeof ChoferesList>[0]["choferes"][number];

function chofer(overrides: Partial<ChoferTest> = {}): ChoferTest {
  return {
    id: "c1",
    nombre: "Pablo Maximo",
    apellido: "Acosta",
    dni: "26157850",
    cuil: "20-26157850-7",
    telefono: "11-53296907",
    localidad: "CARLOS SPEGAZZINI",
    estado: "activo",
    rol: "chofer",
    fecha_ingreso: "2023-08-16",
    foto: null,
    camion_patente: "AF696CW",
    camion_marca: "Iveco",
    camion_modelo: null,
    ...overrides,
  };
}

const CHOFERES: ChoferTest[] = [
  chofer(),
  chofer({
    id: "c2",
    nombre: "Matías Adrián",
    apellido: "Albornoz",
    dni: "33044669",
    localidad: "AZUL",
    camion_patente: "AE972DC",
    camion_marca: "Scania",
  }),
  // Sin CUIL: legajo incompleto (bloqueante) y sin ningún documento cargado.
  chofer({
    id: "c3",
    nombre: "Juan Carlos",
    apellido: "Trejo",
    dni: "30511223",
    cuil: null,
    localidad: "OLAVARRIA",
    rol: "mantenimiento",
    camion_patente: null,
    camion_marca: null,
  }),
];

const DOCS: Record<string, DocsResumen> = {
  c1: { total: 5, vencidos: 2, porVencer: 1, alDia: 2 },
  c2: { total: 3, vencidos: 0, porVencer: 0, alDia: 3 },
  // c3 no aparece: no tiene ni un documento cargado.
};

const verTabla = () => fireEvent.click(screen.getByRole("button", { name: /Tabla/ }));

describe("ChoferesList — vista de tabla", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("arranca en tarjetas y cambia a tabla", () => {
    render(<ChoferesList choferes={CHOFERES} docsPorChofer={DOCS} />);

    // En tarjetas cada persona muestra sus datos de contacto etiquetados.
    expect(screen.getByText("CARLOS SPEGAZZINI")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();

    verTabla();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Documentos/ })).toBeInTheDocument();
  });

  it("recuerda la vista elegida", () => {
    const { unmount } = render(<ChoferesList choferes={CHOFERES} docsPorChofer={DOCS} />);
    verTabla();
    expect(window.localStorage.getItem("dj:legajos:vista")).toBe("tabla");
    unmount();

    render(<ChoferesList choferes={CHOFERES} docsPorChofer={DOCS} />);
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("distingue documentación vencida, al día y sin cargar", () => {
    render(<ChoferesList choferes={CHOFERES} docsPorChofer={DOCS} />);
    verTabla();

    const tabla = screen.getByRole("table");
    expect(within(tabla).getByText("2 vencidos")).toBeInTheDocument();
    expect(within(tabla).getByText("3 al día")).toBeInTheDocument();
    // Sin documentos NO es lo mismo que estar al día: es lo que hoy le pasa a
    // 24 de las 88 personas y el total es lo único que los separa.
    expect(within(tabla).getByText("Sin documentos")).toBeInTheDocument();
  });

  it("marca el legajo incompleto con lo que falta", () => {
    render(<ChoferesList choferes={CHOFERES} docsPorChofer={DOCS} />);
    verTabla();

    const tabla = screen.getByRole("table");
    expect(within(tabla).getByText(/Falta cuil/i)).toBeInTheDocument();
  });

  it("ordena por urgencia de documentación al clickear la columna", () => {
    render(<ChoferesList choferes={CHOFERES} docsPorChofer={DOCS} />);
    verTabla();

    const filas = () =>
      within(screen.getByRole("table"))
        .getAllByRole("row")
        .slice(1) // saltea el encabezado
        .map((f) => within(f).getAllByRole("cell")[0]!.textContent ?? "");

    // Por defecto, apellido A–Z.
    expect(filas()[0]).toContain("Acosta");

    fireEvent.click(screen.getByRole("button", { name: /Documentos/ }));
    // Acosta tiene 2 vencidos: manda. Trejo (sin ningún documento) va antes que
    // Albornoz, que está todo al día.
    const orden = filas();
    expect(orden[0]).toContain("Acosta");
    expect(orden[1]).toContain("Trejo");
    expect(orden[2]).toContain("Albornoz");
  });

  it("los accesos rápidos muestran el conteo y angostan la lista", () => {
    render(<ChoferesList choferes={CHOFERES} docsPorChofer={DOCS} />);

    // Acosta tiene 2 vencidos; los otros dos no.
    const vencidos = screen.getByRole("button", { name: /^Vencidos: 1\b/ });
    fireEvent.click(vencidos);

    expect(vencidos).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("1 de 3")).toBeInTheDocument();
    expect(screen.getByText("Acosta, Pablo Maximo")).toBeInTheDocument();
    expect(screen.queryByText("Albornoz, Matías Adrián")).not.toBeInTheDocument();
  });

  it("los accesos rápidos se acumulan en vez de sumar", () => {
    render(<ChoferesList choferes={CHOFERES} docsPorChofer={DOCS} />);

    fireEvent.click(screen.getByRole("button", { name: /^Vencidos: 1\b/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Sin documentos: 1\b/ }));

    // Nadie tiene documentos vencidos Y ningún documento a la vez.
    expect(screen.getByText("0 de 3")).toBeInTheDocument();
    expect(screen.getByText("Ningún chofer coincide con los filtros")).toBeInTheDocument();
  });

  it("elegir un área cambia el título, el total y los conteos rápidos", () => {
    render(<ChoferesList choferes={CHOFERES} docsPorChofer={DOCS} />);

    expect(screen.getByRole("heading", { name: "Todos en plantilla" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mantenimiento: 1" }));

    expect(screen.getByRole("heading", { name: "Mantenimiento en plantilla" })).toBeInTheDocument();
    expect(screen.getByText("1 de 1")).toBeInTheDocument();
    // Trejo (el de taller) no tiene documentos: el chip pasa a 1 de 1.
    expect(screen.getByRole("button", { name: /^Sin documentos: 1\b/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Vencidos: 0\b/ })).toBeInTheDocument();
  });

  it("los filtros avanzados cuentan grupos en el globito y filtran", () => {
    render(<ChoferesList choferes={CHOFERES} docsPorChofer={DOCS} />);

    fireEvent.click(screen.getByRole("button", { name: /Filtros avanzados/ }));
    fireEvent.click(screen.getByRole("button", { name: "AZUL: 1" }));

    expect(screen.getByText("1 de 3")).toBeInTheDocument();
    expect(screen.getByText("Albornoz, Matías Adrián")).toBeInTheDocument();
    // El globito cuenta grupos: una localidad puesta es un filtro.
    expect(screen.getByRole("button", { name: "Filtros avanzados: 1 puesto" })).toBeInTheDocument();
  });

  it("la barra oblicua enfoca el buscador (⌘K ya lo usa la paleta global)", () => {
    render(<ChoferesList choferes={CHOFERES} docsPorChofer={DOCS} />);
    const buscador = screen.getByLabelText("Buscar en los legajos");

    expect(document.activeElement).not.toBe(buscador);
    fireEvent.keyDown(window, { key: "/" });
    expect(document.activeElement).toBe(buscador);
  });

  it("se puede plegar la barra de filtros", () => {
    render(<ChoferesList choferes={CHOFERES} docsPorChofer={DOCS} />);
    expect(screen.getByLabelText("Buscar en los legajos")).toBeInTheDocument();

    fireEvent.click(screen.getByTitle("Ocultar los filtros"));
    expect(screen.queryByLabelText("Buscar en los legajos")).not.toBeInTheDocument();
    // El encabezado con el conteo sigue estando: plegar oculta los controles,
    // no la identidad de la sección.
    expect(screen.getByText("3 de 3")).toBeInTheDocument();
  });

  it("con un filtro avanzado que no da nada, NO dice que no hay nadie cargado", () => {
    render(<ChoferesList choferes={CHOFERES} docsPorChofer={DOCS} />);

    fireEvent.click(screen.getByRole("button", { name: /Filtros avanzados/ }));
    // Nadie tiene más de 10 años de antigüedad en los datos de prueba.
    fireEvent.click(screen.getByRole("button", { name: "Más de 10 años" }));

    expect(screen.getByText("Ningún chofer coincide con los filtros")).toBeInTheDocument();
    expect(screen.queryByText("Sin choferes registrados")).not.toBeInTheDocument();
  });

  it("la localidad elegida sigue visible aunque el área no la tenga", () => {
    render(<ChoferesList choferes={CHOFERES} docsPorChofer={DOCS} />);

    fireEvent.click(screen.getByRole("button", { name: /Filtros avanzados/ }));
    fireEvent.click(screen.getByRole("button", { name: "AZUL: 1" }));
    // AZUL es de un chofer; en Mantenimiento no vive nadie ahí. El panel queda
    // abierto (lo cierra un `mousedown` afuera, que `fireEvent.click` no manda).
    fireEvent.click(screen.getByRole("button", { name: "Mantenimiento: 1" }));

    // Si desapareciera, el globito diría "1 filtro" y adentro no habría nada
    // prendido: filtrando por algo invisible que no se puede sacar.
    const chip = screen.getByRole("button", { name: "AZUL: 0" });
    expect(chip).toHaveAttribute("aria-pressed", "true");
  });

  it("cuando el filtro deja sólo egresados, la lista no queda en blanco", () => {
    const conEgresado = [
      ...CHOFERES,
      chofer({ id: "c4", nombre: "Ex", apellido: "Zurita", dni: "20000000", estado: "baja" }),
    ];
    render(<ChoferesList choferes={conEgresado} docsPorChofer={DOCS} />);

    fireEvent.change(screen.getByLabelText("Buscar en los legajos"), {
      target: { value: "Zurita" },
    });

    // El historial arranca colapsado; con SÓLO egresados quedaba el contador
    // diciendo que había coincidencias y ni una fila dibujada.
    expect(screen.getByText("1 de 4")).toBeInTheDocument();
    expect(screen.getByText("Zurita, Ex")).toBeInTheDocument();
  });

  it("los accesos rápidos no cuentan a los egresados", () => {
    const conEgresado = [
      ...CHOFERES,
      chofer({
        id: "c4",
        nombre: "Ex",
        apellido: "Zurita",
        dni: "20000000",
        estado: "baja",
        telefono: null,
      }),
    ];
    render(<ChoferesList choferes={conEgresado} docsPorChofer={DOCS} />);

    // El egresado no tiene teléfono, pero no es un pendiente de carga: si el
    // chip lo contara, prometería 1 y la lista visible mostraría 0.
    expect(screen.getByRole("button", { name: /^Sin teléfono: 0\b/ })).toBeInTheDocument();
  });

  it("plegada, la barra sigue avisando que hay filtros puestos", () => {
    render(<ChoferesList choferes={CHOFERES} docsPorChofer={DOCS} />);

    fireEvent.click(screen.getByRole("button", { name: /^Vencidos: 1\b/ }));
    fireEvent.click(screen.getByTitle("Ocultar los filtros"));

    expect(screen.getByText("Hay 1 filtro puesto.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Limpiar 1 filtro/ }));
    expect(screen.queryByText(/Hay 1 filtro puesto/)).not.toBeInTheDocument();
  });

  it("da vuelta el orden por apellido al clickear dos veces la columna", () => {
    render(<ChoferesList choferes={CHOFERES} docsPorChofer={DOCS} />);
    verTabla();

    const primerApellido = () =>
      within(within(screen.getByRole("table")).getAllByRole("row")[1]!).getAllByRole("cell")[0]!
        .textContent ?? "";

    expect(primerApellido()).toContain("Acosta");
    fireEvent.click(screen.getByRole("button", { name: /Empleado/ }));
    expect(primerApellido()).toContain("Trejo");
  });
});
