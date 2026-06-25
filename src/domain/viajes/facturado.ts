// Regla única de "facturado" para los viajes.
//
// El negocio define que un viaje está facturado cuando tiene monto de flete
// (> 0) y no es un tramo vacío. Históricamente esta regla estaba duplicada e
// inconsistente: los importadores (Loma, hoja de ruta), la edición inline de la
// hoja de ruta y el cierre la derivaban del monto, pero la carga manual y la
// carga rápida forzaban `facturado = false` aunque hubiera monto. Resultado: el
// mismo dato quedaba "facturado" o "sin facturar" según por dónde entró.
//
// Centralizamos acá la regla para que todos los flujos la usen igual.
//
// Excepción intencional: el importador de YPF deja `facturado = false` aunque
// haya importe, porque la facturación a YPF se gestiona por su flujo de
// liquidación/compliance aparte (no por el monto del viaje).
export function viajeEstaFacturado(
  montoFlete: number | null | undefined,
  esVacio: boolean = false,
): boolean {
  return !esVacio && Number(montoFlete ?? 0) > 0;
}
