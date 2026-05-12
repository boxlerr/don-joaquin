export const CANALES = [
  {
    key: "email" as const,
    nombre: "Email",
    descripcion: "Notificaciones por correo electrónico",
    activoClave: "notificaciones_email_activas",
    configCampos: [
      {
        clave: "email_remitente",
        label: "Email remitente",
        placeholder: "notificaciones@empresa.com",
        type: "email" as const,
      },
    ],
  },
  {
    key: "whatsapp" as const,
    nombre: "WhatsApp",
    descripcion: "Alertas administrativas por WhatsApp",
    activoClave: "notificaciones_whatsapp_activas",
    configCampos: [
      {
        clave: "whatsapp_numero_remitente",
        label: "Número remitente",
        placeholder: "5491123456789 (formato internacional)",
        type: "tel" as const,
      },
    ],
  },
  {
    key: "webhook" as const,
    nombre: "Webhooks",
    descripcion: "Integraciones con sistemas externos",
    activoClave: "notificaciones_webhook_activa",
    configCampos: [
      {
        clave: "webhook_url",
        label: "URL del webhook",
        placeholder: "https://api.miservicio.com/eventos",
        type: "url" as const,
      },
    ],
  },
];

export type CanalKey = (typeof CANALES)[number]["key"];

export const ALERTAS = [
  {
    key: "vencimiento_docs",
    nombre: "Vencimiento de Documentos",
    descripcion: "Licencia de conducir, VTV, seguro de camión",
  },
  {
    key: "cheques_vencidos",
    nombre: "Cheques Vencidos",
    descripcion: "Alertas de cheques por cobrar/pagar",
  },
  {
    key: "viaticos_sin_rendir",
    nombre: "Viáticos sin Rendir",
    descripcion: "Recordatorio de viáticos pendientes de liquidación",
  },
  {
    key: "gastos_pendientes",
    nombre: "Gastos Pendientes",
    descripcion: "Registro de gastos sin aprobación",
  },
  {
    key: "cambios_caja",
    nombre: "Cambios en Caja",
    descripcion: "Movimientos de caja relevantes",
  },
  {
    key: "nuevo_viaje",
    nombre: "Nuevo Viaje",
    descripcion: "Notificación de viajes asignados a chofer",
  },
] as const;

export type AlertaKey = (typeof ALERTAS)[number]["key"];

export function alertaClave(key: string) {
  return `alerta_${key}_activa`;
}

export const DESTINATARIOS_CLAVE = "notificaciones_destinatarios_ids";
