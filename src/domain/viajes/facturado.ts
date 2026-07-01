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
// Nota: al completar un viaje con el valor oficial del cliente, los importadores
// del DM de YPF y de la liquidación de Loma lo dejan facturado (esa certificación
// ES la facturación): el de Loma pasa por esta función; el del DM de YPF setea
// `facturado = true` directo.
export function viajeEstaFacturado(
  montoFlete: number | null | undefined,
  esVacio: boolean = false,
): boolean {
  return !esVacio && Number(montoFlete ?? 0) > 0;
}
