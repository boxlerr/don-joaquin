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
  importar_hoja_ruta: "Importación de hoja de ruta",
  rotar_enlace_gasoil: "Enlace de gasoil rotado",
  // Compliance: cerrar una liquidación / DM y editar sus fechas.
  completar_liq_loma: "Liquidación de Loma completada",
  completar_dm_ypf: "DM de YPF completado",
  editar_envio_compliance: "Fecha de envío editada",
  editar_vencimiento_compliance: "Vencimiento editado",
  cargar_presentacion_organismo: "Presentación cargada",
  crear_requisito_compliance: "Requisito creado",
  editar_requisito_compliance: "Requisito editado",
  eliminar_requisito_compliance: "Requisito eliminado",
  desactivar_requisito_compliance: "Requisito dado de baja",
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
  impuesto_vencimiento: "Vencimiento de impuesto",
  impuesto_archivo: "Archivo de impuesto",
  sueldo_admin_mes: "Sueldo de administración",
  form931: "Formulario 931",
  mantenimiento: "Mantenimiento",
  costo_rep_rep: "Costo de repuestos y reparaciones",
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
  compliance_requisitos: "Requisito de compliance",
  // Las tres fuentes de un vencimiento de compliance: el documento puede vivir
  // en su tabla propia o colgado del legajo del chofer / de la unidad.
  compliance_documentos: "Documento de compliance",
  chofer_documentos: "Documento de chofer",
  camion_documentos: "Documento de camión",
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
  // Gasoil de la vuelta: el cuadro de rindes, lo que se le autoriza a cada
  // chofer y el enlace público con el que lo anota él mismo.
  gasoil_tarifa: "Rinde de un tramo",
  gasoil_autorizacion: "Gasoil autorizado",
  gasoil_enlace: "Enlace de gasoil para choferes",
};

/** Tono visual de un badge de acción, agrupado por familia. */
export type AccionTono = "crear" | "eliminar" | "actualizar" | "estado" | "acceso" | "neutro";

/** Clasifica una acción en un tono visual, por patrón de nombre. */
export function accionTono(accion: string): AccionTono {
  if (accion === "cambio_estado" || accion === "requisito_estado") return "estado";
  if (accion === "login" || accion === "logout" || accion === "login_fallido" || accion === "alerta_login")
    return "acceso";
  // `^importar` y no `^importar$`: importar_hoja_ruta también crea viajes, y con
  // el ancla estricta caía en "actualizar" (ámbar) — un import de 1.400 viajes
  // leído como una edición menor.
  if (/^crear|_cread[oa]$|_agregad[oa]$|^importar/.test(accion)) return "crear";
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
