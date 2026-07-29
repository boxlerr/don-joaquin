import { Database } from "@/types/database";
import type { OrigenDias } from "../vacaciones/derivar";

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
  | "telefono_emergencia"
  | "nro_tramite_dni"
  | "clave_fiscal"
  | "alta_afip"
  | "periodo_prueba_fin"
  | "rol"
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

export type PrestamoEstado = "pendiente" | "parcial" | "cancelado" | "incobrable";

export type CategoriaApercibimiento = {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
};

export type ApercibimientoTipo = "apercibimiento" | "multa" | "llamado_atencion" | "adelanto";

export type Apercibimiento = {
  id: string;
  fecha: string;
  tipo: ApercibimientoTipo;
  categoria_id: string | null;
  categoria_nombre: string | null;
  motivo: string;
  observaciones: string | null;
  created_at: string;
  archivo_url?: string | null;
  archivo_nombre?: string | null;
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

// Viaje del chofer dentro del rango de una ausencia — para avisar de conflictos
// al momento de cargar la ausencia.
export type ViajeEnRango = {
  id: string;
  codigo: string;
  fecha_viaje: string;
  origen: string | null;
  destino: string | null;
  cliente: string | null;
  estado: string;
};

export type AusenciaEstado = "pendiente" | "autorizada" | "rechazada" | "cumplida";

export type Ausencia = {
  id: string;
  tipo: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: AusenciaEstado;
  observaciones: string | null;
  autorizado_por_nombre: string | null;
  dias: number;
  // true si la ausencia ya empezó y no terminó (en curso a la fecha de hoy).
  en_curso: boolean;
  // true si esta ausencia es un período de vacaciones (descuenta del saldo).
  es_vacaciones: boolean;
  // false = ausencia injustificada (penaliza el ranking). Default true.
  justificada: boolean;
  // Año de vacaciones al que se imputa el período. null = histórico: ya estaba
  // reflejado en la carga inicial de saldos y no vuelve a descontar.
  anio_cargo: number | null;
  // De dónde salió el período (humano / planilla). Opcional por lo mismo que en
  // los saldos: sin dato se muestra "sin registrar", no "lo puso el sistema".
  origen?: "humano" | "planilla";
  created_at: string;
};

// Saldo de vacaciones por chofer, derivado de los días otorgados por año
// (chofer_vacaciones_anios) menos los períodos imputados a cada año.
// Todo se calcula con `resumenSaldos` (vacaciones/derivar.ts), la misma función
// que usa la vista global: el mismo empleado no puede dar distinto en dos pantallas.
export type VacacionesSaldo = {
  dias_correspondientes: number;
  dias_adeudados: number;
  dias_tomados: number;
  // Saldo vigente (años Y e Y−1). NO es corresponden + adeudados − tomados:
  // los días tomados ya están descontados del año al que se imputaron.
  dias_disponibles: number;
  // Saldo de años que ya vencieron (anteriores a Y−1). Informativo.
  dias_vencidos: number;
  // `origen` es opcional a propósito. Cuando falta, la UI muestra "sin
  // registrar" y NUNCA "lo puso el sistema": atribuirle a la máquina un dato
  // humano por un campo faltante sería reintroducir el problema por otra puerta.
  anios: {
    anio: number;
    otorgados: number;
    usados: number;
    saldo: number;
    observaciones: string | null;
    origen?: OrigenDias;
  }[];
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

export type PesosScore = {
  id: string;
  peso_vacios_bajo: number;
  peso_vacios_medio: number;
  peso_vacios_alto: number;
  umbral_vacios_bajo: number;
  umbral_vacios_medio: number;
  umbral_vacios_alto: number;
  peso_apercibimiento: number;
  peso_rotura: number;
  peso_licencia: number;
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
  // Σ tonelaje / Σ capacidad del camión asignado a cada viaje (en %). Mide cuán
  // lleno viajó respetando la capacidad real (29 / 35 / 37,5 tn), para no comparar
  // un chofer de camión chico contra uno grande por toneladas absolutas. null si
  // ningún viaje del mes tenía capacidad de camión cargada.
  utilizacion_pct: number | null;
  facturacion_ars: number;
  facturacion_usd: number;
  liquidacion_chofer_mes: number;
  adelantos_viaticos_ars: number;
  adelantos_viaticos_usd: number;
  eficiencia_combustible: number | null;
  litros_mes: number;
  cargas_combustible_count: number;
  taller_visitas_mes: number;
  roturas_mes: number;
  roturas_cantidad_mes: number;
  apercibimientos_mes: number;
  licencias_activas: number;
  licencias_dias_mes: number;
  prestamos_activos: number;
  facturacion_por_km: number | null; // facturacion_ars / km_con_carga
  score: number | null;
  ranking_pos: number | null;
  ranking_total: number;
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
  ausencias: Ausencia[];
  vacaciones: VacacionesSaldo;
  prestamos: Prestamo[];
  categorias_apercibimiento: CategoriaApercibimiento[];
  productividad_kpis: ProductividadKPIs;
  camiones_historial: CamionHistorialItem[];
  roturas_detalle: RoturaDetalle[];
  adelantos_mes: AdelantoMes[];
  evolucion_6meses: EvolucionMes[];
  pesos_score: PesosScore | null;
  is_admin: boolean;
  // El usuario tiene permiso de escritura sobre logística (cargar/editar ausencias).
  can_logistica_write: boolean;
  // El usuario puede ver datos de sueldo (liquidación/adelantos). Subsección confidencial.
  can_ver_sueldos: boolean;
  // Score de conducta del último trimestre (null si no tuvo viajes). Mismo
  // cálculo que el Ranking. Se muestra como insignia en el header.
  score_trimestre: number | null;
  // Penalizaciones que llevaron a ese score (para mostrar el "por qué").
  score_trimestre_desglose: { label: string; puntos: number }[];
  alertas: {
    id: string;
    tipo: string;
    severidad: string;
    titulo: string;
    mensaje: string;
  }[];
};
