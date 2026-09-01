import { describe, it, expect } from "vitest";
import { reconciliarF931, resumen931, type Periodo931 } from "./estado-931";
import type { ComplianceEstadoRow } from "./types";

/**
 * El caso que reportó Julián el 01/09/2026: la pantalla decía **VENCIDOS 0 ·
 * Ninguno vencido** mientras el pop-up del día avisaba de **2 Formularios 931
 * vencidos**, uno de hacía 50 días y otro de 12.
 *
 * No eran dos números peleados sino dos fuentes del mismo trámite que no se
 * hablaban. Lo que se prueba acá es que la papeleta pasa a decir lo que dicen
 * sus períodos.
 */

const HOY = "2026-09-01";

const per = (
  fecha_limite: string,
  enviado_ypf = false,
  enviado_loma = false,
  periodo: string | null = null,
): Periodo931 => ({ fecha_limite, enviado_ypf, enviado_loma, periodo });

// Los dos períodos de la captura: uno venció hace 50 días y el otro hace 12.
const LOS_DOS_DE_LA_CAPTURA = [per("2026-07-13"), per("2026-08-20")];

function fila(codigo: string, estado: ComplianceEstadoRow["estado"]): ComplianceEstadoRow {
  return {
    requisito_id: `req-${codigo}`,
    requisito_codigo: codigo,
    requisito_nombre: codigo,
    cliente_aplica: "AMBOS",
    nivel: "empresa",
    dias_alerta: 30,
    periodicidad: "mensual",
    chofer_id: null,
    chofer_nombre: null,
    camion_id: null,
    camion_patente: null,
    documento_id: null,
    documento_fuente: null,
    fecha_vencimiento: null,
    archivo_id: null,
    estado,
    dias_restantes: null,
  } as ComplianceEstadoRow;
}

describe("resumen931", () => {
  it("los dos de la captura dan vencido, y manda la fecha más vieja", () => {
    const r = resumen931(LOS_DOS_DE_LA_CAPTURA, HOY);
    expect(r.pendientes).toBe(2);
    expect(r.vencidos).toBe(2);
    expect(r.estado).toBe("vencido");
    expect(r.fechaLimite).toBe("2026-07-13");
    expect(r.diasRestantes).toBe(-50);
  });

  it("falta uno solo de los dos envíos y el período sigue pendiente", () => {
    // Mandarlo a YPF y no a Loma Negra no es haberlo presentado.
    const r = resumen931([per("2026-07-13", true, false)], HOY);
    expect(r.pendientes).toBe(1);
    expect(r.estado).toBe("vencido");
  });

  it("todo enviado es vigente y sin fecha que reclamar", () => {
    const r = resumen931([per("2026-07-13", true, true), per("2026-08-20", true, true)], HOY);
    expect(r).toEqual({
      pendientes: 0,
      vencidos: 0,
      estado: "vigente",
      fechaLimite: null,
      diasRestantes: null,
    });
  });

  it("pendiente pero todavía en fecha es 'por vencer', no 'vencido'", () => {
    const r = resumen931([per("2026-09-20")], HOY);
    expect(r.vencidos).toBe(0);
    expect(r.estado).toBe("por_vencer");
    expect(r.diasRestantes).toBe(19);
  });

  it("cuenta como vencidos sólo los que pasaron su fecha", () => {
    const r = resumen931([per("2026-07-13"), per("2026-09-20")], HOY);
    expect(r.pendientes).toBe(2);
    expect(r.vencidos).toBe(1);
    expect(r.estado).toBe("vencido");
  });

  it("sin períodos no hay nada que reclamar", () => {
    expect(resumen931([], HOY).estado).toBe("vigente");
  });
});

describe("reconciliarF931", () => {
  it("la fila del F931 deja de decir que está por vencer cuando hay dos sin presentar", () => {
    const rows = [fila("F931", "por_vencer"), fila("VTV", "vigente")];
    const out = reconciliarF931(rows, LOS_DOS_DE_LA_CAPTURA, HOY);

    // Esto es el bug: antes acá había 0 y la pantalla decía "Ninguno vencido".
    expect(out.filter((r) => r.estado === "vencido")).toHaveLength(1);
    const f931 = out.find((r) => r.requisito_codigo === "F931")!;
    expect(f931.estado).toBe("vencido");
    expect(f931.fecha_vencimiento).toBe("2026-07-13");
    expect(f931.dias_restantes).toBe(-50);
  });

  it("no toca ninguna otra fila de la papeleta", () => {
    const rows = [fila("F931", "por_vencer"), fila("VTV", "vigente"), fila("EPAP", "faltante")];
    const out = reconciliarF931(rows, LOS_DOS_DE_LA_CAPTURA, HOY);
    expect(out.find((r) => r.requisito_codigo === "VTV")!.estado).toBe("vigente");
    expect(out.find((r) => r.requisito_codigo === "EPAP")!.estado).toBe("faltante");
  });

  it("sin períodos cargados no cambia nada", () => {
    const rows = [fila("F931", "por_vencer")];
    expect(reconciliarF931(rows, [], HOY)).toEqual(rows);
  });

  it("con todo presentado no ablanda una fila que la papeleta ya daba por vencida", () => {
    // El requisito puede estar vencido por su propio motivo (no hay papel
    // cargado). Que los períodos estén al día no lo arregla.
    const rows = [fila("F931", "vencido")];
    const out = reconciliarF931(rows, [per("2026-09-20")], HOY);
    expect(out[0]!.estado).toBe("vencido");
  });

  it("un período vencido sí endurece una fila que estaba en 'por vencer'", () => {
    const out = reconciliarF931([fila("F931", "por_vencer")], [per("2026-07-13")], HOY);
    expect(out[0]!.estado).toBe("vencido");
  });
});

describe("cómo se lee la fila del F931", () => {
  // La otra mitad del reporte del 01/09/2026: *"decía vencido de un documento
  // que nunca se cargó aún"*. Un papel vence; un envío que no se hizo FALTA.
  it("no dice 'vencido' sino que falta enviarlo, con el plazo que se pasó", () => {
    const out = reconciliarF931([fila("F931", "por_vencer")], LOS_DOS_DE_LA_CAPTURA, HOY);
    const f931 = out[0]!;
    expect(f931.estado).toBe("vencido");
    expect(f931.etiqueta_estado).toBe("Falta enviarlo");
    expect(f931.nota_estado).toBe("el plazo era el 13/07/2026 · van 50 días · 2 meses sin enviar");
  });

  // El error de la primera versión: con el papel cargado y venciendo el 11/09, la
  // fila mostraba "hasta el 20/09 · Sin presentar" — la fecha de un envío que
  // todavía no debe nada, tapando el vencimiento real del papel.
  it("mientras el plazo del envío corre, la fila sigue siendo la del papel", () => {
    const rows = [fila("F931", "por_vencer")];
    const out = reconciliarF931(rows, [per("2026-09-20", false, false, "2026-08")], HOY);
    expect(out).toEqual(rows);
    expect(out[0]!.etiqueta_estado).toBeUndefined();
  });

  it("el día del plazo todavía no está atrasado: tampoco toca la fila", () => {
    const rows = [fila("F931", "vigente")];
    expect(reconciliarF931(rows, [per(HOY)], HOY)).toEqual(rows);
  });
});
