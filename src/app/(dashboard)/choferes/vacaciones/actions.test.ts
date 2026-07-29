import { describe, it, expect, vi, beforeEach } from "vitest";

// Requisito duro (Julián, 29/07/2026): "lo que modificó o agregó un usuario NO
// SE TOCA". Estos tests son la prueba de que se cumple en el proceso automático
// más peligroso que hay — el botón que reescribe los días de TODA la dotación
// activa de una sola pasada. El 22/07 un proceso así dejó 14 legajos rotos.

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireSeccion: vi.fn(async () => ({ id: "u1" })) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const logChoferAudit = vi.fn(async () => {});
vi.mock("../audit", () => ({ logChoferAudit: (...a: unknown[]) => logChoferAudit(...(a as [])) }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn(async () => {}) }));

import { createAdminClient } from "@/lib/supabase/admin";
import { recalcularDiasPorAntiguedadAction } from "./actions";

type FilaAnio = { chofer_id: string; dias_correspondientes: number; origen: string | null };

/**
 * Supabase falso: `from(tabla)` devuelve una cadena thenable que resuelve según
 * la tabla. Los upserts se guardan para poder mirar QUÉ se iba a escribir, que
 * es lo único que importa acá.
 */
function makeSupabaseMock(choferes: { id: string; fecha_ingreso: string | null }[], anios: FilaAnio[]) {
  const upserts: Record<string, unknown>[][] = [];
  const from = vi.fn((tabla: string) => {
    let esUpsert = false;
    const chain: Record<string, unknown> = {};
    for (const m of ["select", "eq", "order", "in", "is", "not"]) chain[m] = vi.fn(() => chain);
    chain.upsert = vi.fn((filas: Record<string, unknown>[]) => {
      esUpsert = true;
      upserts.push(filas);
      return chain;
    });
    (chain as { then?: unknown }).then = (resolve: (v: unknown) => void) => {
      if (esUpsert) return resolve({ error: null });
      if (tabla === "choferes") return resolve({ data: choferes });
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

const ANIO = new Date().getFullYear();

describe("recalcularDiasPorAntiguedadAction — blindaje de lo humano", () => {
  it("no pisa la fila que cargó una persona, aunque no coincida con la ley", async () => {
    // Dos empleados con la misma antigüedad (>10 años ⇒ 28 por ley) y los mismos
    // días mal cargados. El único que se toca es el que puso un automático.
    const { mock, upserts } = makeSupabaseMock(
      [
        { id: "humano", fecha_ingreso: `${ANIO - 12}-01-10` },
        { id: "maquina", fecha_ingreso: `${ANIO - 12}-01-10` },
      ],
      [
        { chofer_id: "humano", dias_correspondientes: 16, origen: "humano" },
        { chofer_id: "maquina", dias_correspondientes: 16, origen: "conciliacion" },
      ],
    );
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(mock);

    const res = await recalcularDiasPorAntiguedadAction();

    expect(res).toMatchObject({ success: true, actualizados: 1, respetados: 1 });
    expect(upserts).toHaveLength(1);
    expect(upserts[0]).toHaveLength(1);
    expect(upserts[0]![0]).toMatchObject({
      chofer_id: "maquina",
      dias_correspondientes: 28,
      origen: "antiguedad",
    });
  });

  it("registra en la auditoría lo que NO tocó, no sólo lo que cambió", async () => {
    // Sin esto la regla funciona pero es invisible: nadie podría probar después
    // que el sistema defendió el dato.
    const { mock } = makeSupabaseMock(
      [{ id: "humano", fecha_ingreso: `${ANIO - 12}-01-10` }],
      [{ chofer_id: "humano", dias_correspondientes: 16, origen: "humano" }],
    );
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(mock);

    await recalcularDiasPorAntiguedadAction();

    const protegido = logChoferAudit.mock.calls.find(
      (c) => (c as unknown[])[1] === "vacaciones_saldo_protegido",
    ) as unknown[] | undefined;
    expect(protegido).toBeDefined();
    expect(protegido![2]).toMatchObject({ anio: ANIO, dias_correspondientes: 16 });
    expect(protegido![3]).toMatchObject({ dias_correspondientes_propuesto: 28 });
    expect(protegido![5]).toMatchObject({ tipo: "chofer_vacaciones_anio", id: `humano:${ANIO}` });
  });

  it("deja de escribir la procedencia en las observaciones (ahora vive en `origen`)", async () => {
    // La observación es el "por qué" que escribe una persona. Mientras el
    // sistema la usaba de marca de procedencia, un dato humano podía quedar con
    // el cartel de un proceso automático — el caso Alveira.
    const { mock, upserts } = makeSupabaseMock(
      [{ id: "c1", fecha_ingreso: `${ANIO - 12}-01-10` }],
      [{ chofer_id: "c1", dias_correspondientes: 16, origen: "antiguedad" }],
    );
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(mock);

    await recalcularDiasPorAntiguedadAction();

    expect(upserts[0]![0]).toMatchObject({ observaciones: null });
  });

  it("una fila sin origen registrado se trata como automática (default de la tabla)", async () => {
    const { mock, upserts } = makeSupabaseMock(
      [{ id: "c1", fecha_ingreso: `${ANIO - 12}-01-10` }],
      [{ chofer_id: "c1", dias_correspondientes: 16, origen: null }],
    );
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(mock);

    const res = await recalcularDiasPorAntiguedadAction();
    expect(res).toMatchObject({ actualizados: 1, respetados: 0 });
    expect(upserts[0]![0]).toMatchObject({ dias_correspondientes: 28 });
  });
});
