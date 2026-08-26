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

// `enviar_a` (a dónde se presenta el doc: portales/mails) es columna nueva y aún
// no está en database.ts generado — se suma acá hasta regenerar los tipos.
export type ComplianceRequisito =
  Database["public"]["Tables"]["compliance_requisitos"]["Row"] & {
    enviar_a?: string | null;
  };

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
  /**
   * Cuando el papel es del ACOPLADO y no del chasis. La fila viaja igual dentro
   * del alcance "unidad" —se agrupa en la ficha del chasis que lo lleva
   * enganchado— y estos dos campos son los que dicen de qué patente es.
   */
  acoplado_id?: string | null;
  acoplado_patente?: string | null;
  // Aseguradora del seguro por unidad (Nación / Segurcoop). Null salvo en esa rama.
  aseguradora?: string | null;
  // Observaciones del documento vigente (se adjuntan aparte: la vista no las trae).
  observaciones?: string | null;
  // Número del documento vigente (póliza, certificado…), misma vía que las observaciones.
  numero?: string | null;
  // Cuántos papeles tiene cargados el documento vigente (tabla puente, no la portada).
  archivos?: number;
};

/**
 * Ficha de una unidad para la cabecera del checklist. `v_compliance_estado` solo
 * trae `camion_id` + `camion_patente`, así que estos datos se traen aparte de
 * `camiones` (mismo criterio que las observaciones, ver `adjuntarDetalleDocumento`):
 * la vista también la consume `lib/alertas.ts` y no conviene ensancharla.
 */
export type UnidadInfo = {
  patente: string;
  marca: string | null;
  modelo: string | null;
  ano: number | null;
  capacidad_tn: number | null;
  tipo_camion: string | null;
  tercerizacion_estado: "interno" | "en_transicion" | "tercerizado" | null;
  km_actual: number | null;
  /** Chofer asignado hoy (`camiones.chofer_actual_id`) — misma fuente que el legajo. */
  chofer_id: string | null;
  chofer_nombre: string | null;
  /** Patentes de los acoplados vinculados vigentes (`camion_acoplados.hasta is null`). */
  acoplados: string[];
  /** Foto principal de la unidad (`camion_fotos.es_principal`), si tiene. */
  foto_url: string | null;
};

/**
 * Ficha del chofer para la cabecera de su grupo. Es lo mínimo para dibujar el
 * mismo avatar que en el legajo: la foto si la subieron y, si no, la silueta del
 * área (ver `AvatarPersona`) — con 78 tarjetas apiladas, una fila con cara se
 * encuentra mucho más rápido que una fila con texto.
 */
export type ChoferInfo = {
  nombre: string;
  /** `choferes.rol`: define qué silueta se dibuja cuando no hay foto. */
  rol: string | null;
  foto_url: string | null;
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
  /** Todos los papeles de esa presentación (frente y dorso, doc + anexo…). */
  archivos: { archivo_id: string; nombre: string | null }[];
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
  // Detalle libre del requisito. Se trae para que editarlo no lo borre.
  requisito_descripcion: string | null;
  nivel: ComplianceNivel;
  periodicidad: CompliancePeriodicidad;
  dias_alerta: number;
  // A dónde se presenta el documento (portal/mail) — texto libre del requisito.
  enviar_a: string | null;
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
