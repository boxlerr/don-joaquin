// El Formulario 931 se sigue en dos lugares que hasta ahora no se hablaban.
//
// Julián, 01/09/2026: *"compliance me dice que hay 0 vencidos ahí en el modal
// cuando en la notificación me dice 2, eso es un error"*. Y tenía razón: la
// pantalla mostraba **VENCIDOS 0 · Ninguno vencido** mientras el pop-up del día
// avisaba de dos Formularios 931 vencidos, uno de hacía 50 días y otro de 12.
//
// No eran dos números peleados: eran dos FUENTES distintas del mismo trámite.
//   · La papeleta (`v_compliance_estado`) tiene UNA fila "F931" de la empresa, y
//     su estado sale de si hay un papel cargado contra el requisito.
//   · Los períodos (`form931_presentaciones`) son una tabla propia, con una fila
//     por mes y su fecha límite, y son los que mira el generador de avisos.
// La papeleta no sabía nada de los períodos, así que decía "ninguno vencido"
// aunque hubiera dos meses sin presentar.
//
// Acá se reconcilian: **la fila de la papeleta pasa a decir lo que dicen sus
// períodos**. No se toca la base ni se inventa una fila nueva — se corrige lo que
// esa fila afirma, que es lo único que estaba mal.
//
// Los dos números siguen contando cosas distintas a propósito, y está bien: la
// papeleta cuenta REQUISITOS (el F931 es uno solo) y el aviso cuenta PERÍODOS
// (son dos meses). Lo que no puede pasar —y era el bug— es que una diga "ninguno"
// mientras la otra dice "dos".

import type { ComplianceEstado, ComplianceEstadoRow } from "./types";

/** El código del requisito de la papeleta que representa al Formulario 931. */
export const CODIGO_F931 = "F931";

export type Periodo931 = {
  periodo: string | null;
  fecha_limite: string;
  enviado_ypf: boolean;
  enviado_loma: boolean;
};

export type Resumen931 = {
  /** Períodos que todavía no se enviaron a los dos destinos. */
  pendientes: number;
  /** De esos, cuántos ya pasaron su fecha límite. */
  vencidos: number;
  /** Estado que le corresponde a la fila de la papeleta. */
  estado: ComplianceEstado;
  /** La fecha límite que manda: la más vieja sin presentar. */
  fechaLimite: string | null;
  /** Días hasta esa fecha. Negativo = venció hace tanto. */
  diasRestantes: number | null;
};

function diasHasta(fechaISO: string, hoyISO: string): number {
  const [ay, am, ad] = fechaISO.slice(0, 10).split("-").map(Number);
  const [by, bm, bd] = hoyISO.slice(0, 10).split("-").map(Number);
  if (!ay || !by) return 0;
  const a = Date.UTC(ay, (am ?? 1) - 1, ad ?? 1);
  const b = Date.UTC(by, (bm ?? 1) - 1, bd ?? 1);
  return Math.round((a - b) / 86400000);
}

/**
 * Qué dicen los períodos del 931, en el vocabulario de la papeleta.
 *
 * Un período cuenta como pendiente mientras le falte CUALQUIERA de los dos
 * envíos: mandarlo a YPF y no a Loma Negra no es haberlo presentado. Es el mismo
 * criterio con el que se generan los avisos, y tiene que serlo — si acá se
 * contara distinto, volveríamos a tener dos números peleados.
 */
export function resumen931(periodos: Periodo931[], hoyISO: string): Resumen931 {
  const pendientes = periodos.filter((p) => !(p.enviado_ypf && p.enviado_loma));
  if (pendientes.length === 0) {
    return { pendientes: 0, vencidos: 0, estado: "vigente", fechaLimite: null, diasRestantes: null };
  }

  // La que manda es la más vieja sin presentar: es la que está en problemas.
  const ordenados = [...pendientes].sort((a, b) => a.fecha_limite.localeCompare(b.fecha_limite));
  const primera = ordenados[0]!;
  const dias = diasHasta(primera.fecha_limite, hoyISO);
  const vencidos = pendientes.filter((p) => diasHasta(p.fecha_limite, hoyISO) < 0).length;

  return {
    pendientes: pendientes.length,
    vencidos,
    estado: vencidos > 0 ? "vencido" : "por_vencer",
    fechaLimite: primera.fecha_limite,
    diasRestantes: dias,
  };
}

/**
 * Devuelve las filas de la papeleta con la del F931 diciendo la verdad.
 *
 * Si no hay períodos cargados no se toca nada: sin datos, la fila sigue valiendo
 * lo que valía. Y nunca se ablanda un estado — si la papeleta ya la daba por
 * vencida por su propio motivo (no hay papel cargado), se respeta: el peor de
 * los dos es el que hay que atender.
 */
export function reconciliarF931<T extends ComplianceEstadoRow>(
  rows: T[],
  periodos: Periodo931[],
  hoyISO: string,
): T[] {
  if (periodos.length === 0) return rows;
  const r = resumen931(periodos, hoyISO);
  if (r.pendientes === 0) return rows;

  return rows.map((row) => {
    if (row.requisito_codigo !== CODIGO_F931) return row;
    // "faltante" (nunca se cargó el papel) es un problema distinto y más viejo
    // que un período por vencer: no se pisa con algo más blando.
    if (row.estado === "vencido" && r.estado !== "vencido") return row;
    return {
      ...row,
      estado: r.estado,
      fecha_vencimiento: r.fechaLimite ?? row.fecha_vencimiento,
      dias_restantes: r.diasRestantes ?? row.dias_restantes,
    };
  });
}
