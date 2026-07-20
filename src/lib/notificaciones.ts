import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarEmail, emailConfigurado, appUrl } from "@/lib/email";
import { getDocAlertasLive, getChequeAlertasLive } from "@/lib/alertas-live";
import { categoriaDeAlerta } from "@/app/(dashboard)/notificaciones/utils";
import {
  alertaColumnaDe,
  COLUMNAS_TODAS,
  tipoHabilitado,
} from "@/lib/alertas-routing";
import {
  renderEmail as renderEmailTemplate,
  type AlertaEmailView,
  type SeveridadEmail,
} from "@/lib/email-template";
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

// Matriz granular por usuario (qué tipo de aviso recibe cada uno por email).
const MATRIZ_CLAVE = "notificaciones_matriz_por_usuario";

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

// --- Render del email (la plantilla vive en ./email-template, sin server-only) ---

function aVista(a: AlertaEmail): AlertaEmailView {
  const cat = categoriaDeAlerta(a.tipo, a.entidad_tipo);
  return {
    titulo: a.titulo,
    mensaje: a.mensaje,
    severidad: a.severidad as SeveridadEmail,
    fecha_vencimiento: a.fecha_vencimiento,
    categoria: alertaColumnaDe(a),
    href: `${appUrl()}/notificaciones?categoria=${cat}&severidad=${a.severidad}`,
  };
}

function renderEmail(opts: { titulo: string; intro: string; alertas: AlertaEmail[] }): string {
  return renderEmailTemplate({
    baseUrl: appUrl(),
    titulo: opts.titulo,
    intro: opts.intro,
    alertas: opts.alertas.map(aVista),
  });
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
    .filter((a) => tipoHabilitado(a, params))
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

    const suyas = aEnviar.filter((a) => keys.has(alertaColumnaDe(a)));
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
    .filter((a) => tipoHabilitado(a, params))
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

  const filtradas = await construirResumenFiltrado(supabase, params);
  if (filtradas.length === 0) return { enviado: false, motivo: "sin_alertas" };

  // Reparto granular por usuario, igual que las críticas: cada uno recibe sólo
  // las columnas que tiene tildadas en la matriz (ej. Paula sólo Préstamos).
  // Fallback retrocompatible: sin matriz, hereda la vieja lista global.
  const matriz = parseMatriz(params.get(MATRIZ_CLAVE));
  const oldDest = new Set(parseIds(params.get(DESTINATARIOS_CLAVE)));

  const { data: usuariosActivos } = await supabase
    .from("usuarios")
    .select("id, email")
    .eq("estado", "activo");

  let huboDestinatario = false;
  let enviados = 0;
  let errorEnvio: string | undefined;

  for (const u of usuariosActivos ?? []) {
    if (!u.email) continue;
    const keys = new Set(matriz[u.id] ?? (oldDest.has(u.id) ? COLUMNAS_TODAS : []));
    if (keys.size === 0) continue;
    huboDestinatario = true;

    const suyas = filtradas.filter((a) => keys.has(alertaColumnaDe(a)));
    if (suyas.length === 0) continue;

    const html = renderEmail({
      titulo: "Resumen diario de alertas",
      intro: `Hay ${suyas.length} alerta${suyas.length !== 1 ? "s" : ""} pendiente${suyas.length !== 1 ? "s" : ""} para vos.`,
      alertas: suyas,
    });

    const res = await enviarEmail({
      para: [u.email],
      asunto: `📋 Resumen diario — ${suyas.length} alerta${suyas.length !== 1 ? "s" : ""} pendiente${suyas.length !== 1 ? "s" : ""}`,
      html,
    });

    if (res.ok) {
      enviados++;
    } else {
      errorEnvio = res.error;
      console.error(`[notificaciones] envío de resumen a ${u.email} falló:`, res.error);
    }
  }

  if (!huboDestinatario) return { enviado: false, motivo: "sin_destinatarios" };
  if (enviados === 0) {
    return { enviado: false, motivo: errorEnvio ? "error_envio" : "sin_alertas", error: errorEnvio };
  }

  return { enviado: true, total: filtradas.length };
}
