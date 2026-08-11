import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { ACCION_LABELS, accionLabel, accionTono } from "./audit-catalog";

// El panel de Auditoría se arma con este catálogo: `accionLabel` cae al slug
// crudo si falta la entrada, y el filtro "Todas las acciones" se genera de
// ACCION_LABELS, así que una acción sin etiqueta no se puede ni filtrar.
// Pasó con `importar_hoja_ruta` (10/08): el import de 1.427 viajes figuraba como
// "importar_hoja_ruta" en ámbar y no aparecía en el desplegable. Este test
// recorre el código y obliga a etiquetar cada acción nueva.

const SRC = path.resolve(__dirname, "..");

function archivosTs(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) archivosTs(full, out);
    else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(full);
  }
  return out;
}

/** Todas las acciones que el código escribe en audit_log. */
function accionesUsadas(): Map<string, string> {
  const encontradas = new Map<string, string>();
  for (const file of archivosTs(SRC)) {
    const src = fs.readFileSync(file, "utf8");
    for (const m of src.matchAll(/accion:\s*"([a-z0-9_]+)"/g)) {
      if (!encontradas.has(m[1])) encontradas.set(m[1], path.relative(SRC, file));
    }
  }
  return encontradas;
}

describe("catálogo de auditoría", () => {
  it("toda acción que el código registra tiene etiqueta en español", () => {
    const sinEtiqueta = [...accionesUsadas()]
      .filter(([accion]) => !ACCION_LABELS[accion])
      .map(([accion, file]) => `${accion} (${file})`);
    expect(sinEtiqueta).toEqual([]);
  });

  it("los imports se leen como alta, no como edición", () => {
    // Un import crea filas: verde, no el ámbar de "actualizar".
    expect(accionTono("importar")).toBe("crear");
    expect(accionTono("importar_hoja_ruta")).toBe("crear");
    expect(accionLabel("importar_hoja_ruta")).toBe("Importación de hoja de ruta");
  });

  it("una acción desconocida no rompe el panel: cae al slug", () => {
    expect(accionLabel("accion_que_no_existe")).toBe("accion_que_no_existe");
  });
});
