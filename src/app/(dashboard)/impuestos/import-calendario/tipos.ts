/**
 * Los tipos del importador, en un archivo aparte del `"use server"`.
 *
 * No es un capricho de orden: un `export type` dentro de un archivo con
 * `"use server"` rompe, y no siempre en el build — ya nos dejó tres veces la
 * pantalla cargando para siempre con un 500 que sólo aparecía en producción.
 */

/** Qué le va a pasar a cada renglón del PDF si se confirma. */
export type EstadoFila =
  /** No está cargado: se crea. */
  | "nuevo"
  /** Ya está cargado con esa misma fecha: no se toca. */
  | "ya_cargado"
  /** Está cargado ese mes con OTRA fecha: el estudio lo reprogramó. */
  | "mueve_fecha";

export type FilaPreview = {
  idx: number;
  nombre: string;
  fechaVencimiento: string;
  /** Heredado del mismo impuesto cargado antes; vacío si es la primera vez. */
  organismo: string;
  estado: EstadoFila;
  /** Sólo en `mueve_fecha` / `ya_cargado`: la fila que ya existe. */
  existente: { id: string; fechaVencimiento: string; presentado: boolean } | null;
};

export type EntidadPreview = {
  codigo: string;
  nombre: string;
  cuit: string;
  columnaAlerta: string;
  /** A quién le van a llegar los avisos de esta entidad, en castellano. */
  avisaA: string;
};

export type PreviewCalendario =
  | {
      ok: true;
      /** La entidad reconocida por el CUIT del PDF. */
      entidad: EntidadPreview | null;
      /** Lo que dice el PDF cuando el CUIT no está dado de alta todavía. */
      entidadNueva: { razonSocial: string | null; cuit: string | null } | null;
      /** Período sugerido (YYYY-MM): el mes anterior al vencimiento. Editable. */
      periodoSugerido: string;
      filas: FilaPreview[];
      advertencias: string[];
      error?: never;
    }
  | { ok?: false; error: string };

export type FilaConfirmar = {
  nombre: string;
  fechaVencimiento: string;
  organismo: string;
  aplicar: boolean;
};

export type ResultadoImport =
  | {
      ok: true;
      creados: number;
      actualizados: number;
      salteados: number;
      /** Si el PDF quedó archivado junto a los vencimientos. */
      pdfArchivado: boolean;
      error?: never;
    }
  | { ok?: false; error: string };
