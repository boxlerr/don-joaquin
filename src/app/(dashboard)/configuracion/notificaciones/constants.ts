// `proximamente` marca el canal que todavía no envía nada. Se puede configurar
// pero no activar: el toggle prometía un envío que no existe en el código, así
// que quien lo prendía se quedaba esperando avisos que nunca iban a salir.
export const CANALES = [
  {
    key: "email" as const,
    nombre: "Email",
    descripcion: "Notificaciones por correo electrónico",
    activoClave: "notificaciones_email_activas",
    proximamente: false,
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
    proximamente: true,
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
    proximamente: true,
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

/**
 * Categorías de aviso.
 *
 * `cubre` no es decorativo: es la lista textual de lo que entra en cada
 * categoría, y se muestra en pantalla. Antes media docena de avisos (impuestos,
 * services, cumpleaños, ausencias, el tope de préstamos) caían en un cajón
 * llamado "Otros avisos" que no decía qué contenía, así que tildarlo o
 * destildarlo era a ciegas. Si se agrega un generador nuevo en lib/alertas.ts,
 * agregarlo también acá y en ENTIDAD_A_COLUMNA (lib/alertas-routing.ts).
 */
export const ALERTAS = [
  {
    key: "vencimiento_docs",
    nombre: "Vencimiento de Documentos",
    descripcion: "Documentación de choferes y camiones por vencer o vencida",
    cubre: ["Licencia de conducir, LiNTI, libreta sanitaria", "VTV, seguro y cédula del camión"],
  },
  {
    key: "cheques_vencidos",
    nombre: "Cheques",
    descripcion: "Cheques en cartera próximos a cobrarse, que se cobran hoy o ya pasados de fecha",
    cubre: ["Cheque en cartera próximo a cobrar", "Cheque que se cobra hoy", "Cheque pasado de fecha sin gestionar"],
  },
  {
    key: "viaticos_sin_rendir",
    nombre: "Viáticos sin Rendir",
    descripcion: "Recordatorio de viáticos pendientes de liquidación",
    cubre: ["Viático entregado y no rendido"],
  },
  {
    key: "gastos_pendientes",
    nombre: "Gastos Pendientes",
    descripcion: "Registro de gastos sin aprobación",
    cubre: ["Gasto cargado sin comprobante"],
  },
  {
    key: "cambios_caja",
    nombre: "Cierre de Caja",
    descripcion:
      "Un correo por día, a las 18:00, con todo lo que entró y salió. Trae montos y saldo: sección confidencial",
    cubre: [
      "Lo que entró y lo que salió en el día, con el neto",
      "Con cuánto quedó cada caja",
      "El detalle de los movimientos, uno por uno",
      "Cuando una caja se pasa del tope de gastos del mes",
    ],
  },
  {
    key: "nuevo_viaje",
    nombre: "Nuevo Viaje",
    descripcion: "Notificación de viajes asignados a chofer",
    cubre: ["Viaje asignado a un chofer", "Viaje sin cerrar pasadas las horas configuradas"],
  },
  {
    key: "vencimiento_compliance",
    nombre: "Compliance Loma Negra / YPF",
    descripcion: "Documentos por vencer o vencidos a presentar a clientes principales",
    cubre: [
      "Requisitos de Loma Negra y YPF (30 / 15 / 5 días y vencido)",
      "Organismos previos: SICOP, Secondi y demás",
      "Formulario 931 sin presentar",
    ],
  },
  {
    key: "prestamos_vencimiento",
    nombre: "Préstamos",
    descripcion: "Cuotas bancarias y tope mensual. Trae montos: sección confidencial",
    cubre: [
      "Cuota que vence esta semana, mañana o que vence hoy",
      "Cuota vencida sin marcarse como pagada",
      "Un mes que se pasa del tope de pagos fijado",
    ],
  },
  {
    key: "prevision_financiera",
    nombre: "Meses apretados",
    descripcion:
      "Aviso cuando un mes que viene se pasa del límite fijado en Previsión. Suma cuotas, cheques nuestros y sueldos: sección confidencial",
    cubre: [
      "Un mes que se pasa del límite en pesos",
      "Un mes en el que los pagos se llevan más del % de la facturación fijado",
    ],
  },
  {
    key: "impuestos",
    nombre: "Impuestos",
    descripcion: "Vencimientos impositivos sin marcar como presentados",
    cubre: ["Impuesto por vencer (30 / 15 / 5 días)", "Impuesto vencido y no presentado"],
  },
  {
    key: "mantenimiento",
    nombre: "Mantenimiento",
    descripcion: "Services programados e insumos del catálogo",
    cubre: [
      "Próximo service por fecha, próximo o vencido",
      "Insumos del catálogo con el precio sin actualizar",
    ],
  },
  {
    key: "rrhh_eventos",
    // "Efemérides" era la palabra del diccionario, no la de la oficina: nadie
    // sabía qué había adentro sin abrirlo.
    nombre: "Cumpleaños y aniversarios",
    descripcion: "Cumpleaños, aniversarios y fin de período de prueba",
    cubre: [
      "Cumpleaños de choferes, administración y taller",
      "Aniversarios de antigüedad",
      "Fin del período de prueba (30 / 15 / 5 días)",
    ],
  },
  {
    key: "ausencias_vacaciones",
    nombre: "Ausencias y vacaciones",
    descripcion: "Quién no va a estar, y días de vacaciones que se pierden",
    cubre: [
      "Ausencia o permiso programado que arranca esta semana",
      "Saldo de vacaciones del año anterior que vence el 31/12",
    ],
  },
] as const;

export type AlertaKey = (typeof ALERTAS)[number]["key"];

export function alertaClave(key: string) {
  return `alerta_${key}_activa`;
}

export const DESTINATARIOS_CLAVE = "notificaciones_destinatarios_ids";

// Matriz granular por usuario: qué tipos de alerta recibe cada uno.
// Formato JSON: { [usuarioId]: ["cheques_vencidos", "nuevo_viaje", ...] }
export const MATRIZ_CLAVE = "notificaciones_matriz_por_usuario";

// Cajón final: sólo lo que no encaja en ninguna categoría. Hoy no lo usa ningún
// generador — queda como red para que un aviso nuevo nunca se pierda en silencio.
export const OTROS_AVISOS_COLUMNA = {
  key: "otros_avisos",
  nombre: "Otros avisos",
  descripcion: "Red de seguridad: avisos que todavía no tienen categoría propia",
  cubre: ["Cualquier aviso nuevo mientras no se le asigne una categoría"],
} as const;

/** Todas las categorías configurables: las nombradas + el cajón final. */
export const CATEGORIAS: readonly {
  key: string;
  nombre: string;
  descripcion: string;
  cubre: readonly string[];
}[] = [...ALERTAS, OTROS_AVISOS_COLUMNA];

// Columnas de la matriz: las categorías + el cajón final.
export const ALERTA_COLUMNAS = CATEGORIAS.map((c) => ({ key: c.key, nombre: c.nombre }));
