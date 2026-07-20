/**
 * Plantilla HTML de los emails de alertas.
 *
 * A propósito NO depende del servidor (sin `server-only`, sin Supabase, sin
 * SMTP): recibe todo ya resuelto y devuelve un string. Así se puede renderizar
 * desde un script para previsualizar los diseños sin tocar la base.
 *
 * Identidad: fondo blanco, logo de Don Joaquín, azul de marca #0088D1 y la
 * misma paleta funcional que usa el sistema (ver design.md). Todo va con
 * estilos inline y tablas porque es lo único que respetan los clientes de mail.
 */

export type SeveridadEmail = "critica" | "advertencia" | "info";

export type AlertaEmailView = {
  titulo: string;
  mensaje: string;
  severidad: SeveridadEmail;
  fecha_vencimiento: string | null;
  /** Clave de CATEGORIA_ESTILO (la misma columna de la matriz de notificaciones). */
  categoria: string;
  /** Link ya resuelto a la vista in-app. */
  href: string;
};

const SEV_STYLE: Record<SeveridadEmail, { label: string; bg: string; border: string; text: string }> = {
  critica: { label: "Crítica", bg: "#FEE2E2", border: "#FCA5A5", text: "#7F1D1D" },
  advertencia: { label: "Advertencia", bg: "#FFFBEB", border: "#FDE68A", text: "#92400E" },
  info: { label: "Info", bg: "#EFF6FF", border: "#BFDBFE", text: "#1E40AF" },
};

/**
 * Identidad visual por tipo de aviso: cada categoría tiene su color, su ícono y
 * su nombre, así el mail se reconoce de un vistazo antes de leerlo. Las claves
 * son las columnas de la matriz de notificaciones, para que lo que se configura
 * y lo que llega por mail sean la misma cosa.
 */
export const CATEGORIA_ESTILO: Record<
  string,
  { label: string; color: string; bg: string; borde: string; icono: string; cta: string }
> = {
  vencimiento_docs: {
    label: "Documentación",
    color: "#0369A1", bg: "#E0F2FE", borde: "#BAE6FD",
    icono: "📄", cta: "Ver documentación",
  },
  cheques_vencidos: {
    label: "Cheques",
    color: "#047857", bg: "#D1FAE5", borde: "#A7F3D0",
    icono: "🧾", cta: "Ver cheques",
  },
  viaticos_sin_rendir: {
    label: "Viáticos",
    color: "#B45309", bg: "#FEF3C7", borde: "#FDE68A",
    icono: "💵", cta: "Ver viáticos",
  },
  gastos_pendientes: {
    label: "Gastos",
    color: "#7C3AED", bg: "#EDE9FE", borde: "#DDD6FE",
    icono: "🧮", cta: "Ver gastos",
  },
  cambios_caja: {
    label: "Caja",
    color: "#0D9488", bg: "#CCFBF1", borde: "#99F6E4",
    icono: "🏦", cta: "Ver caja",
  },
  nuevo_viaje: {
    label: "Viajes",
    color: "#0088D1", bg: "#E1F5FE", borde: "#B3E5FC",
    icono: "🚚", cta: "Ver viajes",
  },
  vencimiento_compliance: {
    label: "Compliance",
    color: "#0E7490", bg: "#CFFAFE", borde: "#A5F3FC",
    icono: "🛡️", cta: "Ver compliance",
  },
  prestamos_vencimiento: {
    label: "Préstamos",
    color: "#4338CA", bg: "#E0E7FF", borde: "#C7D2FE",
    icono: "🏛️", cta: "Ver préstamos",
  },
  otros_avisos: {
    label: "Aviso",
    color: "#475569", bg: "#F1F5F9", borde: "#E2E8F0",
    icono: "🔔", cta: "Ver aviso",
  },
};

function estiloDe(categoria: string) {
  return CATEGORIA_ESTILO[categoria] ?? CATEGORIA_ESTILO.otros_avisos!;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatFecha(f: string | null): string {
  if (!f) return "";
  const parts = f.split("-");
  if (parts.length !== 3) return f;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/**
 * Cada aviso se compone sólo con tipografía y una línea fina de separación:
 * sin caja redondeada, sin barra de color a la izquierda y sin franjas
 * pasteles. El color de la categoría aparece en dosis chicas (el rótulo y el
 * enlace), que es lo que le da carácter de comunicación seria y no de tarjeta.
 */
function renderAlerta(a: AlertaEmailView): string {
  const sev = SEV_STYLE[a.severidad];
  const est = estiloDe(a.categoria);

  // Una alerta ya vencida no puede decir "vence": se lee mal justo en el caso
  // más urgente.
  const hoyISO = new Date().toISOString().slice(0, 10);
  const yaVencio = a.fecha_vencimiento !== null && a.fecha_vencimiento < hoyISO;
  const meta = a.fecha_vencimiento
    ? `<div style="font-size:12px;color:${yaVencio ? "#B91C1C" : "#94A3B8"};margin-top:9px;">${
        yaVencio ? "Venció el" : "Vence el"
      } ${formatFecha(a.fecha_vencimiento)}</div>`
    : "";

  return `
    <tr>
      <td style="padding:20px 0 22px 0;border-top:1px solid #E2E8F0;">
        <div style="font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:${est.color};">
          ${escapeHtml(est.label)}
          <span style="color:#CBD5E1;font-weight:400;">&nbsp;/&nbsp;</span>
          <span style="color:${sev.text};">${sev.label}</span>
        </div>
        <div style="font-size:17px;font-weight:700;color:#0F172A;line-height:1.35;margin-top:10px;">${escapeHtml(a.titulo)}</div>
        <div style="font-size:14px;color:#475569;margin-top:7px;line-height:1.6;">${escapeHtml(a.mensaje)}</div>
        ${meta}
        <div style="margin-top:12px;">
          <a href="${a.href}" style="font-size:13px;font-weight:600;color:${est.color};text-decoration:none;border-bottom:1px solid ${est.color};padding-bottom:1px;">${escapeHtml(est.cta)}</a>
        </div>
      </td>
    </tr>`;
}

/**
 * Layout del email: fondo blanco e identidad Don Joaquín. Cuando todas las
 * alertas son de la misma categoría, el encabezado toma el color de esa
 * categoría — así un aviso de préstamos y uno de cheques se distinguen de
 * entrada, sin leer una palabra.
 */
export function renderEmail(opts: {
  baseUrl: string;
  titulo: string;
  intro: string;
  alertas: AlertaEmailView[];
}): string {
  const base = opts.baseUrl;

  const categorias = new Set(opts.alertas.map((a) => a.categoria));
  const unica = categorias.size === 1 ? [...categorias][0]! : null;
  const acento = unica ? (CATEGORIA_ESTILO[unica] ?? null) : null;
  const colorAcento = acento?.color ?? "#0088D1";

  const kicker = acento
    ? `<div style="font-size:10px;font-weight:700;color:${colorAcento};letter-spacing:.14em;text-transform:uppercase;margin-bottom:8px;">${escapeHtml(acento.label)}</div>`
    : "";

  const boton = `<tr><td style="padding:24px 0 0 0;border-top:1px solid #E2E8F0;">
         <a href="${base}/notificaciones" style="display:inline-block;background:${colorAcento};color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;padding:11px 20px;border-radius:4px;">Ver en el sistema</a>
       </td></tr>`;

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(opts.titulo)}</title></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Inter,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" bgcolor="#ffffff" style="background:#ffffff;">
    <tr><td align="center" style="padding:28px 12px 36px 12px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;background:#ffffff;">

        <!-- Membrete -->
        <tr><td style="padding:0 4px 14px 4px;border-bottom:2px solid #0F172A;">
          <img src="${base}/logo-horizontal.png" alt="Don Joaquín" width="180"
               style="display:block;border:0;outline:none;text-decoration:none;height:auto;max-width:180px;">
        </td></tr>

        <!-- Título -->
        <tr><td style="padding:26px 4px 2px 4px;">
          ${kicker}
          <div style="font-size:22px;font-weight:800;color:#0F172A;line-height:1.25;letter-spacing:-.01em;">${escapeHtml(opts.titulo)}</div>
          <div style="font-size:14px;color:#475569;margin-top:7px;line-height:1.6;">${escapeHtml(opts.intro)}</div>
        </td></tr>

        <!-- Alertas -->
        <tr><td style="padding:22px 4px 0 4px;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            ${opts.alertas.map(renderAlerta).join("")}
            ${boton}
          </table>
        </td></tr>

        <!-- Pie -->
        <tr><td style="padding:26px 4px 0 4px;">
          <div style="border-top:1px solid #E2E8F0;padding-top:14px;">
            <div style="font-size:12px;font-weight:700;color:#0088D1;">Don Joaquín Hnos SRL</div>
            <div style="font-size:11px;color:#94A3B8;margin-top:5px;line-height:1.6;">
              Aviso automático del sistema de gestión. Para dejar de recibir estos correos,
              ajustá tus avisos en <span style="color:#64748B;">Configuración → Notificaciones</span>.
            </div>
          </div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>`;
}
