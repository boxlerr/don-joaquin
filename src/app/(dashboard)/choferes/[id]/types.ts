import { Database } from "@/types/database";

export type ChoferBasico = Pick<
  Database["public"]["Tables"]["choferes"]["Row"],
  | "id"
  | "nombre"
  | "apellido"
  | "dni"
  | "estado"
  | "localidad"
  | "email"
  | "telefono"
  | "domicilio"
  | "provincia"
  | "fecha_nacimiento"
  | "fecha_ingreso"
  | "fecha_egreso"
  | "cbu"
  | "alias_cbu"
  | "banco"
  | "telefono_emergencia"
  | "updated_at"
>;

export type DocumentoVigencia = {
  id: string | null;
  tipo_documento: string | null;
  tipo_documento_codigo: string | null;
  fecha_vencimiento: string | null;
  dias_restantes: number | null;
  estado_vigencia: string | null;
  numero: string | null;
};

export type TipoDocumento = {
  id: string;
  nombre: string;
  codigo: string;
};

export type ViajeBasico = {
  id: string;
  codigo: string;
  fecha_viaje: string;
  km_con_carga: number;
  km_vacios: number;
  estado: string;
  facturado: boolean;
};

export type MovimientoChofer = {
  id: string;
  fecha: string;
  concepto: string;
  tipo: "ingreso" | "egreso";
  monto: number;
  categoria: string;
};

export type ChoferDetail = ChoferBasico & {
  documentos_vigencia: DocumentoVigencia[];
  tipos_documento: TipoDocumento[];
  viajes_recientes: ViajeBasico[];
  movimientos_mes: MovimientoChofer[];
};
