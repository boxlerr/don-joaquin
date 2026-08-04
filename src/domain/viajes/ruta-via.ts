// Vía del viaje: por qué ruta fue el camión.
//
// Ruta 5 es la directa y Ruta 22 la que pasa por la base (reunión Nico 02/07).
// De la vía dependen los km del par origen → destino, así que es lo que explica
// por qué dos viajes al mismo lugar tienen distancias distintas.
//
// La etiqueta vive acá porque la muestran el listado, la hoja de ruta y los
// Excel: el mismo Record<string, string> ya andaba copiado en tres archivos.

export const RUTA_VIA_VALUES = ["ruta_5", "ruta_22"] as const;

export type RutaVia = (typeof RUTA_VIA_VALUES)[number];

export const RUTA_VIA_LABELS: Record<RutaVia, string> = {
  ruta_5: "Ruta 5",
  ruta_22: "Ruta 22",
};

/**
 * Etiqueta para pantalla. El guión largo es el "sin dato" del resto de las
 * tablas; en los Excel la celda va VACÍA, así que ahí hay que chequear el null
 * antes de llamar (o leer RUTA_VIA_LABELS directo).
 *
 * Un valor que no esté en el mapa se devuelve tal cual: si mañana aparece una
 * vía nueva en la base, es mejor verla cruda que mostrar "—" y hacer creer que
 * nadie la cargó.
 */
export function etiquetaRutaVia(via: string | null | undefined): string {
  if (!via) return "—";
  return RUTA_VIA_LABELS[via as RutaVia] ?? via;
}
