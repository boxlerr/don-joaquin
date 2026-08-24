/**
 * Envía un email de muestra por CADA tipo de alerta, para revisar los diseños.
 *
 *   npx tsx --env-file=.env scripts/enviar-emails-prueba.ts --to boxlerjulian@hotmail.com
 *   npx tsx --env-file=.env scripts/enviar-emails-prueba.ts --to xx@yy.com --dry
 *   npx tsx --env-file=.env scripts/enviar-emails-prueba.ts --to xx@yy.com --solo prestamos_vencimiento
 *
 * Sin --to no manda nada (evita disparos accidentales). Con --dry escribe los
 * HTML en .tmp/emails-prueba/ y no envía.
 *
 * Usa la MISMA plantilla que los envíos reales (`src/lib/email-template.ts`),
 * así lo que se ve acá es exactamente lo que va a llegar. Los datos son
 * inventados pero calcados de los mensajes que genera `src/lib/alertas.ts`.
 */
import { mkdirSync, writeFileSync } from "fs";
import nodemailer from "nodemailer";
import {
  CATEGORIA_ESTILO,
  renderEmail,
  renderEmailResumenCaja,
  type AlertaEmailView,
  type ResumenCajaEmailView,
  type SeveridadEmail,
} from "../src/lib/email-template";

const args = process.argv.slice(2);
const getArg = (n: string) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
};
const to = getArg("--to");
const solo = getArg("--solo");
const dry = args.includes("--dry");
/** Un solo mail con TODOS los tipos mezclados: es el caso del resumen diario. */
const digest = args.includes("--digest");

// En los mails reales esto sale de NEXT_PUBLIC_APP_URL; en local no está, así
// que apuntamos a producción para que el logo y los links funcionen.
const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://donjoaquinsistema.com";

const hoy = new Date();
const enDias = (n: number) => {
  const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + n);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

type Muestra = {
  categoria: string;
  asunto: string;
  titulo: string;
  intro: string;
  alertas: { titulo: string; mensaje: string; severidad: SeveridadEmail; vence: string | null }[];
};

const MUESTRAS: Muestra[] = [
  {
    categoria: "vencimiento_docs",
    asunto: "Vencimiento de documentación",
    titulo: "Documentación por vencer",
    intro: "Hay documentos de choferes y camiones próximos a vencer.",
    alertas: [
      {
        titulo: "VTV por vencer — AF696CR",
        mensaje: "La VTV del camión AF696CR vence en 12 días.",
        severidad: "advertencia",
        vence: enDias(12),
      },
      {
        titulo: "Licencia de conducir vencida — J. Cardarelli",
        mensaje: "La licencia de conducir de Cardarelli venció hace 3 días.",
        severidad: "critica",
        vence: enDias(-3),
      },
    ],
  },
  {
    categoria: "cheques_vencidos",
    asunto: "Cheques por vencer",
    titulo: "Cheques próximos a vencer",
    intro: "Revisá los cheques en cartera antes de la fecha de cobro.",
    alertas: [
      {
        titulo: "Cheque por vencer — $1.850.000",
        mensaje: "El cheque N° 00042198 de Loma Negra vence en 5 días.",
        severidad: "advertencia",
        vence: enDias(5),
      },
    ],
  },
  {
    categoria: "viaticos_sin_rendir",
    asunto: "Viáticos sin rendir",
    titulo: "Viáticos pendientes de rendición",
    intro: "Hay viáticos entregados que todavía no se rindieron.",
    alertas: [
      {
        titulo: "Viático sin rendir — M. Ramos",
        mensaje: "Se entregaron $180.000 el 08/07 y siguen sin rendición (12 días).",
        severidad: "advertencia",
        vence: null,
      },
    ],
  },
  {
    categoria: "gastos_pendientes",
    asunto: "Gastos sin comprobante",
    titulo: "Gastos pendientes de comprobante",
    intro: "Gastos cargados que todavía no tienen comprobante adjunto.",
    alertas: [
      {
        titulo: "Gasto sin comprobante — $92.400",
        mensaje: "Gomería del camión AG556LU cargado el 15/07, sin comprobante.",
        severidad: "info",
        vence: null,
      },
    ],
  },
  {
    categoria: "nuevo_viaje",
    asunto: "Viajes sin cerrar",
    titulo: "Viajes pendientes de cierre",
    intro: "Viajes que llevan demasiado tiempo abiertos.",
    alertas: [
      {
        titulo: "Viaje sin cerrar — IBICUY → L. NEGRA",
        mensaje: "El viaje N° 4821 lleva 52 horas sin cerrarse.",
        severidad: "advertencia",
        vence: null,
      },
    ],
  },
  {
    categoria: "vencimiento_compliance",
    asunto: "Compliance Loma Negra / YPF",
    titulo: "Documentación de compliance por vencer",
    intro: "Documentos a presentar a los clientes principales.",
    alertas: [
      {
        titulo: "Formulario 931 — vence el día 20",
        mensaje: "El F931 debe enviarse a SICOP, Secondi y al portal de YPF.",
        severidad: "critica",
        vence: enDias(2),
      },
    ],
  },
  {
    categoria: "prestamos_vencimiento",
    asunto: "Préstamos por vencer",
    titulo: "Cuotas de préstamo por vencer",
    intro: "Cuotas próximas a vencer o vencidas sin marcarse como pagadas.",
    alertas: [
      {
        titulo: "Préstamo Nación — cuota por vencer (18/18)",
        mensaje: "Mañana vence la cuota 18/18 de Nación: $7.141.857 · tasa 29,3%.",
        severidad: "advertencia",
        vence: enDias(1),
      },
      {
        titulo: "Préstamo Nación — cuota por vencer (3/12)",
        mensaje: "En 7 días vence la cuota 3/12 de Nación: $25.800.942 · tasa 25%.",
        severidad: "info",
        vence: enDias(7),
      },
    ],
  },
  {
    categoria: "otros_avisos",
    asunto: "Otros avisos",
    titulo: "Avisos del sistema",
    intro: "Recordatorios que no tienen una categoría propia.",
    alertas: [
      {
        titulo: "Cumpleaños — Bárbara Joaquín",
        mensaje: "En 5 días es el cumpleaños de Bárbara Joaquín.",
        severidad: "info",
        vence: enDias(5),
      },
      {
        titulo: "Precios de insumos desactualizados",
        mensaje: "Hace 3 meses que no se actualizan los precios del catálogo.",
        severidad: "info",
        vence: null,
      },
    ],
  },
];

function vistasDe(m: Muestra): AlertaEmailView[] {
  return m.alertas.map((a) => ({
    titulo: a.titulo,
    mensaje: a.mensaje,
    severidad: a.severidad,
    fecha_vencimiento: a.vence,
    categoria: m.categoria,
    href: `${BASE}/notificaciones`,
  }));
}

/**
 * El cierre de caja no es una alerta: sale una vez por día, cuando cierra el
 * sistema, y tiene plantilla propia (`renderEmailResumenCaja`). Va acá para
 * poder mirarlo con --dry como el resto.
 */
const MOVIMIENTOS: { nombre: string; asunto: string; resumen: ResumenCajaEmailView }[] = [
  {
    nombre: "cambios_caja-cierre",
    asunto: "Cierre de caja 24/08 · Entró $ 150.000,00 · Salió $ 562.400,00",
    resumen: {
      fechaLarga: "lunes 24 de agosto de 2026",
      ingresos: "150.000,00",
      egresos: "562.400,00",
      neto: "412.400,00",
      netoPositivo: false,
      cantidad: 4,
      saldos: [
        { label: "Caja chica", monto: "652.722,00" },
        { label: "Caja general", monto: "1.260.000,00" },
      ],
      mostrarCaja: true,
      noListados: 0,
      movimientos: [
        {
          concepto: "Cobro flete granos — Factura 0001-00012345",
          tipo: "Cobro a cliente",
          medio: "Transferencia",
          usuario: "Paula",
          monto: "150.000,00",
          esIngreso: true,
          caja: "Caja chica",
        },
        {
          concepto: "Dos cubiertas para el AG556LU",
          tipo: "Cubiertas",
          medio: "Efectivo",
          usuario: "Bárbara",
          monto: "540.000,00",
          esIngreso: false,
          caja: "Caja general",
        },
        {
          concepto: "Peaje Ruta 5 — viaje a Olavarría",
          tipo: "Peaje",
          medio: "Efectivo",
          usuario: "Paula",
          monto: "12.400,00",
          esIngreso: false,
          caja: "Caja chica",
        },
        {
          concepto: "Multa de tránsito AF123XY",
          tipo: "Multas",
          medio: "Efectivo",
          usuario: "Bárbara",
          monto: "10.000,00",
          esIngreso: false,
          caja: "Caja chica",
        },
      ],
    },
  },
];

function construir(m: Muestra): string {
  return renderEmail({ baseUrl: BASE, titulo: m.titulo, intro: m.intro, alertas: vistasDe(m) });
}

/**
 * Resumen diario: un único mail con una alerta de cada tipo, ordenadas por
 * severidad como en el envío real. Sirve para ver si el formato aguanta con
 * todas las categorías mezcladas.
 */
function construirDigest(): string {
  const orden = { critica: 0, advertencia: 1, info: 2 } as const;
  const alertas = MUESTRAS.flatMap(vistasDe).sort(
    (a, b) => orden[a.severidad] - orden[b.severidad],
  );
  return renderEmail({
    baseUrl: BASE,
    titulo: "Resumen diario de alertas",
    intro: `Hay ${alertas.length} alertas pendientes en el sistema.`,
    alertas,
  });
}

async function main() {
  const lista = solo ? MUESTRAS.filter((m) => m.categoria === solo) : MUESTRAS;
  const movimientos =
    solo && solo !== "cambios_caja" ? [] : MOVIMIENTOS;
  if (lista.length === 0 && movimientos.length === 0) {
    console.error(`No hay muestra para "${solo}". Opciones: ${Object.keys(CATEGORIA_ESTILO).join(", ")}`);
    process.exit(1);
  }

  if (dry) {
    const dir = ".tmp/emails-prueba";
    mkdirSync(dir, { recursive: true });
    if (digest) {
      writeFileSync(`${dir}/_resumen-diario.html`, construirDigest());
      console.log(`✓ ${dir}/_resumen-diario.html`);
      return;
    }
    for (const m of lista) {
      writeFileSync(`${dir}/${m.categoria}.html`, construir(m));
      console.log(`✓ ${dir}/${m.categoria}.html`);
    }
    for (const m of movimientos) {
      writeFileSync(
        `${dir}/${m.nombre}.html`,
        renderEmailResumenCaja({ baseUrl: BASE, resumen: m.resumen }),
      );
      console.log(`✓ ${dir}/${m.nombre}.html   ${m.asunto}`);
    }
    console.log(
      `\n${lista.length + movimientos.length} archivo(s). Abrilos en el navegador para verlos.`,
    );
    return;
  }

  if (!to) {
    console.error("Falta --to <email>. (Usá --dry para solo generar los HTML.)");
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

  if (digest) {
    const total = MUESTRAS.reduce((n, m) => n + m.alertas.length, 0);
    await transporter.sendMail({
      from: EMAIL_FROM ?? SMTP_USER,
      to,
      subject: `📋 Resumen diario — ${total} alertas pendientes · Don Joaquín`,
      html: construirDigest(),
    });
    console.log(`  ✓ resumen diario (${total} alertas, todos los tipos) → ${to}`);
    return;
  }

  console.log(`Enviando ${lista.length + movimientos.length} email(s) a ${to}…\n`);
  for (const m of movimientos) {
    try {
      await transporter.sendMail({
        from: EMAIL_FROM ?? SMTP_USER,
        to,
        subject: m.asunto,
        html: renderEmailResumenCaja({ baseUrl: BASE, resumen: m.resumen }),
      });
      console.log(`  ✓ ${m.nombre} — "${m.asunto}"`);
    } catch (e) {
      console.log(`  ✗ ${m.nombre} — ${(e as Error).message}`);
    }
  }
  for (const m of lista) {
    const est = CATEGORIA_ESTILO[m.categoria];
    try {
      await transporter.sendMail({
        from: EMAIL_FROM ?? SMTP_USER,
        to,
        subject: `${est?.icono ?? "🔔"} ${m.asunto} — Don Joaquín`,
        html: construir(m),
      });
      console.log(`  ✓ ${m.categoria} — "${m.asunto}"`);
    } catch (e) {
      console.log(`  ✗ ${m.categoria} — ${(e as Error).message}`);
    }
  }
  console.log("\nListo. Revisá la bandeja (y spam la primera vez).");
}

main();
