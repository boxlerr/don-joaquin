import { describe, it, expect } from "vitest";
import { seccionDeAlerta, visiblePara } from "./alertas-visibilidad";
import type { CurrentUser } from "./auth";

/** Usuario mínimo: sólo importan las secciones para este filtro. */
function usuario(nivelPrestamos: string): CurrentUser {
  return {
    id: "u1",
    secciones: { prestamos: nivelPrestamos },
  } as unknown as CurrentUser;
}

const CUOTA = { tipo: "otro", entidad_tipo: "prestamo_cuota:vencido" };
const TOPE = { tipo: "otro", entidad_tipo: "prestamos_tope_mensual" };
const DOC = { tipo: "vencimiento_doc_camion", entidad_tipo: "camion_documentos" };
const CUMPLE = { tipo: "otro", entidad_tipo: "choferes_cumple" };

describe("seccionDeAlerta", () => {
  it("reconoce las de préstamos", () => {
    expect(seccionDeAlerta(CUOTA)).toBe("prestamos");
    expect(seccionDeAlerta(TOPE)).toBe("prestamos");
  });

  it("no marca las que no lo son", () => {
    expect(seccionDeAlerta(DOC)).toBeNull();
    expect(seccionDeAlerta(CUMPLE)).toBeNull();
    expect(seccionDeAlerta({ tipo: "otro", entidad_tipo: null })).toBeNull();
  });

  it("no confunde un tipo que arranca parecido", () => {
    // Sólo `otro` con esos entidad_tipo; un tipo distinto no cuenta.
    expect(seccionDeAlerta({ tipo: "vencimiento_prestamo", entidad_tipo: "prestamo_cuota" })).toBeNull();
  });
});

describe("visiblePara", () => {
  it("quien no tiene acceso a préstamos no ve sus alertas", () => {
    const puede = visiblePara(usuario("sin_acceso"));
    expect(puede(CUOTA)).toBe(false);
    expect(puede(TOPE)).toBe(false);
  });

  it("pero sí ve todo lo demás", () => {
    const puede = visiblePara(usuario("sin_acceso"));
    expect(puede(DOC)).toBe(true);
    expect(puede(CUMPLE)).toBe(true);
  });

  it("con permiso de lectura las ve", () => {
    const puede = visiblePara(usuario("read"));
    expect(puede(CUOTA)).toBe(true);
    expect(puede(TOPE)).toBe(true);
  });

  it("con permiso de escritura también", () => {
    const puede = visiblePara(usuario("write"));
    expect(puede(TOPE)).toBe(true);
  });
});
