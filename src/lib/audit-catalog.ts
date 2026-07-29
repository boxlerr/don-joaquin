// Catálogo central de auditoría: etiquetas en español y tonos visuales para
// acciones y entidades. NO importa nada server-only: lo consumen tanto las
// Server Actions (al registrar) como los Client Components (al mostrar el panel).

/** Mapa de referencias resueltas: campo *_id -> { uuid -> etiqueta legible }. */
export type RefsMap = Record<string, Record<string, string>>;

/** Etiqueta legible de cada acción registrada en audit_log. */
export const ACCION_LABELS: Record<string, string> = {
  // Genéricas
  crear: "Creación",
  actualizar: "Actualización",
  editar: "Edición",
  eliminar: "Eliminación",
  cambio_estado: "Cambio de estado",
  exportar: "Exportación",
  importar: "Importación",
  // Acceso / seguridad
  login: "Inicio de sesión",
  login_fallido: "Intento fallido",
  logout: "Cierre de sesión",
  alerta_login: "Alerta de acceso",
  // Fotos
  foto_agregada: "Foto agregada",
  foto_eliminada: "Foto eliminada",
  foto_principal: "Foto marcada como principal",
  nota_foto: "Nota de foto",
  // Cliente: contactos / sucursales / requisitos
  contacto_agregado: "Contacto agregado",
  contacto_eliminado: "Contacto eliminado",
  sucursal_agregada: "Sucursal agregada",
  sucursal_eliminada: "Sucursal eliminada",
  requisito_agregado: "Requisito agregado",
  requisito_eliminado: "Requisito eliminado",
  requisito_estado: "Estado de requisito",
  // Documentación
  documento_agregado: "Documento agregado",
  documento_actualizado: "Documento actualizado",
  documento_eliminado: "Documento eliminado",
  // Chofer: asignación de camión
  camion_asignado: "Camión asignado",
  camion_desasignado: "Camión desasignado",
  // Chofer: legajo
  egreso_editado: "Egreso editado",
  apercibimiento_creado: "Apercibimiento creado",
  apercibimiento_eliminado: "Apercibimiento eliminado",
  licencia_creada: "Licencia creada",
  licencia_cerrada: "Licencia cerrada",
  licencia_eliminada: "Licencia eliminada",
  ausencia_creada: "Ausencia creada",
  ausencia_editada: "Ausencia editada",
  ausencia_cancelada: "Ausencia cancelada",
  vacaciones_saldo_creado: "Saldo de vacaciones creado",
  vacaciones_saldo_editado: "Saldo de vacaciones editado",
  // Segunda capa de auditoría: la escribe un trigger de la base, así que cubre
  // también lo que NO pasa por la app (scripts, SQL suelto, service role).
  vacaciones_db_insert: "Vacaciones — alta (registro de base)",
  vacaciones_db_update: "Vacaciones — cambio (registro de base)",
  vacaciones_db_delete: "Vacaciones — borrado (registro de base)",
  vacaciones_saldo_protegido: "Vacaciones — dato humano protegido de un proceso automático",
  vacaciones_observacion_migrada: "Vacaciones — observación archivada en la migración",
  prestamo_creado: "Préstamo creado",
  prestamo_saldo_actualizado: "Saldo de préstamo actualizado",
  prestamo_eliminado: "Préstamo eliminado",
  // Viaje
  facturado: "Facturado",
  cobrado: "Cobrado",
  crear_viajes_lote: "Alta de viajes en lote",
};

/** Etiqueta legible de cada tipo de entidad auditada. */
export const ENTIDAD_LABELS: Record<string, string> = {
  viaje: "Viaje",
  cheque: "Cheque",
  caja: "Caja",
  cliente: "Cliente",
  chofer: "Chofer",
  camion: "Camión",
  carga_combustible: "Carga de combustible",
  impuesto: "Impuesto",
  form931: "Formulario 931",
  mantenimiento: "Mantenimiento",
  rotura_goma: "Rotura de goma",
  siniestro: "Siniestro",
  extintor: "Extintor",
  gasto: "Gasto",
  rotacion_baja: "Baja de chofer",
  chofer_ausencia: "Ausencia / vacaciones",
  chofer_vacaciones_anio: "Saldo de vacaciones por año",
  planilla_diaria: "Planilla diaria",
  tarifa: "Tarifa",
  cliente_aumento: "Aumento de cliente",
  ruta: "Ruta",
  entrevista: "Entrevista",
  compliance_liq_loma: "Liquidación de Loma",
  compliance_dm_ypf: "DM de YPF",
  compliance_documentos: "Documento de compliance",
  usuarios: "Usuario",
  usuario: "Acceso",
  roles: "Rol",
  rol_areas: "Permisos de rol",
  rol_secciones: "Permisos de rol",
  usuario_areas: "Permisos de usuario",
  usuario_secciones: "Permisos de usuario",
  parametro_sistema: "Configuración",
  configuracion_notificaciones: "Notificaciones",
  insumo_catalogo: "Insumo",
  prestamo: "Préstamo",
  prestamo_cuota: "Cuota de préstamo",
  hoja_ruta: "Hoja de ruta",
  pesos_score_chofer: "Pesos de score",
};

/** Tono visual de un badge de acción, agrupado por familia. */
export type AccionTono = "crear" | "eliminar" | "actualizar" | "estado" | "acceso" | "neutro";

/** Clasifica una acción en un tono visual, por patrón de nombre. */
export function accionTono(accion: string): AccionTono {
  if (accion === "cambio_estado" || accion === "requisito_estado") return "estado";
  if (accion === "login" || accion === "logout" || accion === "login_fallido" || accion === "alerta_login")
    return "acceso";
  if (/^crear|_cread[oa]$|_agregad[oa]$|^importar$/.test(accion)) return "crear";
  if (/^eliminar$|_eliminad[oa]$|_cancelad[oa]$|_cerrada$/.test(accion)) return "eliminar";
  // El resto de mutaciones (actualizar, editar, *_editado, *_actualizado,
  // facturado, foto_principal, nota_foto, exportar) caen en "actualizar".
  return "actualizar";
}

/** Clases Tailwind por tono (mismos colores que ya usaba el panel). */
export const TONO_CLASSES: Record<AccionTono, string> = {
  crear: "bg-[#ECFDF5] text-[#065F46]",
  eliminar: "bg-[#FEE2E2] text-[#7F1D1D]",
  actualizar: "bg-[#FEF3C7] text-[#92400E]",
  estado: "bg-[#E0E7FF] text-[#3730A3]",
  acceso: "bg-[#E0F2FE] text-[#075985]",
  neutro: "bg-muted text-muted-foreground",
};

export function accionLabel(accion: string): string {
  return ACCION_LABELS[accion] ?? accion;
}

export function entidadLabel(entidadTipo: string): string {
  return ENTIDAD_LABELS[entidadTipo] ?? entidadTipo;
}

/** Clases del badge de una acción (background + text). */
export function accionClasses(accion: string): string {
  return TONO_CLASSES[accionTono(accion)];
}
