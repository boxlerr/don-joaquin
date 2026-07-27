export type ViajeBasico = {
  id: string;
  codigo: string;
  fecha_viaje: string;
  origen: string | null;
  destino: string | null;
  cliente: string | null;
  toneladas: number | null;
  km_totales: number;
  km_con_carga: number;
  km_vacios: number;
  estado: string;
  facturado: boolean;
  cobrado: boolean;
  fecha_cobro: string | null;
  chofer: string | null;
  camion: string | null;
  monto_flete: number | null;
  moneda: string | null;
  observaciones: string | null;
  nro_viaje_ypf: string | null;
  nro_remito: string | null;
  material: string | null;
  es_vacio: boolean;
};

export type PaginatedResult<T> = {
  data: T[];
  hasMore: boolean;
  count?: number;
};

/**
 * Dato puntual que le falta a un viaje. Alimenta el filtro `?falta=` del
 * listado, con el que /metricas linkea desde cada KPI incompleto: los criterios
 * son los mismos que cuenta el modo en vivo, así que el número del KPI y el
 * largo de la lista tienen que coincidir.
 *
 * Vive acá y no en actions.ts porque ese archivo es "use server" y solo puede
 * exportar funciones async.
 */
export type FaltaDato = "km" | "monto" | "tonelaje" | "chofer";

export const FALTA_LABEL: Record<FaltaDato, string> = {
  km: "Sin km cargados",
  monto: "Sin monto de flete",
  tonelaje: "Sin tonelaje",
  chofer: "Sin chofer asignado",
};

export const esFaltaDato = (v: string | undefined): v is FaltaDato =>
  v === "km" || v === "monto" || v === "tonelaje" || v === "chofer";
