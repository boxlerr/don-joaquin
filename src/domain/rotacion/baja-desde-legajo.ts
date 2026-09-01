/**
 * Convertir un egreso del legajo en una baja de rotación.
 *
 * El problema que resuelve, en las palabras de Bárbara (audio del 31/08/2026):
 * *"yo ahí saqué dos de los legajos y no se actualizó en las bajas... A ver, para
 * qué actualizo la pantalla. No, sigue igual"*. Rotación marcaba **5 bajas**
 * cuando el historial de egresados tenía 14.
 *
 * La causa era que son dos registros que nunca se hablaron: la pantalla de
 * rotación lee `rotacion_bajas` —que se cargaba SÓLO a mano— y el egreso del
 * legajo escribe `choferes.estado = 'baja'`. No había trigger, ni acción, ni
 * backfill: podía refrescar todo lo que quisiera, el número no se movía.
 *
 * Acá vive la parte pura de la conversión (qué tipo de baja, cuánta antigüedad,
 * qué nombre) para poder probarla sin base. El insert vive en `lib/rotacion-baja.ts`.
 */

import type { ChoferMotivoEgreso } from "./motivo-egreso";
import type { TipoBaja } from "@/app/(dashboard)/choferes/rotacion/compute";

/**
 * El motivo del legajo, traducido al vocabulario de rotación.
 *
 * El legajo ofrece cuatro motivos y `rotacion_bajas` acepta cinco: la que sobra
 * es `abandono`, que el diálogo de egreso no ofrece. No se infiere de ningún
 * lado —confundir un abandono con una renuncia cambia el índice de rotación
 * voluntaria— así que lo que no se sabe entra como `otro`.
 */
export const TIPO_BAJA_DESDE_MOTIVO: Record<ChoferMotivoEgreso, TipoBaja> = {
  renuncia: "renuncia_voluntaria",
  despido: "despido",
  jubilacion: "jubilacion",
  otro: "otro",
};

export function tipoBajaDesdeMotivo(motivo: string | null | undefined): TipoBaja {
  if (!motivo) return "otro";
  return TIPO_BAJA_DESDE_MOTIVO[motivo as ChoferMotivoEgreso] ?? "otro";
}

/**
 * Meses cumplidos entre dos fechas ISO (YYYY-MM-DD). Null si falta alguna o si
 * no se pueden leer.
 *
 * Cuenta meses CUMPLIDOS, igual que la antigüedad que se dice en la oficina:
 * del 15/01 al 14/02 no es un mes todavía. Los tramos de la pantalla de rotación
 * (`< 1 año`, `1-3`…) se calculan sobre esto, así que redondear para arriba
 * movería gente de tramo.
 */
export function mesesEntreFechas(
  desde: string | null | undefined,
  hasta: string | null | undefined,
): number | null {
  if (!desde || !hasta) return null;
  const [ay, am, ad] = desde.slice(0, 10).split("-").map(Number);
  const [by, bm, bd] = hasta.slice(0, 10).split("-").map(Number);
  if (!ay || !am || !ad || !by || !bm || !bd) return null;
  let meses = (by - ay) * 12 + (bm - am);
  if (bd < ad) meses -= 1;
  // Una fecha de egreso anterior al ingreso es un dato mal cargado, no una
  // antigüedad negativa: mejor no decir nada que decir "-8 meses".
  return meses < 0 ? null : meses;
}

/** Año al que se imputa la baja. Es el del egreso; sin fecha, el que se pase. */
export function anioDeBaja(fechaEgreso: string | null | undefined, anioPorDefecto: number): number {
  const y = Number(fechaEgreso?.slice(0, 4));
  return Number.isFinite(y) && y > 1900 ? y : anioPorDefecto;
}

/**
 * ¿Este egreso entra en el índice de rotación?
 *
 * Los fleteros NO. Regla del cliente, textual (Bárbara, 31/08/2026): *"en el
 * historial de choferes egresados hay 14 que igual dos son fleteros, no cuentan,
 * pero el resto cuentan todos"*. Un fletero es un tercero contratado, no una
 * persona de la nómina: contarlo infla la rotación de personal.
 *
 * Se puede decidir solo porque el legajo ya distingue el rol (`fletero` es uno
 * de los cuatro de la barra de filtros); hasta ahora Bárbara los restaba a mano.
 */
export function cuentaParaRotacion(rol: string | null | undefined): boolean {
  return rol !== "fletero";
}
