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
/**
 * Calcula y muestra las alertas de PRÉSTAMOS a partir de las cuotas reales, en
 * vez de leerlas de la tabla `alertas`. Sirve para ver qué le va a llegar a
 * quien tenga esa columna (ej. Paula) sin esperar a que corra el generador.
 */
const soloPrestamos = args.includes("--prestamos");

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

const ars = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`;

/**
 * Reproduce EXACTAMENTE los disparos de cuotas de préstamo de
 * `src/lib/alertas.ts`: vencida (crítica), mañana (advertencia) y a 7 días
 * (info). Son umbrales discretos: si el generador no corre justo ese día, el
 * aviso no se emite.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function alertasDePrestamos(sb: any): Promise<AlertaEmailView[]> {
  const { data } = await sb
    .from("prestamo_cuotas")
    .select("id, nro, fecha_vencimiento, importe, prestamo:prestamos!inner(banco, tasa, cuotas_total, estado)")
    .eq("pagada", false)
    .eq("prestamo.estado", "activo");

  const hoy = new Date();
  const hoyMid = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const out: AlertaEmailView[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const cu of (data ?? []) as any[]) {
    const pr = Array.isArray(cu.prestamo) ? cu.prestamo[0] : cu.prestamo;
    if (!pr) continue;
    const [y, m, d] = String(cu.fecha_vencimiento).split("-").map(Number);
    const vence = new Date(y!, m! - 1, d!);
    const dias = Math.round((vence.getTime() - hoyMid.getTime()) / 86400000);

    const disparos: { sev: SeveridadEmail; msg: string; vencida: boolean }[] = [];
    const cuota = `cuota ${cu.nro}/${pr.cuotas_total}`;
    const tasa = pr.tasa != null ? ` · tasa ${Number(pr.tasa).toLocaleString("es-AR")}%` : "";
    const imp = ars(Number(cu.importe));

    if (dias < 0)
      disparos.push({
        sev: "critica",
        vencida: true,
        msg: `La ${cuota} de ${pr.banco} (${imp}${tasa}) venció hace ${Math.abs(dias)} día${Math.abs(dias) !== 1 ? "s" : ""} y no figura pagada.`,
      });
    if (dias === 1)
      disparos.push({ sev: "advertencia", vencida: false, msg: `Mañana vence la ${cuota} de ${pr.banco}: ${imp}${tasa}.` });
    if (dias === 7)
      disparos.push({ sev: "info", vencida: false, msg: `En 7 días vence la ${cuota} de ${pr.banco}: ${imp}${tasa}.` });

    for (const disp of disparos) {
      out.push({
        titulo: `Préstamo ${pr.banco} — ${disp.vencida ? "cuota vencida" : "cuota por vencer"} (${cu.nro}/${pr.cuotas_total})`,
        mensaje: disp.msg,
        severidad: disp.sev,
        fecha_vencimiento: cu.fecha_vencimiento,
        categoria: "prestamos_vencimiento",
        href: `${BASE}/prestamos`,
      });
    }
  }
  return out;
}

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

  // Modo préstamos: lo que le llegaría hoy a quien tenga esa columna.
  if (soloPrestamos) {
    const alertas = await alertasDePrestamos(sb);
    if (alertas.length === 0) {
      console.log("Hoy no dispara ninguna alerta de préstamos (ninguna cuota vencida, ni a 1 ni a 7 días).");
      return;
    }
    const n = alertas.length;
    const html = renderEmail({
      baseUrl: BASE,
      titulo: n === 1 ? "Cuota de préstamo por vencer" : "Cuotas de préstamo por vencer",
      intro: `Hay ${n} cuota${n !== 1 ? "s" : ""} que requiere${n !== 1 ? "n" : ""} atención.`,
      alertas,
    });
    for (const a of alertas) console.log(`  · ${a.severidad.padEnd(11)} ${a.titulo}`);
    await entregar(html, `🏛️ Préstamos por vencer — Don Joaquín`, n);
    return;
  }

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

  await entregar(html, `📋 Resumen de alertas — ${n} pendiente${n !== 1 ? "s" : ""} · Don Joaquín`, n);
}

/** Escribe el HTML (--dry) o lo envía por SMTP (--to). */
async function entregar(html: string, asunto: string, n: number) {
  if (dry) {
    mkdirSync(".tmp/emails-prueba", { recursive: true });
    const out = `.tmp/emails-prueba/${soloPrestamos ? "_prestamos-reales" : "_alertas-reales"}.html`;
    writeFileSync(out, html);
    console.log(`\n✓ ${out} (${n} alertas, no se envió nada)`);
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

  await transporter.sendMail({ from: EMAIL_FROM ?? SMTP_USER, to, subject: asunto, html });
  console.log(`\n✓ Enviado a ${to}`);
}

main();
