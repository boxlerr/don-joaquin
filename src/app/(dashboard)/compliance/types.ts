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
};

export type ProximaPresentacion = ComplianceEstadoRow & {
  // los campos extra los suma el caller
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
  presentado_por_nombre: string | null;   // nombre del usuario que cargó
  created_at: string | null;              // fecha/hora de la presentación
  // estado calculado
  estado: ComplianceEstado;
  dias_restantes: number | null;
};
