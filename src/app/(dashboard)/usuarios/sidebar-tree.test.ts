import { describe, it, expect } from "vitest";
import { SIDEBAR_ARBOL, seccionesDelArbol } from "./sidebar-tree";
import { SECCIONES } from "@/lib/secciones";

describe("el árbol de permisos no puede dejar secciones afuera", () => {
  it("TODA sección del catálogo se puede otorgar desde la pantalla", () => {
    // Este test existe por un caso real (25/08/2026): se agregó la sección
    // "prevision" al catálogo y al sidebar, pero no acá. La pantalla quedó
    // publicada y confidencial, o sea invisible para todos y sin forma de
    // dársela a nadie. Una sección que no aparece acá es una pantalla muerta.
    const enElArbol = seccionesDelArbol();
    const faltan = SECCIONES.map((s) => s.codigo).filter((c) => !enElArbol.has(c));
    expect(faltan).toEqual([]);
  });

  it("no hay secciones repetidas en dos lugares del árbol", () => {
    // Repetida = dos interruptores para el mismo permiso, y uno miente.
    const todas: string[] = [];
    for (const g of SIDEBAR_ARBOL) {
      for (const p of g.paginas) {
        if (p.seccion) todas.push(p.seccion);
        for (const s of p.subs ?? []) todas.push(s.seccion);
      }
    }
    expect(todas.length).toBe(new Set(todas).size);
  });

  it("cada hoja del árbol existe en el catálogo", () => {
    const codigos = new Set(SECCIONES.map((s) => s.codigo));
    const inventadas = [...seccionesDelArbol()].filter((c) => !codigos.has(c));
    expect(inventadas).toEqual([]);
  });
});
