import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  CLIENTE DE CORREO — SMTP vía nodemailer
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  Mismo patrón gratuito que usamos en conectar-uiab: todo el correo sale por
 *  un único servidor SMTP que se configura una sola vez. Sin servicios pagos
 *  (Resend, etc.). Las credenciales son secretos: solo en env, nunca en la base.
 *
 *  Proveedores SMTP gratuitos:
 *   - Gmail + App Password → ~500 correos/día, requiere 2FA en la cuenta.
 *   - Brevo (ex-Sendinblue) → 300 correos/día en el plan gratuito.
 *
 *  Envío seguro:
 *   - Si falta cualquier variable SMTP, no tiramos: logueamos warn y devolvemos
 *     `{ skipped: true }`. Una alerta nunca debería fallar por un correo caído.
 *   - Los errores del transporter se capturan y loguean, nunca se propagan.
 */

let transporterSingleton: Transporter | null = null;
let configFaltanteLogueado = false;

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  secure: boolean;
}

function leerConfigSmtp(): SmtpConfig | null {
  const host = process.env.SMTP_HOST;
  const portRaw = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !portRaw || !user || !pass) return null;

  const port = parseInt(portRaw, 10);
  if (!Number.isFinite(port)) return null;

  // 465 = TLS implícito. 587 y 25 = STARTTLS.
  const secure =
    process.env.SMTP_SECURE !== undefined
      ? process.env.SMTP_SECURE === "true"
      : port === 465;

  return { host, port, user, pass, secure };
}

/** True si hay credenciales SMTP cargadas. La UI lo usa para avisar si falta configurar. */
export function emailConfigurado(): boolean {
  return leerConfigSmtp() !== null;
}

function obtenerTransporter(): Transporter | null {
  if (transporterSingleton) return transporterSingleton;
  const cfg = leerConfigSmtp();
  if (!cfg) {
    if (!configFaltanteLogueado) {
      console.warn(
        "[email] SMTP_HOST/PORT/USER/PASS no configurados — los correos se saltarán silenciosamente.",
      );
      configFaltanteLogueado = true;
    }
    return null;
  }
  transporterSingleton = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return transporterSingleton;
}

/**
 * Remitente por defecto. Debe ser un correo válido del dominio SMTP (Gmail y
 * otros rechazan un From distinto al usuario autenticado). Acepta el formato
 * `"Don Joaquín <casilla@gmail.com>"`.
 */
function remitentePorDefecto(): string {
  return process.env.EMAIL_FROM || process.env.SMTP_USER || "no-reply@donjoaquin.app";
}

export interface EnviarEmailInput {
  para: string | string[];
  asunto: string;
  html: string;
  texto?: string;
  responderA?: string;
}

export interface EnviarEmailResultado {
  ok: boolean;
  id?: string;
  skipped?: boolean;
  error?: string;
}

/**
 * Envía un email. Nunca propaga excepciones: captura y loguea.
 * Usar desde server actions y API routes.
 */
export async function enviarEmail(input: EnviarEmailInput): Promise<EnviarEmailResultado> {
  const destino = Array.isArray(input.para) ? input.para.filter(Boolean) : [input.para];

  const transporter = obtenerTransporter();
  if (!transporter) {
    console.warn(
      `[email] SMTP no configurado — saltando envío a ${destino.join(",")}: "${input.asunto}"`,
    );
    return { ok: false, skipped: true };
  }
  if (destino.length === 0) return { ok: false, error: "Sin destinatarios" };

  try {
    const info = await transporter.sendMail({
      from: remitentePorDefecto(),
      to: destino.join(", "),
      subject: input.asunto,
      html: input.html,
      text: input.texto,
      replyTo: input.responderA,
    });
    return { ok: true, id: info.messageId };
  } catch (err: unknown) {
    console.error("[email] Excepción enviando email por SMTP:", err);
    // Reiniciar el singleton por si la conexión quedó en estado inválido.
    transporterSingleton = null;
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return { ok: false, error: msg };
  }
}

/**
 * URL base pública de la app: de acá salen el logo y los links de los emails.
 *
 * `VERCEL_URL` es la trampa: apunta al deploy puntual
 * (`don-joaquin-a1b2c3.vercel.app`), no al dominio. Ese host está detrás de la
 * protección de deploys, así que el `<img>` del membrete no cargaba y el correo
 * llegaba con el cuadradito del signo de pregunta. Por eso primero va
 * `VERCEL_PROJECT_PRODUCTION_URL`, que Vercel setea sola con el dominio de
 * producción y no hay que configurar en ningún lado.
 *
 * Prioridad: `NEXT_PUBLIC_APP_URL` (override manual) → dominio de producción →
 * el deploy puntual (último recurso, sirve en previews) → localhost.
 */
export function appUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
