import { Database } from "@/types/database";

export type Camion = Pick<
  Database["public"]["Tables"]["camiones"]["Row"],
  | "id"
  | "patente"
  | "marca"
  | "modelo"
  | "ano"
  | "capacidad_tn"
  | "tipo_camion"
  | "estado"
  | "tercerizacion_estado"
  | "es_tolva"
  | "km_actual"
> & {
  foto_url?: string | null;
  chofer_nombre?: string | null;
  acoplados_vinculados?: string[];
};

export type Acoplado = Pick<
  Database["public"]["Tables"]["acoplados"]["Row"],
  | "id"
  | "patente"
  | "marca"
  | "modelo"
  | "ano"
  | "capacidad_tn"
  | "tipo"
  | "es_tolva"
  | "estado"
> & {
  camion_patente?: string | null;
  chofer_nombre?: string | null;
};

export type ServiceRecord = Pick<
  Database["public"]["Tables"]["mantenimientos"]["Row"],
  | "id"
  | "fecha"
  | "tipo"
  | "tipo_servicio_id"
  | "km_odometro"
  | "proximo_service_km"
  | "descripcion"
  | "costo"
  | "taller"
> & {
  // join opcional al catálogo (cuando la fila ya tiene tipo_servicio_id)
  tipo_servicio?: {
    id: string;
    codigo: string;
    nombre: string;
  } | null;
};

export type GasoilRecord = Pick<
  Database["public"]["Tables"]["cargas_combustible"]["Row"],
  "id" | "fecha" | "litros" | "km_odometro" | "importe_total" | "estacion" | "chofer_id" | "observaciones" | "lugar_carga"
>;

export type PaginatedResult<T> = {
  data: T[];
  hasMore: boolean;
};

export type DocumentoVigenciaCamion = {
  id: string | null;
  tipo_documento: string | null;
  tipo_documento_codigo: string | null;
  fecha_vencimiento: string | null;
  dias_restantes: number | null;
  estado_vigencia: string | null;
  numero: string | null;
};

export type TipoDocumentoCamion = {
  id: string;
  nombre: string;
  codigo: string;
};

export type FotoCamion = {
  id: string;
  url: string;
  descripcion: string | null;
  es_principal: boolean;
  created_at: string;
  nombre_original: string;
};
