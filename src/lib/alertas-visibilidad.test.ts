import { describe, it, expect } from "vitest";
import { seccionDeAlerta, visiblePara } from "./alertas-visibilidad";
import { COLUMNA_CONFIDENCIAL, COLUMNAS_TODAS, seccionDeColumna } from "./alertas-routing";
import type { CurrentUser } from "./auth";

/** Usuario mínimo: sólo importan las secciones para este filtro. */
function usuario(secciones: Record<string, string>): CurrentUser {
  return { id: "u1", secciones } as unknown as CurrentUser;
}

/** El de antes: sólo se le da (o no) préstamos. */
function conPrestamos(nivel: string): CurrentUser {
  return usuario({ prestamos: nivel });
}

const CUOTA = { tipo: "otro", entidad_tipo: "prestamo_cuota:vencido" };
const TOPE = { tipo: "otro", entidad_tipo: "prestamos_tope_mensual" };
const DOC = { tipo: "vencimiento_doc_camion", entidad_tipo: "camion_documentos" };
const CUMPLE = { tipo: "otro", entidad_tipo: "choferes_cumple" };
const CHEQUE = { tipo: "vencimiento_cheque", entidad_tipo: "cheques" };
const IMPUESTO = { tipo: "otro", entidad_tipo: "impuesto:vencido" };
const GASTO = { tipo: "gasto_sin_comprobante", entidad_tipo: null };

describe("seccionDeAlerta", () => {
  it("reconoce las de préstamos", () => {
    expect(seccionDeAlerta(CUOTA)).toBe("prestamos");
    expect(seccionDeAlerta(TOPE)).toBe("prestamos");
  });

  it("reconoce las otras confidenciales", () => {
    expect(seccionDeAlerta(CHEQUE)).toBe("cheques");
    expect(seccionDeAlerta(IMPUESTO)).toBe("impuestos");
    expect(seccionDeAlerta(GASTO)).toBe("gastos");
    // El recordatorio de cheque rechazado cae en la misma columna.
    expect(seccionDeAlerta({ tipo: "cheque_rechazado_recordatorio", entidad_tipo: null })).toBe(
      "cheques",
    );
  });

  it("no marca las que no lo son", () => {
    expect(seccionDeAlerta(DOC)).toBeNull();
    expect(seccionDeAlerta(CUMPLE)).toBeNull();
    expect(seccionDeAlerta({ tipo: "otro", entidad_tipo: null })).toBeNull();
    // Compliance y mantenimiento son de todos: no llevan plata propia de la empresa.
    expect(seccionDeAlerta({ tipo: "vencimiento_compliance", entidad_tipo: "compliance:T30" })).toBeNull();
    expect(seccionDeAlerta({ tipo: "otro", entidad_tipo: "insumo_precio_desactualizado" })).toBeNull();
  });

  it("no confunde un tipo que arranca parecido", () => {
    // Sólo `otro` con esos entidad_tipo; un tipo distinto no cuenta.
    expect(seccionDeAlerta({ tipo: "vencimiento_prestamo", entidad_tipo: "prestamo_cuota" })).toBeNull();
  });
});

/**
 * Guardarraíl: una columna nueva no puede nacer sin que alguien haya decidido si es
 * confidencial. Si se agrega una a COLUMNAS_TODAS, este test rompe hasta que se la
 * ponga en COLUMNA_CONFIDENCIAL o acá abajo, a mano. El default silencioso sería
 * "pública", que es el que dejó los montos de préstamos saliendo por mail.
 */
const COLUMNAS_PUBLICAS = [
  "vencimiento_docs", // vencimientos de documentación de choferes y camiones
  "nuevo_viaje", // operación diaria
  "vencimiento_compliance", // requisitos de Loma Negra / YPF y el F931
  "mantenimiento", // services e insumos del catálogo
  "rrhh_eventos", // cumpleaños y aniversarios
  "ausencias_vacaciones", // quién no va a estar
  "otros_avisos", // el cajón final
];

describe("COLUMNA_CONFIDENCIAL", () => {
  it("clasifica TODAS las columnas: ninguna queda sin decidir", () => {
    const decididas = new Set([...Object.keys(COLUMNA_CONFIDENCIAL), ...COLUMNAS_PUBLICAS]);
    const sinDecidir = COLUMNAS_TODAS.filter((c) => !decididas.has(c));
    expect(sinDecidir).toEqual([]);
  });

  it("no clasifica una columna de las dos formas a la vez", () => {
    const dobles = COLUMNAS_PUBLICAS.filter((c) => c in COLUMNA_CONFIDENCIAL);
    expect(dobles).toEqual([]);
  });

  it("seccionDeColumna devuelve null para las públicas", () => {
    for (const c of COLUMNAS_PUBLICAS) expect(seccionDeColumna(c)).toBeNull();
  });
});

describe("visiblePara", () => {
  it("quien no tiene acceso a préstamos no ve sus alertas", () => {
    const puede = visiblePara(conPrestamos("sin_acceso"));
    expect(puede(CUOTA)).toBe(false);
    expect(puede(TOPE)).toBe(false);
  });

  it("pero sí ve todo lo demás", () => {
    const puede = visiblePara(conPrestamos("sin_acceso"));
    expect(puede(DOC)).toBe(true);
    expect(puede(CUMPLE)).toBe(true);
  });

  it("con permiso de lectura las ve", () => {
    const puede = visiblePara(conPrestamos("read"));
    expect(puede(CUOTA)).toBe(true);
    expect(puede(TOPE)).toBe(true);
  });

  it("con permiso de escritura también", () => {
    const puede = visiblePara(conPrestamos("write"));
    expect(puede(TOPE)).toBe(true);
  });

  it("cada sección se resuelve por separado", () => {
    // Como Pablo: cheques e impuestos sí, gastos no.
    const puede = visiblePara(usuario({ cheques: "write", impuestos: "write", gastos: "none" }));
    expect(puede(CHEQUE)).toBe(true);
    expect(puede(IMPUESTO)).toBe(true);
    expect(puede(GASTO)).toBe(false);
  });

  it("sin ninguna sección confidencial sólo ve lo público", () => {
    const puede = visiblePara(usuario({}));
    expect(puede(CUOTA)).toBe(false);
    expect(puede(CHEQUE)).toBe(false);
    expect(puede(IMPUESTO)).toBe(false);
    expect(puede(GASTO)).toBe(false);
    expect(puede(DOC)).toBe(true);
    expect(puede(CUMPLE)).toBe(true);
  });
});
