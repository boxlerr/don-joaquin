export type ViajeBasico = {
  id: string;
  codigo: string;
  fecha_viaje: string;
  origen: string | null;
  destino: string | null;
  km_totales: number;
  estado: string;
  facturado: boolean;
};

export type PaginatedResult<T> = {
  data: T[];
  hasMore: boolean;
  count?: number;
};
