/**
 * Envía por email las alertas REALES pendientes de producción.
 *
 *   npx tsx --env-file=.env scripts/enviar-alertas-reales.ts --dry
 *   npx tsx --env-file=.env scripts/enviar-alertas-reales.ts --dry --lunes
 *   npx tsx --env-file=.env scripts/enviar-alertas-reales.ts --dry --como barbara@dominio.com
 *   npx tsx --env-file=.env scripts/enviar-alertas-reales.ts --to alguien@dominio.com
 *
 * Reproduce el resumen diario de `enviarResumenDiario` (src/lib/notificaciones.ts)
 * con los mismos módulos que usa el envío real: la plantilla
 * (`src/lib/email-template.ts`), el ruteo (`src/lib/alertas-routing.ts`) y el
 * recálculo en vivo de documentación y cheques (`src/lib/alertas-live.ts`).
 * Y con los mismos recortes: los toggles de Configuración, los hitos de las
 * efemérides, las efemérides que ya pasaron afuera y —los días que no son
 * lunes— sólo lo que todavía no se notificó.
 *
 * Sin `--lunes` muestra el correo de un día cualquiera; con `--lunes`, el
 * resumen completo de todo lo pendiente. Sin `--como` el HTML trae la UNIÓN de
 * lo que se reparte entre todos, que no es el correo de nadie en particular;
 * con `--como <email>`, exactamente el que recibe esa persona según su matriz.
 *
 * Lo único que NO reproduce, a propósito:
 *  - previsualiza aunque el canal Email esté apagado (lo avisa por consola);
 *  - no marca `notificacion_procesada`. Ojo al leer el resultado: mientras no
 *    corra el envío real, lo de hoy vuelve a aparecer mañana.
 *
 * El recorte de efemérides sale de `lib/alertas-routing.ts`, que vive sin
 * `server-only` justamente para poder compartirse con estos scripts. Tenerlo
 * duplicado acá ya se pagó una vez: la copia quedó con los hitos viejos del
 * período de prueba (sin el día 0) y la vista previa mostraba un correo que no
 * era el que salía.
 */
import { mkdirSync, writeFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { renderEmail, type AlertaEmailView, type SeveridadEmail } from "../src/lib/email-template";
import {
  COLUMNAS_TODAS,
  alertaColumnaDe,
  caducaAlPasar,
  efemerideEnMail,
  esEfemeride,
  normalizarColumnas,
  tipoHabilitado,
} from "../src/lib/alertas-routing";
import { getDocAlertasLive, getChequeAlertasLive } from "../src/lib/alertas-live";
import { categoriaDeAlerta, diasRestantes } from "../src/app/(dashboard)/notificaciones/utils";

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
/** Reproduce el resumen COMPLETO del lunes (todo lo pendiente) en vez del correo
 *  de un día cualquiera, que sólo trae los hitos del día. */
const esLunes = args.includes("--lunes");
/** Email de un usuario real: recorta el resumen a las columnas de SU matriz.
 *  No aplica al modo `--prestamos`, que calcula desde las cuotas y sale aparte. */
const como = getArg("--como")?.trim().toLowerCase();

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
  /** Sólo las filas de la tabla; las "live" se recalculan y no se marcan nunca. */
  notificacion_procesada?: boolean;
};

const ars = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`;

// --- Recortes del envío real (espejo de src/lib/notificaciones.ts) ---

/** Las alertas "live" llevan id sintético: no son filas, no se pueden marcar. */
const esDeTabla = (id: string) => !id.startsWith("docvenc-") && !id.startsWith("chequevenc-");

/** Los parámetros son texto libre: un JSON roto no puede tumbar la vista previa. */
function parseJson<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    const p = JSON.parse(raw);
    return p && typeof p === "object" ? (p as T) : fallback;
  } catch {
    return fallback;
  }
}

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

    const disparos: { sev: SeveridadEmail; msg: string; estado: string }[] = [];
    const cuota = `cuota ${cu.nro}/${pr.cuotas_total}`;
    const tasa = pr.tasa != null ? ` · tasa ${Number(pr.tasa).toLocaleString("es-AR")}%` : "";
    const imp = ars(Number(cu.importe));
    const [vy, vm, vd] = String(cu.fecha_vencimiento).split("-");
    const venceLabel = `${vd}/${vm}/${vy}`;

    // Mismas ventanas que alertas.ts (no igualdad exacta de días).
    if (dias < 0)
      disparos.push({
        sev: "critica",
        estado: "cuota vencida",
        msg: `La ${cuota} de ${pr.banco} (${imp}${tasa}) venció hace ${Math.abs(dias)} día${Math.abs(dias) !== 1 ? "s" : ""} y no figura pagada.`,
      });
    if (dias >= 0 && dias <= 1)
      disparos.push({
        sev: "advertencia",
        estado: "cuota por vencer",
        msg:
          dias === 0
            ? `Hoy vence la ${cuota} de ${pr.banco}: ${imp}${tasa}.`
            : `Mañana vence la ${cuota} de ${pr.banco}: ${imp}${tasa}.`,
      });
    if (dias >= 0 && dias <= 7)
      disparos.push({
        sev: "info",
        estado: "cuota de esta semana",
        msg: `Esta semana vence la ${cuota} de ${pr.banco}: ${imp}${tasa}. Vence el ${venceLabel}${dias > 1 ? ` (en ${dias} días)` : ""}.`,
      });

    for (const disp of disparos) {
      out.push({
        titulo: `Préstamo ${pr.banco} — ${disp.estado} (${cu.nro}/${pr.cuotas_total})`,
        mensaje: disp.msg,
        severidad: disp.sev,
        fecha_vencimiento: cu.fecha_vencimiento,
        categoria: "prestamos_vencimiento",
        href: `${BASE}/prestamos`,
        datos: [
          { label: "Importe", valor: ars(Number(cu.importe)), destacar: true },
          { label: "Banco", valor: String(pr.banco) },
          { label: "Cuota", valor: `${cu.nro} de ${pr.cuotas_total}` },
          ...(pr.tasa != null
            ? [{ label: "Tasa", valor: `${Number(pr.tasa).toLocaleString("es-AR")}%` }]
            : []),
        ],
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

  // El envío real se corta acá mismo si el canal está apagado. La vista previa
  // igual se genera (para eso es), pero avisar evita leer el resultado como si
  // fuera lo que la gente está recibiendo.
  if (paramMap.get("notificaciones_email_activas") !== "true") {
    console.log("OJO: el canal Email está APAGADO en Configuración → hoy el sistema no manda nada.\n");
  }

  // Modo préstamos: lo que le llegaría hoy a quien tenga esa columna.
  if (soloPrestamos) {
    const alertas = await alertasDePrestamos(sb);
    if (alertas.length === 0) {
      console.log("Hoy no dispara ninguna alerta de préstamos (ninguna cuota vencida, ni a 1 ni a 7 días).");
      return;
    }
    const n = alertas.length;
    // El encabezado de un aviso de plata tiene que decir CUÁNTA plata, no sólo
    // cuántas cuotas.
    const totalPlata = alertas.reduce((s, a) => {
      const imp = a.datos?.find((d) => d.label === "Importe")?.valor ?? "";
      return s + Number(imp.replace(/[^\d]/g, ""));
    }, 0);
    const html = renderEmail({
      baseUrl: BASE,
      titulo: n === 1 ? "Cuota de préstamo por vencer" : "Cuotas de préstamo por vencer",
      intro:
        n === 1
          ? `Hay 1 cuota por ${ars(totalPlata)} que requiere atención.`
          : `Hay ${n} cuotas por un total de ${ars(totalPlata)} que requieren atención.`,
      alertas,
    });
    for (const a of alertas) console.log(`  · ${a.severidad.padEnd(11)} ${a.titulo}`);
    await entregar(html, `🏛️ Préstamos por vencer — Don Joaquín`, n);
    return;
  }

  const { data, error } = await sb
    .from("alertas")
    .select(
      "id, tipo, titulo, mensaje, severidad, fecha_vencimiento, entidad_tipo, notificacion_procesada",
    )
    .eq("estado", "pendiente")
    // Documentos y cheques se recalculan abajo desde su fuente real: sus filas de
    // la tabla tienen el texto congelado del día que se crearon. Mismo criterio
    // que `construirResumenFiltrado` en src/lib/notificaciones.ts.
    .not("tipo", "in", "(vencimiento_doc_camion,vencimiento_doc_chofer,vencimiento_cheque)")
    // El orden importa por el tope: si algún día se llega al corte, lo que se
    // pierda tiene que ser lo menos urgente. Mismo orden que el envío real.
    .order("severidad", { ascending: false })
    .order("fecha_disparo", { ascending: false })
    .limit(limite);

  if (error) {
    console.error("Error leyendo alertas:", error.message);
    process.exit(1);
  }

  // Documentos y cheques EN VIVO, con el MISMO código que usa el envío real
  // (`src/lib/alertas-live.ts`). Duplicarlo acá sería previsualizar un correo
  // distinto del que sale. `--lunes` reproduce el resumen completo del lunes;
  // por defecto, el correo de un día cualquiera (sólo hitos).
  const live = [
    ...(await getDocAlertasLive(sb, { soloHitos: !esLunes })),
    ...(await getChequeAlertasLive(sb, { soloHitos: !esLunes })),
  ];

  const filas = [...((data ?? []) as Fila[]), ...(live as unknown as Fila[])];

  // Los mismos recortes, en el mismo orden, que `construirResumenFiltrado`.
  // Sin el de efemérides la vista previa mostraba de más: cumpleaños a 3 días
  // (que por mail no salen) y aniversarios que ya habían pasado (que no vuelven
  // a salir nunca).
  const modoEfemerides = esLunes ? "semana" : "hitos";
  const habilitadas = filas
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((f) => tipoHabilitado(f as any, paramMap))
    .filter((f) => !caducaAlPasar(f) || (diasRestantes(f.fecha_vencimiento) ?? 0) >= 0)
    .filter(
      (f) =>
        !esEfemeride(f) ||
        efemerideEnMail(f, diasRestantes(f.fecha_vencimiento), modoEfemerides),
    );

  // Los días que no son lunes el correo trae sólo lo NUEVO de la tabla. Las
  // "live" y las efemérides quedan exentas: ya vienen recortadas por hito, y
  // exigirles además `notificacion_procesada` las dejaría en un único aviso.
  const delDia = esLunes
    ? habilitadas
    : habilitadas.filter((f) =>
        esDeTabla(f.id) && !esEfemeride(f) ? f.notificacion_procesada === false : true,
      );

  delDia.sort((a, b) => {
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

  // Reparto: cada usuario activo recibe SÓLO las columnas que tiene tildadas en
  // la matriz (fallback retrocompatible: quien esté en la lista vieja de
  // destinatarios recibe todo). Sin `--como` el HTML es la unión de todos, que
  // sirve para revisar de una pero no es el correo de nadie: de ahí el desglose.
  const matriz = parseJson<Record<string, string[]>>(
    paramMap.get("notificaciones_matriz_por_usuario"),
    {},
  );
  const oldDest = new Set(parseJson<string[]>(paramMap.get("notificaciones_destinatarios_ids"), []));
  const { data: usuarios } = await sb
    .from("usuarios")
    .select("id, email")
    .eq("estado", "activo");
  const destinatarios = (usuarios ?? [])
    .filter((u: { email: string | null }) => Boolean(u.email))
    .map((u: { id: string; email: string }) => ({
      email: u.email,
      columnas: new Set(
        normalizarColumnas(matriz[u.id] ?? (oldDest.has(u.id) ? COLUMNAS_TODAS : [])),
      ),
    }))
    .filter((d: { columnas: Set<string> }) => d.columnas.size > 0);

  const objetivo = como
    ? destinatarios.find((d: { email: string }) => d.email.toLowerCase() === como)
    : undefined;
  if (como && !objetivo) {
    const quienes = destinatarios.map((d: { email: string }) => d.email).join(", ") || "nadie";
    console.error(`--como ${como}: no es un usuario activo con columnas asignadas. Hoy reciben: ${quienes}`);
    process.exit(1);
  }

  const paraCorreo = objetivo
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? delDia.filter((f) => objetivo.columnas.has(alertaColumnaDe(f as any)))
    : delDia;

  if (paraCorreo.length === 0) {
    console.log(
      objetivo
        ? `${objetivo.email} no recibe ningún aviso hoy. No se envía nada.`
        : "No hay alertas para el correo de hoy. No se envía nada.",
    );
    return;
  }

  const alertas: AlertaEmailView[] = paraCorreo.map((f) => ({
    titulo: f.titulo,
    mensaje: f.mensaje,
    severidad: f.severidad as SeveridadEmail,
    fecha_vencimiento: f.fecha_vencimiento,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    categoria: alertaColumnaDe(f as any),
    // Los links del correo real llevan el filtro ya aplicado: se abre
    // /notificaciones mostrando ese grupo, no la lista entera.
    href: `${BASE}/notificaciones?categoria=${categoriaDeAlerta(f.tipo, f.entidad_tipo)}&severidad=${f.severidad}`,
  }));

  const n = alertas.length;
  const html = renderEmail({
    baseUrl: BASE,
    titulo: "Resumen diario de alertas",
    intro: `Hay ${n} alerta${n !== 1 ? "s" : ""} pendiente${n !== 1 ? "s" : ""} para vos.`,
    alertas,
  });

  // Qué queda de cada recorte, para poder leer por qué el correo trae lo que trae.
  console.log(
    `Candidatas: ${filas.length} · pasan los toggles y los hitos: ${habilitadas.length} · ` +
      `${esLunes ? "resumen del lunes" : "sin lo ya notificado"}: ${delDia.length}` +
      (objetivo ? ` · para ${objetivo.email}: ${n}` : ""),
  );

  const porCat = new Map<string, number>();
  for (const a of alertas) porCat.set(a.categoria, (porCat.get(a.categoria) ?? 0) + 1);
  for (const [c, q] of [...porCat.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(q).padStart(3)}  ${c}`);
  }

  // Quién recibe cuánto: el correo real sale repartido, no como un único envío.
  if (!objetivo) {
    console.log("\nEn el envío real esto sale repartido:");
    for (const d of destinatarios as { email: string; columnas: Set<string> }[]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const q = delDia.filter((f) => d.columnas.has(alertaColumnaDe(f as any))).length;
      console.log(`  ${String(q).padStart(3)}  ${d.email}${q === 0 ? " (no recibe correo)" : ""}`);
    }
  }

  await entregar(html, `📋 Resumen diario — ${n} alerta${n !== 1 ? "s" : ""} pendiente${n !== 1 ? "s" : ""}`, n);
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
