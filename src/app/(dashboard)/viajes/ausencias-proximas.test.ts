import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Quién no está es un dato de personas, y la action que lo devuelve es un
 * endpoint: cualquiera con sesión la puede llamar sin pasar por /viajes ni por
 * el tablero. El criterio (Julián, 21/08) es que las vacaciones las ve todo el
 * sistema, así que el piso es tener sesión — pero ES un piso, y este test está
 * para que no se caiga de vuelta a "no valida nada".
 */

vi.mock("@/lib/auth", () => ({
  requireUser: vi.fn(async () => ({ id: "u1" })),
  requireArea: vi.fn(async () => ({ id: "u1" })),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAusenciasProximasAction } from "./actions";

/** Cadena thenable: hacer await en cualquier eslabón resuelve el resultado. */
function makeSupabaseMock(data: unknown[]) {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "is", "lte", "gte", "order"] as const) {
    chain[m] = vi.fn(() => chain);
  }
  (chain as { then?: unknown }).then = (resolve: (v: unknown) => void) =>
    resolve({ data, error: null });
  return { from: vi.fn(() => chain) };
}

describe("getAusenciasProximasAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sin sesión no devuelve nada ni llega a consultar la base", async () => {
    // requireUser redirige al login: en una server action eso viaja como throw.
    (requireUser as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("NEXT_REDIRECT"));

    await expect(getAusenciasProximasAction(14)).rejects.toThrow();
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("con sesión devuelve las ausencias, sin pedir permiso de personal", async () => {
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(
      makeSupabaseMock([
        {
          id: "a1",
          chofer_id: "c1",
          tipo: "Vacaciones",
          es_vacaciones: true,
          fecha_aproximada: false,
          fecha_inicio: "2020-01-01",
          fecha_fin: "2999-12-31",
          choferes: { nombre: "Jorge", apellido: "Schwindt", estado: "activo", es_demo: false },
          autorizado: null,
        },
      ]),
    );

    const res = await getAusenciasProximasAction(14);

    expect(requireUser).toHaveBeenCalled();
    expect(res).toHaveLength(1);
    expect(res[0].chofer_nombre).toBe("Schwindt, Jorge");
    expect(res[0].en_curso).toBe(true);
  });

  it("deja afuera a los egresados y a los legajos de demo", async () => {
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(
      makeSupabaseMock([
        {
          id: "a2",
          chofer_id: "c2",
          tipo: "Vacaciones",
          es_vacaciones: true,
          fecha_aproximada: false,
          fecha_inicio: "2020-01-01",
          fecha_fin: "2999-12-31",
          choferes: { nombre: "Ex", apellido: "Chofer", estado: "baja", es_demo: false },
          autorizado: null,
        },
        {
          id: "a3",
          chofer_id: "c3",
          tipo: "Vacaciones",
          es_vacaciones: true,
          fecha_aproximada: false,
          fecha_inicio: "2020-01-01",
          fecha_fin: "2999-12-31",
          choferes: { nombre: "Demo", apellido: "Prueba", estado: "activo", es_demo: true },
          autorizado: null,
        },
      ]),
    );

    expect(await getAusenciasProximasAction(14)).toHaveLength(0);
  });
});
