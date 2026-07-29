import { describe, it, expect, vi, beforeEach } from "vitest";

// El otro lado del blindaje: lo que escribe la PANTALLA. Dos cosas que hay que
// poder probar sin abrir el navegador —
//   · el freno anti-negativo del servidor (Bárbara escribió 3 donde iban 21 y el
//     saldo quedó en −15; la pantalla avisa, pero el dato no puede depender de eso);
//   · que todo lo que guarda una persona queda marcado `origen: "humano"`, que es
//     lo único que después impide que un automático lo pise.

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  requireSeccion: vi.fn(async () => ({ id: "u1" })),
  requireArea: vi.fn(async () => ({ id: "u1" })),
  requireUser: vi.fn(async () => ({ id: "u1" })),
  requireAdmin: vi.fn(async () => ({ id: "u1" })),
  hasArea: vi.fn(async () => true),
  hasSeccion: vi.fn(async () => true),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const logChoferAudit = vi.fn(async () => {});
vi.mock("../audit", () => ({ logChoferAudit: (...a: unknown[]) => logChoferAudit(...(a as [])) }));

import { createAdminClient } from "@/lib/supabase/admin";
import { guardarSaldosAnioAction } from "./actions";

type Ausencia = { id: string; fecha_inicio: string; fecha_fin: string; anio_cargo: number };

function makeSupabaseMock(
  anios: { anio: number; dias_correspondientes: number; observaciones: string | null }[],
  ausencias: Ausencia[],
) {
  const upserts: Record<string, unknown>[][] = [];
  const from = vi.fn((tabla: string) => {
    let esUpsert = false;
    let esDelete = false;
    const chain: Record<string, unknown> = {};
    for (const m of ["select", "eq", "order", "in", "is", "not"]) chain[m] = vi.fn(() => chain);
    chain.upsert = vi.fn((filas: Record<string, unknown>[]) => {
      esUpsert = true;
      upserts.push(filas);
      return chain;
    });
    chain.delete = vi.fn(() => {
      esDelete = true;
      return chain;
    });
    (chain as { then?: unknown }).then = (resolve: (v: unknown) => void) => {
      if (esUpsert || esDelete) return resolve({ error: null });
      if (tabla === "chofer_ausencias") return resolve({ data: ausencias });
      return resolve({ data: anios });
    };
    return chain;
  });
  return { mock: { from }, upserts };
}

beforeEach(() => {
  vi.clearAllMocks();
  logChoferAudit.mockClear();
});

describe("guardarSaldosAnioAction", () => {
  it("no deja dejar un año por debajo de lo ya imputado", async () => {
    const { mock, upserts } = makeSupabaseMock(
      [{ anio: 2025, dias_correspondientes: 21, observaciones: null }],
      [{ id: "p1", fecha_inicio: "2026-02-01", fecha_fin: "2026-02-18", anio_cargo: 2025 }], // 18 días
    );
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(mock);

    const res = await guardarSaldosAnioAction("c1", [{ anio: 2025, dias: 3, observaciones: null }]);

    expect(res.error).toContain("No podés dejar el 2025 en 3 días");
    expect(res.error).toContain("18 días de vacaciones ya imputados");
    expect(upserts).toHaveLength(0); // no se escribió nada
  });

  it("SÍ deja subir un año que ya venía en negativo (los 6 casos rotos de hoy)", async () => {
    // Trejo: 16 otorgados con 16 imputados. Subirlo a 28 tiene que poder hacerse
    // aunque el año siga sin llegar a lo imputado en algún paso intermedio.
    const { mock, upserts } = makeSupabaseMock(
      [{ anio: 2025, dias_correspondientes: 16, observaciones: null }],
      [{ id: "p1", fecha_inicio: "2026-03-20", fecha_fin: "2026-04-08", anio_cargo: 2025 }], // 20 días
    );
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(mock);

    const res = await guardarSaldosAnioAction("c1", [{ anio: 2025, dias: 18, observaciones: null }]);

    expect(res).toMatchObject({ success: true });
    expect(upserts[0]![0]).toMatchObject({ anio: 2025, dias_correspondientes: 18 });
  });

  it("marca como humano lo que guarda una persona y no le inventa una observación", async () => {
    const { mock, upserts } = makeSupabaseMock(
      [{ anio: 2025, dias_correspondientes: 16, observaciones: null }],
      [],
    );
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(mock);

    await guardarSaldosAnioAction("c1", [{ anio: 2025, dias: 28, observaciones: null }]);

    // `origen: humano` es lo que blinda la fila; la observación queda vacía en
    // vez del viejo relleno "Editado manualmente", que la UI después devolvía
    // como si fuera un texto escrito por alguien.
    expect(upserts[0]![0]).toMatchObject({
      anio: 2025,
      dias_correspondientes: 28,
      origen: "humano",
      observaciones: null,
      updated_by: "u1",
    });
    expect(upserts[0]![0]!.updated_at).toBeTruthy();
  });

  it("audita también cuando lo único que cambia es la justificación", async () => {
    // Es la trazabilidad que pide Bárbara ("quiero que esté bien detallado
    // abajo"): antes el filtro comparaba sólo los días y esto no dejaba rastro.
    const { mock } = makeSupabaseMock(
      [{ anio: 2025, dias_correspondientes: 28, observaciones: null }],
      [],
    );
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(mock);

    await guardarSaldosAnioAction("c1", [
      { anio: 2025, dias: 28, observaciones: "Arrastre acordado con el chofer" },
    ]);

    const entrada = logChoferAudit.mock.calls.at(-1) as unknown[] | undefined;
    expect(entrada).toBeDefined();
    expect(entrada![1]).toBe("vacaciones_saldo_editado");
    expect(entrada![3]).toMatchObject({ observaciones: "Arrastre acordado con el chofer" });
    expect(entrada![5]).toMatchObject({ tipo: "chofer_vacaciones_anio", id: "c1:2025" });
  });
});
