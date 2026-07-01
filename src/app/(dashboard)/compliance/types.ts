import type { Database } from "@/types/database";

export type ComplianceCliente = "YPF" | "LOMA_NEGRA";
export type ComplianceClienteAplica = Database["public"]["Enums"]["compliance_cliente_aplica"];
export type ComplianceNivel = Database["public"]["Enums"]["compliance_nivel"];
export type CompliancePeriodicidad = Database["public"]["Enums"]["compliance_periodicidad"];

// Organismos previos (SICOP, Secondi, etc.)
export type ComplianceDestinatario = {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  orden: number;
  activo: boolean;
};

export type ComplianceEstado = "vigente" | "por_vencer" | "vencido" | "faltante";

export type ComplianceRequisito = Database["public"]["Tables"]["compliance_requisitos"]["Row"];

// Vista v_compliance_estado — Row tal cual viene de la BD.
export type ComplianceEstadoRow = {
  requisito_id: string;
  requisito_codigo: string;
  requisito_nombre: string;
  cliente_aplica: ComplianceClienteAplica;
  nivel: ComplianceNivel;
  dias_alerta: number;
  periodicidad: CompliancePeriodicidad;
  chofer_id: string | null;
  chofer_nombre: string | null;
  camion_id: string | null;
  camion_patente: string | null;
  documento_id: string | null;
  documento_fuente: "chofer_documentos" | "camion_documentos" | "compliance_documentos" | null;
  fecha_vencimiento: string | null;
  archivo_id: string | null;
  estado: ComplianceEstado;
  dias_restantes: number | null;
  // Observaciones del documento vigente (se adjuntan aparte: la vista no las trae).
  observaciones?: string | null;
};

export type ProximaPresentacion = ComplianceEstadoRow & {
  // los campos extra los suma el caller
};

// Una entrada del historial de un requisito (chofer/unidad/empresa). Reúne
// documentos cargados a lo largo del tiempo, sin importar la fuente
// (compliance_documentos o el legajo del chofer/camión).
export type ComplianceHistorialDoc = {
  id: string;
  periodo: string | null;
  numero: string | null;
  fecha_emision: string | null;
  fecha_vencimiento: string | null;
  observaciones: string | null;
  archivo_id: string | null;
  nombre_archivo: string | null;
  created_at: string;
  cargado_por: string | null;
};

export const CLIENTE_LABEL: Record<ComplianceCliente, string> = {
  YPF: "YPF",
  LOMA_NEGRA: "Loma Negra",
};

export const NIVEL_LABEL: Record<ComplianceNivel, string> = {
  chofer: "Choferes",
  unidad: "Unidades",
  empresa: "Empresa",
};

// Fila normalizada del panel unificado `/compliance` — reúne en un solo checklist
// todas las fuentes (F931, YPF, Loma Negra, organismos) para ver de un vistazo qué
// vence y su estado. Es de solo lectura: cada fila abre su sección de detalle vía `href`.
export type ComplianceResumenRow = {
  id: string;
  /** Etiqueta de la fuente, sirve además como clave de filtro: "F931", "YPF", "Loma Negra", "Ambos", "SICOP", "Secondi"… */
  fuente: string;
  requisito: string;
  entidad: string;
  fecha_vencimiento: string | null;
  estado: ComplianceEstado;
  dias_restantes: number | null;
  observaciones: string | null;
  href: string;
};

// Tipo de fila para el checklist de organismos (más simple: sin cliente_aplica)
export type OrganismoChecklistRow = {
  requisito_id: string;
  requisito_codigo: string;
  requisito_nombre: string;
  nivel: ComplianceNivel;
  periodicidad: CompliancePeriodicidad;
  dias_alerta: number;
  // doc más reciente para este requisito (si existe)
  documento_id: string | null;
  fecha_emision: string | null;
  fecha_vencimiento: string | null;
  archivo_id: string | null;
  observaciones: string | null;            // observaciones del doc vigente
  presentado_por_nombre: string | null;   // nombre del usuario que cargó
  created_at: string | null;              // fecha/hora de la presentación
  // estado calculado
  estado: ComplianceEstado;
  dias_restantes: number | null;
};
