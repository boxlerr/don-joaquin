/**
 * Envía por email las alertas REALES pendientes de producción.
 *
 *   npx tsx --env-file=.env scripts/enviar-alertas-reales.ts --dry
 *   npx tsx --env-file=.env scripts/enviar-alertas-reales.ts --to alguien@dominio.com
 *
 * Usa la misma plantilla (`src/lib/email-template.ts`) y el mismo ruteo
 * (`src/lib/alertas-routing.ts`) que el envío real, así lo que llega es
 * idéntico a lo que manda el sistema. Respeta los toggles de
 * Configuración → Notificaciones.
 *
 * Diferencia con el resumen de producción: éste lee las alertas tal como están
 * guardadas en la tabla. El resumen real, además, recalcula en vivo las de
 * documentación y cheques para reflejar el estado del momento.
 *
 * NO toca nada: no marca alertas como procesadas ni escribe en la base.
 */
import { mkdirSync, writeFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { renderEmail, type AlertaEmailView, type SeveridadEmail } from "../src/lib/email-template";
import { alertaColumnaDe, tipoHabilitado } from "../src/lib/alertas-routing";

const args = process.argv.slice(2);
const getArg = (n: string) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
};
const to = getArg("--to");
const dry = args.includes("--dry");
const limite = Number(getArg("--limite") ?? 200);

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://donjoaquinsistema.com";

const SEV_ORDEN: Record<string, number> = { critica: 0, advertencia: 1, info: 2 };
const EVENTO_PRIORITY: Record<string, number> = {
  personal_cumple: 0, choferes_cumple: 0,
  personal_aniversario: 1, choferes_aniversario: 1,
  choferes_periodo_prueba: 2,
};

type Fila = {
  id: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  severidad: string;
  fecha_vencimiento: string | null;
  entidad_tipo: string | null;
};

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }
  const sb = createClient(url, key);

  const { data: params } = await sb
    .from("parametros_sistema")
    .select("clave, valor")
    .eq("categoria", "notificaciones");
  const paramMap = new Map((params ?? []).map((p) => [p.clave, p.valor ?? ""]));

  const { data, error } = await sb
    .from("alertas")
    .select("id, tipo, titulo, mensaje, severidad, fecha_vencimiento, entidad_tipo")
    .eq("estado", "pendiente")
    .order("fecha_disparo", { ascending: false })
    .limit(limite);

  if (error) {
    console.error("Error leyendo alertas:", error.message);
    process.exit(1);
  }

  const filas = (data ?? []) as Fila[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const habilitadas = filas.filter((f) => tipoHabilitado(f as any, paramMap));

  habilitadas.sort((a, b) => {
    const s = (SEV_ORDEN[a.severidad] ?? 9) - (SEV_ORDEN[b.severidad] ?? 9);
    if (s !== 0) return s;
    const p =
      (EVENTO_PRIORITY[a.entidad_tipo ?? ""] ?? 99) - (EVENTO_PRIORITY[b.entidad_tipo ?? ""] ?? 99);
    if (p !== 0) return p;
    const fa = a.fecha_vencimiento;
    const fb = b.fecha_vencimiento;
    if (fa && fb) return fa < fb ? -1 : fa > fb ? 1 : 0;
    if (fa) return -1;
    if (fb) return 1;
    return 0;
  });

  if (habilitadas.length === 0) {
    console.log("No hay alertas pendientes habilitadas. No se envía nada.");
    return;
  }

  const alertas: AlertaEmailView[] = habilitadas.map((f) => ({
    titulo: f.titulo,
    mensaje: f.mensaje,
    severidad: f.severidad as SeveridadEmail,
    fecha_vencimiento: f.fecha_vencimiento,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    categoria: alertaColumnaDe(f as any),
    href: `${BASE}/notificaciones`,
  }));

  const n = alertas.length;
  const html = renderEmail({
    baseUrl: BASE,
    titulo: "Resumen de alertas",
    intro: `Hay ${n} alerta${n !== 1 ? "s" : ""} pendiente${n !== 1 ? "s" : ""} en el sistema.`,
    alertas,
  });

  // Desglose por categoría, para saber qué se está mandando.
  const porCat = new Map<string, number>();
  for (const a of alertas) porCat.set(a.categoria, (porCat.get(a.categoria) ?? 0) + 1);
  console.log(`Alertas pendientes: ${filas.length} · habilitadas: ${n}`);
  for (const [c, q] of [...porCat.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(q).padStart(3)}  ${c}`);
  }

  if (dry) {
    mkdirSync(".tmp/emails-prueba", { recursive: true });
    const out = ".tmp/emails-prueba/_alertas-reales.html";
    writeFileSync(out, html);
    console.log(`\n✓ ${out} (no se envió nada)`);
    return;
  }

  if (!to) {
    console.error("\nFalta --to <email>. (Usá --dry para solo generar el HTML.)");
    process.exit(1);
  }

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    console.error("Faltan credenciales SMTP en el env.");
    process.exit(1);
  }
  const port = parseInt(SMTP_PORT, 10);
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE !== undefined ? process.env.SMTP_SECURE === "true" : port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  await transporter.sendMail({
    from: EMAIL_FROM ?? SMTP_USER,
    to,
    subject: `📋 Resumen de alertas — ${n} pendiente${n !== 1 ? "s" : ""} · Don Joaquín`,
    html,
  });
  console.log(`\n✓ Enviado a ${to}`);
}

main();
