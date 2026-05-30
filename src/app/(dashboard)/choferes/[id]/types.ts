import { Database } from "@/types/database";

export type ChoferBasico = Pick<
  Database["public"]["Tables"]["choferes"]["Row"],
  | "id"
  | "nombre"
  | "apellido"
  | "dni"
  | "cuil"
  | "estado"
  | "localidad"
  | "email"
  | "telefono"
  | "domicilio"
  | "provincia"
  | "fecha_nacimiento"
  | "fecha_ingreso"
  | "fecha_egreso"
  | "motivo_egreso"
  | "observaciones"
  | "ciudad_nacimiento"
  | "cbu"
  | "alias_cbu"
  | "banco"
  | "cvu"
  | "telefono_emergencia"
  | "updated_at"
  | "foto_id"
>;

export type DocumentoVigencia = {
  id: string | null;
  tipo_documento: string | null;
  tipo_documento_codigo: string | null;
  tipo_documento_id?: string | null;
  fecha_vencimiento: string | null;
  fecha_emision?: string | null;
  dias_restantes: number | null;
  estado_vigencia: string | null;
  numero: string | null;
  archivo_url?: string | null;
  archivo_nombre?: string | null;
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

export type CamionAsignado = {
  id: string;
  patente: string;
  marca: string | null;
  modelo: string | null;
  ano: number | null;
};

export type ApercibimientoGravedad = "leve" | "moderado" | "grave";
export type PrestamoEstado = "pendiente" | "parcial" | "cancelado" | "incobrable";

export type CategoriaApercibimiento = {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
};

export type Apercibimiento = {
  id: string;
  fecha: string;
  categoria_id: string | null;
  categoria_nombre: string | null;
  gravedad: ApercibimientoGravedad;
  motivo: string;
  observaciones: string | null;
  created_at: string;
};

export type LicenciaMedica = {
  id: string;
  fecha_desde: string;
  fecha_hasta: string | null;
  motivo: string | null;
  observaciones: string | null;
  dias: number | null;
  en_curso: boolean;
  created_at: string;
};

export type Prestamo = {
  id: string;
  fecha: string;
  monto: number;
  moneda: string;
  cuotas: number;
  saldo_pendiente: number;
  estado: PrestamoEstado;
  motivo: string | null;
  observaciones: string | null;
  created_at: string;
};

export type CamionHistorialItem = {
  id: string;
  camion_id: string;
  patente: string;
  marca: string | null;
  modelo: string | null;
  desde: string;
  hasta: string | null;
  motivo_cambio: string | null;
};

export type AdelantoMes = {
  id: string;
  fecha_entrega: string;
  monto_adelanto: number;
  moneda: string;
  viaje_codigo: string | null;
};

export type RoturaDetalle = {
  id: string;
  fecha: string;
  cantidad: number;
  costo: number | null;
  moneda: string;
  posicion: string | null;
  observaciones: string | null;
  unidad_patente: string | null;
  unidad_tipo: "camion" | "acoplado" | null;
};

// KPIs operativos del mes en curso. Calculados server-side a partir de viajes y viáticos.
export type ProductividadKPIs = {
  periodo_desde: string;
  periodo_hasta: string;
  viajes_count: number;
  km_con_carga: number;
  km_vacios: number;
  km_total: number;
  pct_vacios: number;
  toneladas: number;
  facturacion_ars: number;
  facturacion_usd: number;
  liquidacion_chofer_mes: number; // suma de monto_chofer (el "$" del Excel de hoja de ruta) de los viajes del mes
  adelantos_viaticos_ars: number;
  adelantos_viaticos_usd: number;
  eficiencia_combustible: number | null; // L/100km del mes; null si no hay cargas suficientes
  litros_mes: number; // litros de gasoil cargados en el mes
  cargas_combustible_count: number;
  taller_visitas_mes: number; // reparaciones/averías + gomería del/los camión(es) del chofer en el mes
  roturas_mes: number;
  roturas_cantidad_mes: number;
  apercibimientos_mes: number;
  apercibimientos_graves_mes: number;
  licencias_activas: number;
  licencias_dias_mes: number;
  prestamos_activos: number;
  score: number | null;
};

export type EvolucionMes = {
  mes: string;
  label: string;
  viajes: number;
  km_total: number;
  facturacion_ars: number;
  toneladas: number;
};

export type ChoferDetail = ChoferBasico & {
  foto?: { bucket: string; path: string } | null;
  documentos_vigencia: DocumentoVigencia[];
  tipos_documento: TipoDocumento[];
  viajes_recientes: ViajeBasico[];
  movimientos_mes: MovimientoChofer[];
  camion_actual: CamionAsignado | null;
  apercibimientos: Apercibimiento[];
  licencias_medicas: LicenciaMedica[];
  prestamos: Prestamo[];
  categorias_apercibimiento: CategoriaApercibimiento[];
  productividad_kpis: ProductividadKPIs;
  camiones_historial: CamionHistorialItem[];
  roturas_detalle: RoturaDetalle[];
  adelantos_mes: AdelantoMes[];
  evolucion_6meses: EvolucionMes[];
  is_admin: boolean;
  alertas: {
    id: string;
    tipo: string;
    severidad: string;
    titulo: string;
    mensaje: string;
  }[];
};
