import { describe, it, expect } from "vitest";
import { columnasBloqueadas, puedeRecibir } from "./alertas-permisos";
import { COLUMNA_CONFIDENCIAL } from "./alertas-routing";

/** Lo que devolvería `usuariosPorColumna`: columna → ids con acceso. */
function permitidos(porColumna: Record<string, string[]>): Map<string, Set<string>> {
  return new Map(Object.entries(porColumna).map(([c, ids]) => [c, new Set(ids)]));
}

const TODAS_CONFIDENCIALES = Object.keys(COLUMNA_CONFIDENCIAL);

describe("puedeRecibir", () => {
  it("una columna pública le llega a cualquiera", () => {
    expect(puedeRecibir("u1", "vencimiento_docs", new Map())).toBe(true);
    expect(puedeRecibir("u1", "rrhh_eventos", permitidos({ prestamos_vencimiento: [] }))).toBe(true);
  });

  it("una confidencial sólo a quien tiene la sección", () => {
    const p = permitidos({ prestamos_vencimiento: ["nico", "paula"] });
    expect(puedeRecibir("nico", "prestamos_vencimiento", p)).toBe(true);
    expect(puedeRecibir("paula", "prestamos_vencimiento", p)).toBe(true);
    expect(puedeRecibir("virginia", "prestamos_vencimiento", p)).toBe(false);
  });

  it("falla CERRADO: si la columna confidencial no se resolvió, no se manda", () => {
    // Pasa si la consulta de permisos falló o si el llamador olvidó pedirla. Un
    // mail de menos es preferible a los montos del banco en la casilla equivocada.
    for (const columna of TODAS_CONFIDENCIALES) {
      expect(puedeRecibir("u1", columna, new Map())).toBe(false);
    }
  });

  it("nadie con acceso = no le llega a nadie", () => {
    const p = permitidos({ cheques_vencidos: [] });
    expect(puedeRecibir("nico", "cheques_vencidos", p)).toBe(false);
  });
});

describe("columnasBloqueadas", () => {
  it("lista las confidenciales que la persona no tiene", () => {
    // Como Paula: cheques y préstamos sí, el resto no.
    const p = permitidos({
      prestamos_vencimiento: ["paula"],
      cheques_vencidos: ["paula"],
      impuestos: [],
      gastos_pendientes: [],
      cambios_caja: [],
      viaticos_sin_rendir: [],
      prevision_financiera: [],
    });
    expect(columnasBloqueadas("paula", p).sort()).toEqual(
      ["cambios_caja", "gastos_pendientes", "impuestos", "viaticos_sin_rendir", "prevision_financiera"].sort(),
    );
  });

  it("sin ninguna sección, todas las confidenciales quedan bloqueadas", () => {
    const p = permitidos(Object.fromEntries(TODAS_CONFIDENCIALES.map((c) => [c, []])));
    expect(columnasBloqueadas("u1", p).sort()).toEqual([...TODAS_CONFIDENCIALES].sort());
  });

  it("nunca bloquea una columna pública", () => {
    const bloqueadas = columnasBloqueadas("u1", new Map());
    expect(bloqueadas).not.toContain("vencimiento_docs");
    expect(bloqueadas).not.toContain("otros_avisos");
  });
});
