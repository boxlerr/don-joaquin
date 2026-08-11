import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import ResumenDiarioModal from "./ResumenDiarioModal";
import type { ResumenDiario } from "@/lib/resumen-diario";

/**
 * Las "Novedades del sistema" dentro del pop-up del día (pedido de Julián, 10/08).
 *
 * Se mockea `@/lib/novedades` a propósito: la lista real se vacía sola con el
 * paso de los días (la ventana es de 10), y un test atado a ella empezaría a
 * fallar solo un martes cualquiera sin que nadie hubiera roto nada.
 */

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

vi.mock("@/lib/novedades", () => ({
  novedadesRecientes: () => [
    {
      fecha: "2026-08-10",
      titulo: "Al renovar un vencimiento ya podés adjuntar el documento",
      detalle: "El papel queda guardado junto con la fecha nueva.",
      href: "/compliance",
    },
    { fecha: "2026-08-06", titulo: "Vacaciones: se ve el tope de gente por semana" },
  ],
}));

const RESUMEN: ResumenDiario = {
  total: 1,
  vencidos: 0,
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
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => RESUMEN }));

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
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => RESUMEN }));

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
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => RESUMEN }));

    await act(async () => {
      render(<ResumenDiarioModal userId="u1" nombre="Julián" />);
    });

    expect(screen.getByText(/Vencimiento de documentación/i)).toBeTruthy();
    expect(localStorage.getItem("dj_resumen_dia_u1")).toBe(hoy());
  });
});
