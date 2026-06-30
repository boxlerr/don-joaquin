// Lógica pura del cálculo de importe por tarifa (§1e: el destino define el precio).
// Sin acceso a la base: el server action (viajes/actions.ts) resuelve los datos
// y delega acá la selección de la tarifa aplicable y el cálculo del importe, para
// que esta parte —que es la que tiene reglas de negocio— sea testeable.

export type TarifaModalidad = "fija" | "por_tonelada" | "por_kilo" | "por_km";

export type RutaTarifa = {
  origen_id: string;
  destino_id: string;
  km_oficiales: number | null;
};

/** Tarifa candidata (ya filtrada por cliente + activa + vigencia en el caller). */
export type TarifaAplicable = {
  id: string;
  modalidad: TarifaModalidad;
  valor: number;
  moneda?: string | null;
  ruta_id: string | null;
  // El select anidado de PostgREST puede venir como objeto o array de un elemento.
  ruta: RutaTarifa | RutaTarifa[] | null;
};

/** Normaliza la ruta embebida (objeto o array de uno) a un objeto o null. */
export function rutaDeTarifa(t: Pick<TarifaAplicable, "ruta">): RutaTarifa | null {
  const r = Array.isArray(t.ruta) ? t.ruta[0] : t.ruta;
  return r ?? null;
}

/**
 * Elige la tarifa aplicable con prioridad:
 *   1) ruta exacta (origen + destino)
 *   2) mismo destino (otra ruta al mismo destino) — "el destino define el precio"
 *   3) tarifa general del cliente (sin ruta)
 * `vigentes` debe venir ya filtrada (cliente + activa + vigente) y ordenada por
 * vigencia desc, así el primer match es el más reciente.
 */
export function pickTarifaAplicable<T extends TarifaAplicable>(
  vigentes: T[],
  origenId: string | null,
  destinoId: string | null,
): T | null {
  const exacta =
    origenId && destinoId
      ? vigentes.find((t) => {
          const r = rutaDeTarifa(t);
          return !!r && r.origen_id === origenId && r.destino_id === destinoId;
        })
      : undefined;
  const porDestino = destinoId
    ? vigentes.find((t) => {
        const r = rutaDeTarifa(t);
        return !!r && r.destino_id === destinoId;
      })
    : undefined;
  const general = vigentes.find((t) => t.ruta_id == null);
  return exacta ?? porDestino ?? general ?? null;
}

/** Calcula el importe del flete según la modalidad de la tarifa (redondeado a 2). */
export function computeImporteTarifa(
  modalidad: TarifaModalidad,
  valor: number,
  args: { tonelaje: number; kmConCarga: number; kmRuta?: number | null },
): number {
  const { tonelaje, kmConCarga, kmRuta } = args;
  let importe: number;
  switch (modalidad) {
    case "por_tonelada":
      importe = tonelaje * valor;
      break;
    case "por_kilo":
      importe = tonelaje * 1000 * valor;
      break;
    case "por_km":
      // Prioriza los km oficiales de la ruta; si no hay, usa los del viaje.
      importe = (kmRuta && kmRuta > 0 ? kmRuta : kmConCarga) * valor;
      break;
    case "fija":
    default:
      importe = valor;
      break;
  }
  return Math.round(importe * 100) / 100;
}

const MODALIDAD_LABEL: Record<TarifaModalidad, string> = {
  fija: "fija",
  por_tonelada: "por tonelada",
  por_kilo: "por kilo",
  por_km: "por km",
};

/** Texto del aviso que se muestra al precargar el monto (ej. "$X/t × Y t"). */
export function detalleTarifa(
  modalidad: TarifaModalidad,
  valor: number,
  args: { tonelaje: number; km: number },
): string {
  const fmt = (n: number) => n.toLocaleString("es-AR");
  if (modalidad === "por_tonelada") return `Tarifa $${fmt(valor)}/t × ${fmt(args.tonelaje)} t`;
  if (modalidad === "fija") return `Tarifa fija $${fmt(valor)}`;
  if (modalidad === "por_km") return `Tarifa $${fmt(valor)}/km × ${fmt(args.km)} km`;
  return `Tarifa ${MODALIDAD_LABEL[modalidad]}`;
}
