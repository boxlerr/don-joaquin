// Encadenado de los tramos de una salida.
//
// Una salida rara vez es "ida y vuelta y listo". El caso que lo motivó (Nico,
// 27/07/2026): Olavarría → Cerrito, después Cerrito → Ramallo vacío y Ramallo →
// Lomaser cargado. Con un solo tramo de vuelta le quedaba un viaje sin registrar.
//
// Función PURA, sin React ni DB: la usa el formulario de carga y la fija el test.

export type TramoIda = {
  origen: string;
  destino: string;
  kmConCarga: string;
  kmVacios: string;
};

export type TramoPropuesto = {
  origen: string;
  destino: string;
  kmVacios: string;
};

/**
 * Qué proponer al agregar un tramo.
 *
 * - El primero es la vuelta clásica: invierte la ida y se trae su distancia,
 *   que es lo que pasa casi siempre y evita recargarla a mano.
 * - Los siguientes solo heredan el origen (donde terminó el anterior): a dónde
 *   sigue el camión no hay forma de adivinarlo, así que el destino queda vacío
 *   en vez de proponer algo que después haya que corregir.
 */
export function proponerTramo(ida: TramoIda, ultimoDestino: string | null): TramoPropuesto {
  if (ultimoDestino !== null) {
    return { origen: ultimoDestino, destino: "", kmVacios: "0" };
  }
  // Distancia de la ida: el viaje principal carga una u otra según vaya cargado.
  const distIda = ida.kmConCarga !== "0" ? ida.kmConCarga : ida.kmVacios;
  return { origen: ida.destino, destino: ida.origen, kmVacios: distIda };
}
