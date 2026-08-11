import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { ACCION_LABELS, ENTIDAD_LABELS, accionLabel, accionTono, entidadLabel } from "./audit-catalog";

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

/** Valores literales de `campo: "..."` en los archivos que escriben audit_log.
 *
 * El filtro por "audit_log" no es cosmético: `entidad_tipo` también lo usa el
 * motor de alertas (lib/alertas.ts) con valores propios —`choferes_cumple`,
 * `personal_aniversario`— que no van al panel de auditoría y no llevan etiqueta.
 * Alertas no escribe audit_log, así que alcanza con mirar los que sí. */
function literalesEnArchivosDeAuditoria(campo: string): Map<string, string> {
  const encontradas = new Map<string, string>();
  const re = new RegExp(`${campo}:\\s*"([a-z0-9_]+)"`, "g");
  for (const file of archivosTs(SRC)) {
    const src = fs.readFileSync(file, "utf8");
    if (!src.includes("audit_log")) continue;
    for (const m of src.matchAll(re)) {
      if (!encontradas.has(m[1])) encontradas.set(m[1], path.relative(SRC, file));
    }
  }
  return encontradas;
}

describe("catálogo de auditoría", () => {
  it("toda acción que el código registra tiene etiqueta en español", () => {
    const sinEtiqueta = [...literalesEnArchivosDeAuditoria("accion")]
      .filter(([accion]) => !ACCION_LABELS[accion])
      .map(([accion, file]) => `${accion} (${file})`);
    expect(sinEtiqueta).toEqual([]);
  });

  it("toda entidad auditada tiene etiqueta en español", () => {
    const sinEtiqueta = [...literalesEnArchivosDeAuditoria("entidad_tipo")]
      .filter(([entidad]) => !ENTIDAD_LABELS[entidad])
      .map(([entidad, file]) => `${entidad} (${file})`);
    expect(sinEtiqueta).toEqual([]);
  });

  it("las tres fuentes de un vencimiento de compliance están etiquetadas", () => {
    // Acá el entidad_tipo es una variable (`input.fuente` en
    // compliance/actions.ts), así que el escaneo de literales no las ve. Van a
    // mano: editar el vencimiento de un documento de chofer o de camión escribe
    // esos dos, y sin etiqueta el panel muestra el slug pelado.
    for (const fuente of ["compliance_documentos", "chofer_documentos", "camion_documentos"]) {
      expect(ENTIDAD_LABELS[fuente], `falta etiqueta de ${fuente}`).toBeTruthy();
    }
    expect(entidadLabel("chofer_documentos")).toBe("Documento de chofer");
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
