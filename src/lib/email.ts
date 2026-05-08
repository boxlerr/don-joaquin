import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendLoginAlertEmail(
  to: string,
  ip: string,
  timestamp: Date,
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY no configurado. Email de alerta omitido.");
    return;
  }

  const hora = timestamp.toLocaleString("es-AR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  });

  const from = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

  const { error } = await resend.emails.send({
    from,
    to,
    subject: "Alerta de seguridad: intentos de inicio de sesión",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #d97706; margin-bottom: 16px;">⚠️ Alerta de seguridad</h2>
        <p>Detectamos múltiples intentos fallidos de inicio de sesión en tu cuenta.</p>
        <table style="border-collapse: collapse; margin: 16px 0; width: 100%;">
          <tr>
            <td style="padding: 8px; font-weight: bold; width: 40%;">Dirección IP:</td>
            <td style="padding: 8px;">${ip}</td>
          </tr>
          <tr style="background: #f9fafb;">
            <td style="padding: 8px; font-weight: bold;">Fecha y hora:</td>
            <td style="padding: 8px;">${hora}</td>
          </tr>
        </table>
        <p>
          Si <strong>no fuiste vos</strong>, te recomendamos cambiar tu contraseña de inmediato
          y contactar al administrador del sistema.
        </p>
        <p>Si fuiste vos quien realizó estos intentos, podés ignorar este mensaje.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #6b7280; font-size: 12px;">Sistema Don Joaquín — Gestión Logística</p>
      </div>
    `,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}
