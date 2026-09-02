/**
 * Las formas que se pasan entre el servidor y la pantalla de autoconsumo.
 *
 * Están acá y no en `actions.ts` porque un módulo `"use server"` sólo puede
 * exportar funciones async: un `export type` ahí adentro compila, pasa los tests
 * y después rompe —a veces el build de Vercel, a veces recién en runtime con un
 * 500 y la pantalla cargando para siempre—. Ya pasó tres veces (cheques 03/08,
 * previsión y legajos 01/09/2026), así que el tipo vive en un módulo común y
 * tanto la acción como el cliente lo importan de acá.
 */

/** Un chofer, para el buscador de "a quién se le autoriza". */
export type ChoferOpcion = { id: string; nombre: string };

/** Una fila de "lo que se autorizó", tal como la muestra la pantalla. */
export type AutorizacionRow = {
  id: string;
  created_at: string;
  chofer: string | null;
  origen: string;
  destino: string;
  toneladas: number;
  litros_por_tonelada: number;
  litros: number;
  observaciones: string | null;
  cargadoPor: string | null;
  /** La anotó el propio chofer desde el enlace, no alguien de la oficina. */
  cargadaPorChofer: boolean;
};

/** El enlace público vigente, listo para mandar. */
export type EnlaceChofer = {
  url: string;
  /** Sólo para mostrarlo cortito en la pantalla; la llave real va en la URL. */
  token: string;
  creadoEl: string;
};

/** Un chofer con su teléfono, para armarle el botón de WhatsApp. */
export type ChoferConTelefono = {
  id: string;
  nombre: string;
  telefono: string | null;
};

/** Lo que necesita el diálogo de "Enviar el enlace". */
export type DatosDelEnlace = {
  enlace: EnlaceChofer | null;
  choferes: ChoferConTelefono[];
};
