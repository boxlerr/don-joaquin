import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the admin client module
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import { createAdminClient } from "@/lib/supabase/admin";
import { getViajesAction } from "./actions";

function makeSupabaseMock(overrides: {
  data?: unknown[];
  count?: number;
  error?: { message: string } | null;
} = {}) {
  const { data = [], count = 0, error = null } = overrides;

  const result = { data, count, error };
  // Chain donde cada método devuelve el mismo objeto, y el objeto es "thenable":
  // hacer await en cualquier punto de la cadena resuelve el resultado. Necesario
  // porque getViajesAction sigue encadenando filtros (.neq, .eq, ...) DESPUÉS de
  // .range(), así que el método terminal varía.
  const chain: Record<string, unknown> = {};
  const methods = ["select", "eq", "neq", "gte", "lte", "in", "ilike", "or", "order", "range"] as const;
  for (const m of methods) {
    chain[m] = vi.fn(() => chain);
  }
  (chain as { then?: unknown }).then = (resolve: (v: unknown) => void) => resolve(result);

  return {
    from: vi.fn(() => chain),
  };
}

describe("getViajesAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns paginated data on success", async () => {
    const row = {
      id: "1",
      codigo: "VJ-001",
      fecha_viaje: "2024-01-15",
      km_con_carga: 300,
      km_vacios: 50,
      estado: "cerrado",
      facturado: true,
      origen: { nombre: "Rosario" },
      destino: { nombre: "Buenos Aires" },
    };
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(
      makeSupabaseMock({ data: [row], count: 1 })
    );

    const result = await getViajesAction({ page: 0, pageSize: 20 });

    expect("error" in result).toBe(false);
    if ("data" in result) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe("1");
      expect(result.data[0].origen).toBe("Rosario");
      expect(result.data[0].destino).toBe("Buenos Aires");
      expect(result.data[0].km_totales).toBe(350);
      expect(result.hasMore).toBe(false);
      expect(result.count).toBe(1);
    }
  });

  it("returns hasMore=true when more pages exist", async () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({
      id: String(i),
      codigo: `VJ-00${i}`,
      fecha_viaje: "2024-01-15",
      km_con_carga: 100,
      km_vacios: 10,
      estado: "cerrado",
      facturado: false,
      origen: null,
      destino: null,
    }));
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(
      makeSupabaseMock({ data: rows, count: 50 })
    );

    const result = await getViajesAction({ page: 0, pageSize: 20 });

    expect("data" in result && result.hasMore).toBe(true);
  });

  it("returns error when supabase fails", async () => {
    const mockClient = makeSupabaseMock({ error: { message: "DB error" } });
    // Patch range to return awaitable with error
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(mockClient);

    const result = await getViajesAction({});

    expect("error" in result).toBe(true);
  });

  it("maps null origen/destino to null", async () => {
    const row = {
      id: "2",
      codigo: "VJ-002",
      fecha_viaje: "2024-02-01",
      km_con_carga: 200,
      km_vacios: 0,
      estado: "pendiente",
      facturado: false,
      origen: null,
      destino: null,
    };
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(
      makeSupabaseMock({ data: [row], count: 1 })
    );

    const result = await getViajesAction({});

    if ("data" in result) {
      expect(result.data[0].origen).toBeNull();
      expect(result.data[0].destino).toBeNull();
    }
  });
});
