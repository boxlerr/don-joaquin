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

export type AcopladoTipo = Database["public"]["Enums"]["acoplado_tipo"];

/**
 * Los tipos de acoplado, con la lista que pidió Nico (28/08): la del arranque
 * era un catálogo general —sider, cisterna, jaula, plancha— que no tenía nada
 * que ver con lo que ellos manejan, y por eso quedó sin usar: los 64 acoplados
 * tienen el tipo vacío.
 */
export const ACOPLADO_TIPO_LABELS: Record<AcopladoTipo, string> = {
  semi: "Semis",
  acoplado: "Acoplado",
  tolva: "Tolva",
  batea: "Batea",
  otro: "Otro",
};

/** El tipo como se muestra. Un valor viejo que quedara suelto se muestra tal cual. */
export function etiquetaAcopladoTipo(tipo: string | null | undefined): string {
  if (!tipo) return "—";
  return ACOPLADO_TIPO_LABELS[tipo as AcopladoTipo] ?? tipo;
}

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
