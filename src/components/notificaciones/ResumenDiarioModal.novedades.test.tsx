import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import ResumenDiarioModal, { novedadesNuevas } from "./ResumenDiarioModal";
import type { Novedad } from "@/lib/novedades";
import type { ResumenDiario } from "@/lib/resumen-diario";

/**
 * Las "Novedades del sistema" dentro del pop-up del día (pedido de Julián, 10/08).
 *
 * Las novedades ya no se leen de `@/lib/novedades` en el cliente: viajan en el
 * resumen, filtradas por permisos en el server (`getResumenDiario`). Por eso acá
 * van adentro del payload y no hace falta mockear el módulo.
 */

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const NOVEDADES: Novedad[] = [
  {
    id: "compliance-adjuntar",
    fecha: "2026-08-10",
    tipo: "arreglo",
    ver: "compliance",
    titulo: "Al renovar un vencimiento ya podés adjuntar el documento",
    detalle: "El papel queda guardado junto con la fecha nueva.",
    href: "/compliance",
  },
  {
    id: "vacaciones-tope",
    fecha: "2026-08-06",
    tipo: "mejora",
    ver: "choferes_vacaciones",
    titulo: "Vacaciones: se ve el tope de gente por semana",
  },
];

const RESUMEN: ResumenDiario = {
  total: 1,
  vencidos: 0,
  novedades: NOVEDADES,
  grupos: [
    {
      key: "vencimiento_docs",
      nombre: "Vencimiento de documentación",
      total: 1,
      vencidos: 0,
      atraso: [],
      items: [
        {
          id: "a1",
          titulo: "VTV — AH499ZZ",
          diasRestantes: 8,
          fecha: "2026-08-18",
          entidadId: "doc-1",
          href: "/camiones",
        },
      ],
    },
  ],
} as unknown as ResumenDiario;

function hoy(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function conResumen(resumen: ResumenDiario) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => resumen }));
}

beforeEach(() => {
  localStorage.clear();
  push.mockClear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ResumenDiarioModal — novedades del sistema", () => {
  it("muestra en el pop-up qué cambió en el sistema", async () => {
    conResumen(RESUMEN);

    await act(async () => {
      render(<ResumenDiarioModal userId="u1" nombre="Julián" />);
    });

    expect(screen.getByText("Novedades del sistema")).toBeTruthy();
    expect(
      screen.getByText(/Al renovar un vencimiento ya podés adjuntar el documento/i),
    ).toBeTruthy();
    expect(screen.getByText(/Vacaciones: se ve el tope de gente por semana/i)).toBeTruthy();
  });

  it("la novedad con destino lleva a la pantalla y cierra el pop-up", async () => {
    conResumen(RESUMEN);

    await act(async () => {
      render(<ResumenDiarioModal userId="u1" nombre="Julián" />);
    });

    const novedad = screen
      .getByText(/Al renovar un vencimiento ya podés adjuntar el documento/i)
      .closest("button");
    expect(novedad).not.toBeNull();

    await act(async () => {
      novedad!.click();
    });
    expect(push).toHaveBeenCalledWith("/compliance");
  });

  it("no pisa los vencimientos: el aviso del día sigue estando", async () => {
    // Las novedades son contexto, no una tarea. Si algún día empujan fuera de
    // la tarjeta lo que el pop-up viene a decir, esto lo caza.
    conResumen(RESUMEN);

    await act(async () => {
      render(<ResumenDiarioModal userId="u1" nombre="Julián" />);
    });

    // La tarjeta muestra el nombre corto; el entero, en el nombre accesible.
    expect(screen.getByText("Documentos")).toBeTruthy();
    expect(localStorage.getItem("dj_resumen_dia_u1")).toBe(hoy());
  });

  it("una novedad se anuncia una sola vez, pero la última queda a la vista", async () => {
    // El corazón del pedido "¿y cuándo haya muchas?": la lista no se repite
    // todas las mañanas hasta que se cae de la ventana.
    conResumen(RESUMEN);
    await act(async () => {
      render(<ResumenDiarioModal userId="u1" nombre="Julián" />);
    });
    expect(screen.getByText("Novedades del sistema")).toBeTruthy();
    expect(screen.getByText(/cambio nuevo|cambios nuevos/)).toBeTruthy();
    cleanup();

    // "Mañana": el pop-up del día vuelve a salir. La novedad ya no se anuncia
    // como nueva, pero el bloque sigue mostrando la última: sin eso el cartel se
    // quedaba sin nada que contar (Julián, 27/08/2026).
    localStorage.removeItem("dj_resumen_dia_u1");
    await act(async () => {
      render(<ResumenDiarioModal userId="u1" nombre="Julián" />);
    });
    expect(screen.getByText("Novedades del sistema")).toBeTruthy();
    expect(screen.getByText("Lo último que cambió")).toBeTruthy();
    expect(screen.queryByText(/cambios? nuevos?/)).toBeNull();
  });

  it("un día sin vencimientos pero con novedades igual abre el pop-up", async () => {
    // Si el pop-up sólo apareciera con algo pendiente, un cambio subido en una
    // semana tranquila no se anunciaba en ningún lado.
    conResumen({ total: 0, vencidos: 0, grupos: [], novedades: NOVEDADES });

    await act(async () => {
      render(<ResumenDiarioModal userId="u2" nombre="Bárbara" />);
    });

    expect(screen.getByText("Novedades del sistema")).toBeTruthy();
    expect(screen.getByText(/Todo en orden/i)).toBeTruthy();
  });

  it("sin nada pendiente y sin nada nuevo no molesta", async () => {
    conResumen({ total: 0, vencidos: 0, grupos: [], novedades: [] });

    await act(async () => {
      render(<ResumenDiarioModal userId="u3" nombre="Nico" />);
    });

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("novedadesNuevas", () => {
  it("deja afuera las que esta persona ya vio", () => {
    expect(novedadesNuevas(NOVEDADES, ["compliance-adjuntar"]).map((n) => n.id)).toEqual([
      "vacaciones-tope",
    ]);
  });

  it("sin marcas previas son todas nuevas", () => {
    expect(novedadesNuevas(NOVEDADES, []).length).toBe(2);
  });
});
