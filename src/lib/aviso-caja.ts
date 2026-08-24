import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { appUrl, enviarEmail } from "@/lib/email";
import { renderEmailMovimiento } from "@/lib/email-template";
import { destinatariosDeColumna } from "@/lib/notificaciones";
import {
  CAJA_LABEL,
  MEDIO_LABEL,
  etiquetaTipo,
  formatARS,
  type MovimientoTipoInput,
} from "@/lib/caja-tipos";

/**
 * El aviso por correo de CADA movimiento de caja.
 *
 * Pedido de Julián (24/08/2026): "que cada movimiento que haya en la caja le
 * llegue por email a los administradores, ingresos y egresos, con un asunto
 * simple que cambie según el tipo de movimiento y el monto, para tener más
 * control en tiempo real de la caja".
 *
 * Dos decisiones que importan:
 *
 *  · A quién le llega NO se decide acá. Se usa la columna `cambios_caja` de la
 *    matriz de /configuracion/notificaciones, que existía desde el principio
 *    esperando justamente esto ("sin generador hoy, pero la columna es tildable:
 *    si mañana alguien emite un aviso de caja, nace tapado en vez de nacer
 *    abierto" — lib/alertas-routing.ts). Es confidencial y pide `caja_saldo`, o
 *    sea que sólo le puede llegar a quien ya puede ver el saldo. Así se apaga
 *    desde la pantalla de siempre y no hay una segunda lista de correos
 *    escondida en el código.
 *
 *  · No se manda ANTES de contestarle a quien cargó. El correo sale con
 *    `after()` (ver actions.ts), cuando el movimiento ya está guardado y el
 *    diálogo ya se cerró: la caja se carga a mano, de a un movimiento, y no
 *    puede quedarse esperando a un SMTP. Si el correo falla, se loguea; el
 *    movimiento ya entró, que es lo que importa.
 */

/** La columna de la matriz de notificaciones a la que pertenece este aviso. */
const COLUMNA = "cambios_caja";

export type MovimientoAvisado = MovimientoTipoInput & {
  tipo: "ingreso" | "egreso";
  concepto: string;
  monto: number;
  medio: string;
  /** ISO (`2026-08-24` o timestamp): se muestra dd/mm/aaaa. */
  fecha: string;
  caja: "diaria" | "grande";
  /** true = no se ve en la caja chica. */
  privado?: boolean | null;
  /** Quién lo cargó, con nombre y apellido. */
  usuario?: string | null;
};

function formatFecha(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

/**
 * El asunto: lo único que se lee sin abrir el correo.
 *
 * Tiene que decir las tres cosas por las que se abre la casilla — si entró o
 * salió, de qué es y cuánto — y nada más. Las flechas son las mismas que las de
 * las tarjetas de la caja, así el correo y la pantalla se leen igual.
 *
 *   ↗ Ingreso · Cobro a cliente · $ 150.000,00
 *   ↘ Egreso · Multas · $ 10.000,00 (Caja general)
 */
export function asuntoMovimiento(m: MovimientoAvisado): string {
  const entra = m.tipo === "ingreso";
  const partes = [
    `${entra ? "↗" : "↘"} ${entra ? "Ingreso" : "Egreso"}`,
    etiquetaTipo(m),
    `$ ${formatARS(m.monto)}`,
  ];
  // La caja chica es la de todos los días: sólo se aclara cuando NO es esa.
  const sufijo = m.caja === "grande" ? ` (${CAJA_LABEL.grande})` : "";
  return `${partes.join(" · ")}${sufijo}`;
}

/**
 * Saldo de una caja: todo lo que entró menos todo lo que salió.
 *
 * Paginado porque el API REST corta en 1000 filas sin avisar, y un saldo cortado
 * en la fila 1000 es peor que no mostrar ninguno.
 */
async function saldoDeCaja(
  supabase: ReturnType<typeof createAdminClient>,
  caja: string,
): Promise<number | null> {
  let saldo = 0;
  for (let from = 0; ; from += 1000) {
    // `caja` es una columna nueva y no está en los tipos generados (ver actions.ts).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("caja_movimientos")
      .select("tipo, monto")
      .eq("caja", caja)
      .range(from, from + 999);
    if (error) {
      console.warn("[aviso-caja] no se pudo calcular el saldo:", error.message);
      return null;
    }
    const batch = (data ?? []) as { tipo: string; monto: number | null }[];
    for (const m of batch) {
      saldo += m.tipo === "ingreso" ? Number(m.monto || 0) : -Number(m.monto || 0);
    }
    if (batch.length < 1000) break;
  }
  return saldo;
}

/**
 * Manda el aviso. NUNCA tira: lo peor que puede pasar es un correo de menos.
 *
 * Un correo por destinatario (y no todos en el mismo "Para"): son casillas
 * personales y no tienen por qué verse entre ellas.
 */
export async function avisarMovimientoCaja(m: MovimientoAvisado): Promise<void> {
  try {
    const { emails, motivo } = await destinatariosDeColumna(COLUMNA);
    if (emails.length === 0) {
      console.warn(`[aviso-caja] sin envío (${motivo ?? "sin_destinatarios"})`);
      return;
    }

    const supabase = createAdminClient();
    const saldo = await saldoDeCaja(supabase, m.caja);

    const html = renderEmailMovimiento({
      baseUrl: appUrl(),
      movimiento: {
        tipo: m.tipo,
        concepto: m.concepto?.trim() || etiquetaTipo(m),
        monto: formatARS(m.monto),
        categoria: etiquetaTipo(m),
        medio: MEDIO_LABEL[m.medio] ?? m.medio,
        fecha: formatFecha(m.fecha),
        caja: CAJA_LABEL[m.caja] ?? m.caja,
        usuario: m.usuario ?? null,
        saldo: saldo === null ? null : formatARS(saldo),
        privado: m.privado === true,
      },
    });

    const asunto = asuntoMovimiento(m);
    for (const email of emails) {
      const res = await enviarEmail({ para: [email], asunto, html });
      if (!res.ok && !res.skipped) {
        console.error(`[aviso-caja] no se pudo avisar a ${email}:`, res.error);
      }
    }
  } catch (e) {
    console.error("[aviso-caja] falló el aviso del movimiento:", e);
  }
}
