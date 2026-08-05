import { describe, it, expect } from "vitest";
import {
  OTROS_AVISOS,
  PRESTAMOS_COL,
  COLUMNAS_TODAS,
  COLUMNAS_ABIERTAS_DE_OTROS,
  alertaColumnaDe,
  alertaClave,
  esAlertaPrestamo,
  normalizarColumnas,
  tipoHabilitado,
} from "./alertas-routing";
import { seccionDeAlerta } from "./alertas-visibilidad";

/**
 * Inventario de TODO lo que hoy genera `lib/alertas.ts`, con la columna en la que
 * tiene que caer. Es el contrato entre el generador y la pantalla de
 * configuración: si se agrega un aviso nuevo allá y no se lo registra en
 * ENTIDAD_A_COLUMNA, este test lo caza acá en vez de que termine mudo dentro de
 * "Otros avisos" — que es exactamente cómo se perdieron impuestos, services,
 * cumpleaños, ausencias y el tope de préstamos.
 */
const INVENTARIO: { tipo: string; entidad_tipo: string; columna: string }[] = [
  // Documentación (se recalculan en vivo, pero el ruteo es el mismo)
  { tipo: "vencimiento_doc_camion", entidad_tipo: "camion_documentos", columna: "vencimiento_docs" },
  { tipo: "vencimiento_doc_chofer", entidad_tipo: "chofer_documentos", columna: "vencimiento_docs" },

  // Cheques
  { tipo: "vencimiento_cheque", entidad_tipo: "cheques", columna: "cheques_vencidos" },
  { tipo: "cheque_rechazado_recordatorio", entidad_tipo: "cheques", columna: "cheques_vencidos" },

  // Compliance (clientes, organismos y F931)
  { tipo: "vencimiento_compliance", entidad_tipo: "compliance:T30", columna: "vencimiento_compliance" },
  { tipo: "vencimiento_compliance", entidad_tipo: "compliance:vencido", columna: "vencimiento_compliance" },
  { tipo: "vencimiento_compliance", entidad_tipo: "organismo_compliance:T5", columna: "vencimiento_compliance" },
  { tipo: "vencimiento_compliance", entidad_tipo: "form931:vencido", columna: "vencimiento_compliance" },

  // Préstamos — confidencial, trae montos
  { tipo: "otro", entidad_tipo: "prestamo_cuota:T1", columna: PRESTAMOS_COL },
  { tipo: "otro", entidad_tipo: "prestamo_cuota:vencido", columna: PRESTAMOS_COL },
  { tipo: "otro", entidad_tipo: "prestamo_cuota:S:2026-08-03", columna: PRESTAMOS_COL },
  { tipo: "otro", entidad_tipo: "prestamos_tope_mensual", columna: PRESTAMOS_COL },

  // Finanzas
  { tipo: "otro", entidad_tipo: "impuesto:T15", columna: "impuestos" },
  { tipo: "otro", entidad_tipo: "impuesto:vencido", columna: "impuestos" },

  // Mantenimiento
  { tipo: "otro", entidad_tipo: "mantenimiento_proximo_service", columna: "mantenimiento" },
  { tipo: "otro", entidad_tipo: "insumo_precio_desactualizado", columna: "mantenimiento" },

  // RRHH — efemérides
  { tipo: "otro", entidad_tipo: "choferes_cumple", columna: "rrhh_eventos" },
  { tipo: "otro", entidad_tipo: "personal_cumple", columna: "rrhh_eventos" },
  { tipo: "otro", entidad_tipo: "choferes_aniversario", columna: "rrhh_eventos" },
  { tipo: "otro", entidad_tipo: "personal_aniversario", columna: "rrhh_eventos" },
  { tipo: "otro", entidad_tipo: "choferes_periodo_prueba", columna: "rrhh_eventos" },

  // RRHH — disponibilidad
  { tipo: "otro", entidad_tipo: "chofer_ausencia", columna: "ausencias_vacaciones" },
  { tipo: "otro", entidad_tipo: "choferes_vacaciones_saldo", columna: "ausencias_vacaciones" },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const alerta = (a: { tipo: string; entidad_tipo: string }) => a as any;

describe("alertaColumnaDe", () => {
  it.each(INVENTARIO)("$entidad_tipo → $columna", ({ tipo, entidad_tipo, columna }) => {
    expect(alertaColumnaDe(alerta({ tipo, entidad_tipo }))).toBe(columna);
  });

  it("ningún aviso que hoy se genera cae en 'Otros avisos'", () => {
    const huerfanos = INVENTARIO.filter(
      (a) => alertaColumnaDe(alerta(a)) === OTROS_AVISOS,
    ).map((a) => a.entidad_tipo);
    expect(huerfanos).toEqual([]);
  });

  it("todas las columnas del inventario existen en la matriz", () => {
    for (const { columna } of INVENTARIO) expect(COLUMNAS_TODAS).toContain(columna);
  });

  it("lo desconocido sí cae en 'Otros avisos' (red de seguridad, no se pierde)", () => {
    expect(alertaColumnaDe(alerta({ tipo: "otro", entidad_tipo: "algo_nuevo" }))).toBe(OTROS_AVISOS);
    expect(alertaColumnaDe(alerta({ tipo: "auditoria_cliente", entidad_tipo: "" }))).toBe(OTROS_AVISOS);
  });

  it("no confunde un entidad_tipo que arranca parecido", () => {
    expect(alertaColumnaDe(alerta({ tipo: "otro", entidad_tipo: "impuestos_otra_cosa" }))).toBe(
      OTROS_AVISOS,
    );
  });
});

describe("coherencia con la visibilidad confidencial", () => {
  it("todo lo que es de préstamos para la campana también lo es para el mail", () => {
    for (const a of INVENTARIO) {
      if (seccionDeAlerta(a) !== "prestamos") continue;
      expect(esAlertaPrestamo(a)).toBe(true);
      expect(alertaColumnaDe(alerta(a))).toBe(PRESTAMOS_COL);
    }
  });

  it("el tope mensual no se filtra por 'Otros avisos' (trae montos)", () => {
    const tope = { tipo: "otro", entidad_tipo: "prestamos_tope_mensual" };
    expect(seccionDeAlerta(tope)).toBe("prestamos");
    expect(alertaColumnaDe(alerta(tope))).toBe(PRESTAMOS_COL);
  });
});

describe("tipoHabilitado", () => {
  const cumple = alerta({ tipo: "otro", entidad_tipo: "choferes_cumple" });

  it("falla abierto: sin la fila del parámetro el aviso igual sale", () => {
    expect(tipoHabilitado(cumple, new Map())).toBe(true);
  });

  it("sólo un 'false' explícito lo apaga", () => {
    const off = new Map([[alertaClave("rrhh_eventos"), "false"]]);
    expect(tipoHabilitado(cumple, off)).toBe(false);

    const on = new Map([[alertaClave("rrhh_eventos"), "true"]]);
    expect(tipoHabilitado(cumple, on)).toBe(true);
  });

  it("apagar una categoría no apaga a las demás", () => {
    const off = new Map([[alertaClave("rrhh_eventos"), "false"]]);
    const cheque = alerta({ tipo: "vencimiento_cheque", entidad_tipo: "cheques" });
    expect(tipoHabilitado(cheque, off)).toBe(true);
  });
});

describe("normalizarColumnas", () => {
  it("quien tenía 'Otros avisos' hereda las categorías que salieron de ahí", () => {
    const res = normalizarColumnas(["cheques_vencidos", OTROS_AVISOS]);
    for (const k of COLUMNAS_ABIERTAS_DE_OTROS) expect(res).toContain(k);
    expect(res).toContain("cheques_vencidos");
  });

  it("no toca a quien nunca tuvo el cajón tildado", () => {
    expect(normalizarColumnas([PRESTAMOS_COL]).sort()).toEqual([PRESTAMOS_COL]);
  });

  it("respeta la elección del admin: si ya tocó una nueva, no re-agrega el resto", () => {
    const res = normalizarColumnas([OTROS_AVISOS, "impuestos"]);
    expect(res).toContain("impuestos");
    expect(res).not.toContain("mantenimiento");
  });

  it("es idempotente", () => {
    const una = normalizarColumnas([OTROS_AVISOS]);
    expect(normalizarColumnas(una).sort()).toEqual(una.sort());
  });
});
