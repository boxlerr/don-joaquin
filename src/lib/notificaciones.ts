import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarEmail, emailConfigurado, appUrl } from "@/lib/email";
import { getDocAlertasLive, getChequeAlertasLive } from "@/lib/alertas-live";
import { categoriaDeAlerta } from "@/app/(dashboard)/notificaciones/utils";
import type { Database } from "@/types/database";

/**
 * Capa de notificaciones por email.
 *
 * Decide A QUIÉN y QUÉ se envía respetando la configuración que el admin ya
 * maneja en /configuracion/notificaciones (canal Email activo, qué tipos de
 * alerta y qué usuarios reciben). No abre nuevas pantallas: reutiliza los
 * `parametros_sistema` existentes.
 *
 * - Críticas → se envían apenas se detectan (idempotente vía `notificacion_procesada`).
 * - Resumen diario → lo dispara el cron una vez por día.
 */

type AlertaTipo = Database["public"]["Enums"]["alerta_tipo"];
type Severidad = Database["public"]["Enums"]["alerta_severidad"];

type AlertaEmail = {
  id: string;
  tipo: AlertaTipo;
  titulo: string;
  mensaje: string;
  severidad: Severidad;
  fecha_vencimiento: string | null;
  entidad_tipo: string | null;
};

// Orden de presentación del email: replica el de la vista /notificaciones
// (ver NotificacionesView.tsx). Mantener ambos en sync si se cambia el criterio.
//  1) Severidad (crítica → advertencia → info).
//  2) Bloque de evento de RRHH: cumpleaños juntos, aniversarios juntos, prueba;
//     el resto de las alertas queda en un bloque posterior común.
//  3) Fecha de vencimiento más próxima primero (ISO, orden lexicográfico =
//     cronológico); las alertas sin fecha van al final.
const SEV_ORDEN: Record<Severidad, number> = { critica: 0, advertencia: 1, info: 2 };

const EVENTO_TIPO_PRIORITY: Record<string, number> = {
  personal_cumple: 0,
  choferes_cumple: 0,
  personal_aniversario: 1,
  choferes_aniversario: 1,
  choferes_periodo_prueba: 2,
};

function compararAlertasEmail(a: AlertaEmail, b: AlertaEmail): number {
  const sa = SEV_ORDEN[a.severidad];
  const sb = SEV_ORDEN[b.severidad];
  if (sa !== sb) return sa - sb;
  const pa = EVENTO_TIPO_PRIORITY[a.entidad_tipo ?? ""] ?? 99;
  const pb = EVENTO_TIPO_PRIORITY[b.entidad_tipo ?? ""] ?? 99;
  if (pa !== pb) return pa - pb;
  const fa = a.fecha_vencimiento;
  const fb = b.fecha_vencimiento;
  if (fa && fb) return fa < fb ? -1 : fa > fb ? 1 : 0;
  if (fa) return -1;
  if (fb) return 1;
  return 0;
}

// Claves de `parametros_sistema` (mismas que usa la UI de configuración).
const CANAL_EMAIL_CLAVE = "notificaciones_email_activas";
const DESTINATARIOS_CLAVE = "notificaciones_destinatarios_ids";
const alertaClave = (key: string) => `alerta_${key}_activa`;

// Mapea cada tipo de alerta de la base al toggle correspondiente de la UI.
// Los tipos sin toggle propio (mantenimiento, auditoría, "otro": cumpleaños,
// período de prueba, ausencias) no se suprimen: se incluyen siempre que el
// canal Email esté activo.
const TIPO_A_TOGGLE: Partial<Record<AlertaTipo, string>> = {
  vencimiento_doc_camion: "vencimiento_docs",
  vencimiento_doc_chofer: "vencimiento_docs",
  vencimiento_cheque: "cheques_vencidos",
  cheque_rechazado_recordatorio: "cheques_vencidos",
  viatico_pendiente_rendicion: "viaticos_sin_rendir",
  gasto_sin_comprobante: "gastos_pendientes",
  viaje_sin_cerrar: "nuevo_viaje",
  vencimiento_compliance: "vencimiento_compliance",
};

// Matriz granular por usuario (qué tipo de aviso recibe cada uno por email).
const MATRIZ_CLAVE = "notificaciones_matriz_por_usuario";
const OTROS_AVISOS = "otros_avisos";
const COLUMNAS_TODAS = [
  "vencimiento_docs", "cheques_vencidos", "viaticos_sin_rendir", "gastos_pendientes",
  "cambios_caja", "nuevo_viaje", "vencimiento_compliance", OTROS_AVISOS,
];

/** Columna de la matriz a la que pertenece un tipo de alerta. */
function alertaColumnaDe(tipo: AlertaTipo): string {
  return TIPO_A_TOGGLE[tipo] ?? OTROS_AVISOS;
}

function parseIds(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function parseMatriz(raw: string | undefined): Record<string, string[]> {
  if (!raw) return {};
  try {
    const p = JSON.parse(raw);
    return p && typeof p === "object" && !Array.isArray(p) ? p : {};
  } catch {
    return {};
  }
}

type Supabase = ReturnType<typeof createAdminClient>;

async function leerParametros(supabase: Supabase): Promise<Map<string, string>> {
  const { data } = await supabase
    .from("parametros_sistema")
    .select("clave, valor")
    .eq("categoria", "notificaciones");
  return new Map((data ?? []).map((p) => [p.clave, p.valor ?? ""]));
}

function tipoHabilitado(tipo: AlertaTipo, params: Map<string, string>): boolean {
  const key = TIPO_A_TOGGLE[tipo];
  if (!key) return true; // sin toggle propio → no se suprime
  return params.get(alertaClave(key)) === "true";
}

async function getDestinatarios(
  supabase: Supabase,
  params: Map<string, string>,
): Promise<string[]> {
  const raw = params.get(DESTINATARIOS_CLAVE);
  if (!raw) return [];
  let ids: string[];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    ids = parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
  if (ids.length === 0) return [];

  const { data } = await supabase
    .from("usuarios")
    .select("email")
    .in("id", ids)
    .eq("estado", "activo");

  return (data ?? []).map((u) => u.email).filter((e): e is string => Boolean(e));
}

// --- Render del email (estilos inline: requisito de los clientes de correo) ---

const SEV_STYLE: Record<Severidad, { label: string; bg: string; border: string; text: string }> = {
  critica: { label: "Crítica", bg: "#FEE2E2", border: "#FCA5A5", text: "#7F1D1D" },
  advertencia: { label: "Advertencia", bg: "#FFFBEB", border: "#FDE68A", text: "#92400E" },
  info: { label: "Info", bg: "#EFF6FF", border: "#BFDBFE", text: "#1E40AF" },
};

function formatFecha(f: string | null): string {
  if (!f) return "";
  const parts = f.split("-");
  if (parts.length !== 3) return f;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderAlerta(a: AlertaEmail): string {
  const sev = SEV_STYLE[a.severidad];
  // Cada alerta linkea a la vista in-app, filtrada por su categoría y severidad,
  // para aterrizar directo en esa sección de /notificaciones.
  const cat = categoriaDeAlerta(a.tipo, a.entidad_tipo);
  const url = `${appUrl()}/notificaciones?categoria=${cat}&amp;severidad=${a.severidad}`;
  const venc = a.fecha_vencimiento
    ? `<div style="font-size:12px;color:#64748b;margin-top:6px;">Vence: ${formatFecha(a.fecha_vencimiento)}</div>`
    : "";
  return `
    <tr>
      <td style="padding:0 0 12px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e2e8f0;border-left:4px solid ${sev.border};border-radius:8px;">
          <tr>
            <td style="padding:14px 16px;">
              <a href="${url}" style="display:block;text-decoration:none;color:inherit;">
                <span style="display:inline-block;font-size:11px;font-weight:600;color:${sev.text};background:${sev.bg};border-radius:9999px;padding:2px 10px;margin-bottom:8px;">${sev.label}</span>
                <div style="font-size:14px;font-weight:600;color:#0f172a;">${escapeHtml(a.titulo)}</div>
                <div style="font-size:13px;color:#475569;margin-top:4px;line-height:1.5;">${escapeHtml(a.mensaje)}</div>
                ${venc}
                <div style="font-size:12px;color:#0088D1;font-weight:600;margin-top:8px;">Ver en notificaciones &rarr;</div>
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

function renderEmail(opts: { titulo: string; intro: string; alertas: AlertaEmail[] }): string {
  const boton = `<tr><td style="padding:8px 0 0 0;">
         <a href="${appUrl()}/notificaciones" style="display:inline-block;background:#0088D1;color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;padding:10px 18px;border-radius:8px;">Ver en el sistema</a>
       </td></tr>`;

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
        <tr><td style="padding:0 16px 16px 16px;">
          <div style="font-size:18px;font-weight:700;color:#0088D1;">Don Joaquín</div>
          <div style="font-size:15px;font-weight:600;color:#0f172a;margin-top:8px;">${escapeHtml(opts.titulo)}</div>
          <div style="font-size:13px;color:#64748b;margin-top:4px;">${escapeHtml(opts.intro)}</div>
        </td></tr>
        <tr><td style="padding:0 16px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            ${opts.alertas.map(renderAlerta).join("")}
            ${boton}
          </table>
        </td></tr>
        <tr><td style="padding:16px;">
          <div style="font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:12px;">
            Aviso automático del sistema de gestión Don Joaquín. Para dejar de recibir estos correos, ajustá los destinatarios en Configuración → Notificaciones.
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// --- API pública ---

export type ResultadoCriticas =
  | { enviadas: number }
  | { enviadas: 0; motivo: string; error?: string };

/**
 * Envía por email las alertas críticas pendientes que todavía no se notificaron.
 * Idempotente: marca `notificacion_procesada = true` al enviar, así no se repiten.
 * Pensada para llamarse después de generar alertas (botón manual o cron).
 */
export async function procesarNotificacionesCriticas(): Promise<ResultadoCriticas> {
  if (!emailConfigurado()) return { enviadas: 0, motivo: "smtp_no_configurado" };

  const supabase = createAdminClient();
  const params = await leerParametros(supabase);

  if (params.get(CANAL_EMAIL_CLAVE) !== "true") {
    return { enviadas: 0, motivo: "canal_email_inactivo" };
  }

  const { data: criticas } = await supabase
    .from("alertas")
    .select("id, tipo, titulo, mensaje, severidad, fecha_vencimiento, entidad_tipo")
    .eq("estado", "pendiente")
    .eq("severidad", "critica")
    .eq("notificacion_procesada", false)
    .order("fecha_disparo", { ascending: false })
    .limit(100);

  // Orden de presentación por fecha de vencimiento (el filtro de reparto por
  // usuario preserva este orden).
  const aEnviar = (criticas ?? [])
    .filter((a) => tipoHabilitado(a.tipo, params))
    .sort(compararAlertasEmail);
  if (aEnviar.length === 0) return { enviadas: 0, motivo: "nada_pendiente" };

  // Reparto granular: cada usuario recibe solo los tipos que tiene habilitados en
  // la matriz. Fallback retrocompatible: si no hay matriz para un usuario, hereda
  // la vieja lista global de destinatarios (recibe todo).
  const matriz = parseMatriz(params.get(MATRIZ_CLAVE));
  const oldDest = new Set(parseIds(params.get(DESTINATARIOS_CLAVE)));

  const { data: usuariosActivos } = await supabase
    .from("usuarios")
    .select("id, email")
    .eq("estado", "activo");

  const enviadasIds = new Set<string>();
  let huboDestinatario = false;
  let errorEnvio: string | undefined;

  for (const u of usuariosActivos ?? []) {
    if (!u.email) continue;
    const keys = new Set(matriz[u.id] ?? (oldDest.has(u.id) ? COLUMNAS_TODAS : []));
    if (keys.size === 0) continue;
    huboDestinatario = true;

    const suyas = aEnviar.filter((a) => keys.has(alertaColumnaDe(a.tipo)));
    if (suyas.length === 0) continue;

    const subject =
      suyas.length === 1
        ? `🔴 Alerta crítica: ${suyas[0]!.titulo}`
        : `🔴 ${suyas.length} alertas críticas — Don Joaquín`;
    const html = renderEmail({
      titulo: suyas.length === 1 ? "Nueva alerta crítica" : "Nuevas alertas críticas",
      intro: "Se detectaron situaciones críticas que requieren atención.",
      alertas: suyas,
    });

    const res = await enviarEmail({ para: [u.email], asunto: subject, html });
    if (res.ok) {
      suyas.forEach((a) => enviadasIds.add(a.id));
    } else {
      errorEnvio = res.error;
      console.error(`[notificaciones] envío de críticas a ${u.email} falló:`, res.error);
    }
  }

  if (!huboDestinatario) return { enviadas: 0, motivo: "sin_destinatarios" };
  if (enviadasIds.size === 0) {
    return { enviadas: 0, motivo: errorEnvio ? "error_envio" : "nada_pendiente", error: errorEnvio };
  }

  // Solo marcamos como procesadas las que efectivamente se enviaron.
  await supabase
    .from("alertas")
    .update({ notificacion_procesada: true })
    .in("id", [...enviadasIds]);

  return { enviadas: enviadasIds.size };
}

export type ResultadoResumen =
  | { enviado: true; total: number }
  | { enviado: false; motivo: string; error?: string };

/**
 * Arma la lista de alertas del resumen: las pendientes de la tabla (sin documentos
 * ni cheques, que se recalculan en vivo para reflejar el estado real y escalar a
 * "vencido"), filtradas por los toggles y ordenadas para presentación.
 */
async function construirResumenFiltrado(
  supabase: Supabase,
  params: Map<string, string>,
): Promise<AlertaEmail[]> {
  const [{ data: pendientes }, docLive, chequeLive] = await Promise.all([
    supabase
      .from("alertas")
      .select("id, tipo, titulo, mensaje, severidad, fecha_vencimiento, entidad_tipo")
      .eq("estado", "pendiente")
      .not("tipo", "in", "(vencimiento_doc_camion,vencimiento_doc_chofer,vencimiento_cheque)")
      .order("severidad", { ascending: false })
      .order("fecha_disparo", { ascending: false })
      .limit(200),
    getDocAlertasLive(supabase),
    getChequeAlertasLive(supabase),
  ]);

  // Orden de presentación: severidad → bloque de evento → fecha de vencimiento.
  return [...(pendientes ?? []), ...docLive, ...chequeLive]
    .filter((a) => tipoHabilitado(a.tipo, params))
    .sort(compararAlertasEmail);
}

/**
 * Envío de PRUEBA: manda el resumen (mismo formato y contenido que el diario) a un
 * único correo. No exige el canal Email activo ni la lista de destinatarios y no
 * toca ningún estado en la base, así probar es inofensivo. Si no hay alertas, igual
 * envía el correo (para verificar el SMTP y el formato).
 */
export async function enviarResumenPrueba(email: string): Promise<ResultadoResumen> {
  if (!emailConfigurado()) return { enviado: false, motivo: "smtp_no_configurado" };

  const supabase = createAdminClient();
  const params = await leerParametros(supabase);
  const filtradas = await construirResumenFiltrado(supabase, params);

  const html = renderEmail({
    titulo: "Prueba — Resumen de alertas",
    intro:
      filtradas.length > 0
        ? `Envío de prueba. Hay ${filtradas.length} alerta${filtradas.length !== 1 ? "s" : ""} pendiente${filtradas.length !== 1 ? "s" : ""} en el sistema.`
        : "Envío de prueba. No hay alertas pendientes en este momento.",
    alertas: filtradas,
  });

  const res = await enviarEmail({
    para: [email],
    asunto: "🧪 Prueba de notificaciones — Don Joaquín",
    html,
  });

  if (!res.ok) {
    console.error("[notificaciones] envío de prueba falló:", res.error);
    return { enviado: false, motivo: res.skipped ? "smtp_no_configurado" : "error_envio", error: res.error };
  }

  return { enviado: true, total: filtradas.length };
}

/**
 * Envía un resumen con TODAS las alertas pendientes (no toca `notificacion_procesada`).
 * Lo dispara el cron diario.
 */
export async function enviarResumenDiario(): Promise<ResultadoResumen> {
  if (!emailConfigurado()) return { enviado: false, motivo: "smtp_no_configurado" };

  const supabase = createAdminClient();
  const params = await leerParametros(supabase);

  if (params.get(CANAL_EMAIL_CLAVE) !== "true") {
    return { enviado: false, motivo: "canal_email_inactivo" };
  }

  const destinatarios = await getDestinatarios(supabase, params);
  if (destinatarios.length === 0) return { enviado: false, motivo: "sin_destinatarios" };

  const filtradas = await construirResumenFiltrado(supabase, params);
  if (filtradas.length === 0) return { enviado: false, motivo: "sin_alertas" };

  const html = renderEmail({
    titulo: "Resumen diario de alertas",
    intro: `Hay ${filtradas.length} alerta${filtradas.length !== 1 ? "s" : ""} pendiente${filtradas.length !== 1 ? "s" : ""} en el sistema.`,
    alertas: filtradas,
  });

  const res = await enviarEmail({
    para: destinatarios,
    asunto: `📋 Resumen diario — ${filtradas.length} alerta${filtradas.length !== 1 ? "s" : ""} pendiente${filtradas.length !== 1 ? "s" : ""}`,
    html,
  });

  if (!res.ok) {
    console.error("[notificaciones] envío de resumen falló:", res.error);
    return { enviado: false, motivo: res.skipped ? "smtp_no_configurado" : "error_envio", error: res.error };
  }

  return { enviado: true, total: filtradas.length };
}
