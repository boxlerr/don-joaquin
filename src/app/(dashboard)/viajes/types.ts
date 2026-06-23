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
