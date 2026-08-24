import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { appUrl, enviarEmail } from "@/lib/email";
import { renderEmailResumenCaja, type MovimientoResumenView } from "@/lib/email-template";
import { destinatariosDeColumna } from "@/lib/notificaciones";
import { getUsuariosConSeccion } from "@/lib/permisos-usuarios";
import { hoyArgentina, sumarDiasISO } from "@/lib/fecha-ar";
import {
  CAJA_LABEL,
  MEDIO_LABEL,
  etiquetaTipo,
  formatARS,
} from "@/lib/caja-tipos";
import {
  movimientosParaDestinatario,
  resumirDia,
  type MovimientoDia,
} from "@/lib/caja-resumen-dia";

/**
 * El correo de CIERRE DE CAJA: uno solo por día, cuando cierra el sistema, con
 * todo lo que entró y salió.
 *
 * Pedido de Julián (24/08/2026). La primera versión mandaba un mail por cada
 * movimiento y él mismo la frenó el mismo día: *"cada email de cada movimiento
 * llenaría la bandeja y sería súper molesto"*. Tenía razón — la caja se carga a
 * lo largo de todo el día y lo que hace falta no es enterarse movimiento por
 * movimiento, es ver cómo cerró.
 *
 * Tres cosas que importan:
 *
 *  · **A quién le llega no se decide acá.** Usa la columna `cambios_caja` de
 *    /configuracion/notificaciones, que es confidencial y exige `caja_saldo`.
 *    Así se apaga desde la pantalla de siempre y no hay una segunda lista de
 *    correos escondida en el código.
 *
 *  · **Cada uno ve lo suyo.** El detalle se arma por destinatario: lo oculto es
 *    sólo del administrador y la caja general sólo de quien tenga esa
 *    subsección (`movimientosParaDestinatario`). Los TOTALES, en cambio, son los
 *    reales para todos: contra ese número se arquea el cajón.
 *
 *  · **No se manda dos veces.** El día del último envío queda en
 *    `parametros_sistema.caja_resumen_ultimo_envio`; si el cron se dispara de
 *    nuevo, no repite.
 */

/** La columna de la matriz de notificaciones a la que pertenece este aviso. */
const COLUMNA = "cambios_caja";

/** Dónde se anota el último día enviado, para no repetir. */
const CLAVE_ULTIMO_ENVIO = "caja_resumen_ultimo_envio";

const TZ = "America/Argentina/Buenos_Aires";

export type ResultadoResumenCaja =
  | { enviado: true; fecha: string; movimientos: number; destinatarios: number }
  | { enviado: false; motivo: string; fecha: string }
  /** `simular`: se arma todo pero no se manda. Devuelve el correo del primero. */
  | { enviado: false; motivo: "simulado"; fecha: string; html: string; asunto: string };

/** "lunes 24 de agosto de 2026" — el día, en prosa. */
function fechaLarga(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  // Mediodía UTC: así el día no se corre al pasarlo a hora argentina.
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("es-AR", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
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

/** Los movimientos de un día, con el tipo ya resuelto a texto. */
async function movimientosDelDia(
  supabase: ReturnType<typeof createAdminClient>,
  fecha: string,
): Promise<MovimientoDia[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("caja_movimientos")
    .select(
      "tipo, monto, caja, concepto, medio, categoria, categoria_libre, gasto_id, created_by, privado",
    )
    // `fecha` es timestamptz: se toma el día completo, igual que la tarjeta
    // "HOY" de la caja (gte hoy / lt mañana).
    .gte("fecha", fecha)
    .lt("fecha", sumarDiasISO(fecha, 1))
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[aviso-caja] no se pudieron leer los movimientos del día:", error.message);
    return [];
  }

  type Fila = {
    tipo: "ingreso" | "egreso";
    monto: number | null;
    caja: string | null;
    concepto: string | null;
    medio: string;
    categoria: string;
    categoria_libre: string | null;
    gasto_id: string | null;
    created_by: string | null;
    privado: boolean | null;
  };
  const filas = (data ?? []) as Fila[];

  // Quién cargó cada uno: es la columna "Usuario" de la tabla de la caja, y en
  // un cierre del día es de lo primero que se pregunta.
  const usuarioIds = [...new Set(filas.map((f) => f.created_by).filter(Boolean) as string[])];
  const nombrePorUsuario = new Map<string, string>();
  if (usuarioIds.length > 0) {
    const { data: usuarios } = await supabase
      .from("usuarios")
      .select("id, nombre, apellido")
      .in("id", usuarioIds);
    for (const u of usuarios ?? []) {
      const nombre = `${u.nombre ?? ""} ${u.apellido ?? ""}`.trim();
      if (nombre) nombrePorUsuario.set(u.id, nombre);
    }
  }

  // El nombre del tipo de gasto, para que la fila diga "Cubiertas" y no
  // "Pago a proveedor".
  const gastoIds = [...new Set(filas.map((f) => f.gasto_id).filter(Boolean) as string[])];
  const tiposPorGasto = new Map<string, string>();
  if (gastoIds.length > 0) {
    const { data: gastos } = await supabase
      .from("gastos")
      .select("id, tipo_gasto_id")
      .in("id", gastoIds);
    const tipoIds = [
      ...new Set((gastos ?? []).map((g) => g.tipo_gasto_id).filter(Boolean) as string[]),
    ];
    if (tipoIds.length > 0) {
      const { data: tipos } = await supabase
        .from("tipos_gasto")
        .select("id, nombre")
        .in("id", tipoIds);
      const nombre = new Map((tipos ?? []).map((t) => [t.id, t.nombre]));
      for (const g of gastos ?? []) {
        if (g.tipo_gasto_id) tiposPorGasto.set(g.id, nombre.get(g.tipo_gasto_id) ?? "");
      }
    }
  }

  return filas.map((f) => ({
    tipo: f.tipo,
    monto: Number(f.monto || 0),
    caja: f.caja ?? "diaria",
    concepto: f.concepto?.trim() || "(sin concepto)",
    tipoLabel: etiquetaTipo({
      categoria: f.categoria,
      categoria_libre: f.categoria_libre,
      tipo_gasto_nombre: f.gasto_id ? tiposPorGasto.get(f.gasto_id) || null : null,
    }),
    medio: MEDIO_LABEL[f.medio] ?? f.medio,
    usuario: f.created_by ? nombrePorUsuario.get(f.created_by) ?? null : null,
    privado: f.privado,
    created_by: f.created_by,
  }));
}

/**
 * El asunto: lo único que se lee sin abrir el correo. Los dos números del día y
 * la fecha, que es lo que se busca cuando uno va para atrás en la bandeja.
 *
 *   Cierre de caja 24/08 · Entró $ 150.000,00 · Salió $ 10.000,00
 */
export function asuntoResumen(fecha: string, ingresos: number, egresos: number): string {
  const [, m, d] = fecha.split("-");
  return `Cierre de caja ${d}/${m} · Entró $ ${formatARS(ingresos)} · Salió $ ${formatARS(egresos)}`;
}

/**
 * Manda el resumen del día. NUNCA tira: lo peor que puede pasar es un correo de
 * menos.
 *
 * `forzar` saltea la marca de "ya se mandó hoy", para poder probarlo a mano.
 */
export async function enviarResumenCajaDelDia(
  opts: { fecha?: string; forzar?: boolean; simular?: boolean } = {},
): Promise<ResultadoResumenCaja> {
  const fecha = opts.fecha ?? hoyArgentina();
  try {
    const supabase = createAdminClient();

    if (!opts.forzar && !opts.simular) {
      const { data: marca } = await supabase
        .from("parametros_sistema")
        .select("valor")
        .eq("clave", CLAVE_ULTIMO_ENVIO)
        .maybeSingle();
      if (marca?.valor === fecha) {
        return { enviado: false, motivo: "ya_enviado_hoy", fecha };
      }
    }

    const { destinatarios, motivo } = await destinatariosDeColumna(COLUMNA);
    if (destinatarios.length === 0) {
      return { enviado: false, motivo: motivo ?? "sin_destinatarios", fecha };
    }

    const movimientos = await movimientosDelDia(supabase, fecha);
    if (movimientos.length === 0) {
      // Un correo que dice "no pasó nada" todos los días es exactamente el ruido
      // que este cambio vino a sacar.
      if (!opts.simular) await marcarEnviado(supabase, fecha);
      return { enviado: false, motivo: "sin_movimientos", fecha };
    }

    const resumen = resumirDia(movimientos);
    const [saldoDiaria, saldoGrande, conCajaGrande, direccion] = await Promise.all([
      saldoDeCaja(supabase, "diaria"),
      saldoDeCaja(supabase, "grande"),
      getUsuariosConSeccion("caja_grande", "read"),
      getUsuariosConSeccion("caja_saldo", "read"),
    ]);

    const base = appUrl();
    const asunto = asuntoResumen(fecha, resumen.ingresos, resumen.egresos);
    const dia = fechaLarga(fecha);
    let enviados = 0;

    for (const u of destinatarios) {
      const veCajaGrande = conCajaGrande.has(u.id);
      const suyos = movimientosParaDestinatario(movimientos, {
        esAdmin: u.esAdmin,
        veCajaGrande,
        direccion,
      });

      const saldos: { label: string; monto: string }[] = [];
      if (saldoDiaria !== null) {
        saldos.push({ label: CAJA_LABEL.diaria!, monto: formatARS(saldoDiaria) });
      }
      if (veCajaGrande && saldoGrande !== null) {
        saldos.push({ label: CAJA_LABEL.grande!, monto: formatARS(saldoGrande) });
      }

      const vistas: MovimientoResumenView[] = suyos.map((m) => ({
        concepto: m.concepto,
        tipo: m.tipoLabel,
        medio: m.medio,
        usuario: m.usuario,
        monto: formatARS(m.monto),
        esIngreso: m.tipo === "ingreso",
        caja: CAJA_LABEL[m.caja] ?? m.caja,
      }));

      const html = renderEmailResumenCaja({
        baseUrl: base,
        resumen: {
          fechaLarga: dia,
          ingresos: formatARS(resumen.ingresos),
          egresos: formatARS(resumen.egresos),
          neto: formatARS(Math.abs(resumen.neto)),
          netoPositivo: resumen.neto >= 0,
          cantidad: resumen.movimientos,
          saldos,
          movimientos: vistas,
          noListados: movimientos.length - suyos.length,
          mostrarCaja: veCajaGrande,
        },
      });

      // Simulación: se arma el correo del primer destinatario y no se manda
      // nada. Es la forma de mirar cómo queda con los datos reales del día.
      if (opts.simular) return { enviado: false, motivo: "simulado", fecha, html, asunto };

      const res = await enviarEmail({ para: [u.email], asunto, html });
      if (res.ok) enviados++;
      else if (!res.skipped) {
        console.error(`[aviso-caja] no se pudo mandar el cierre a ${u.email}:`, res.error);
      }
    }

    if (enviados === 0) return { enviado: false, motivo: "error_envio", fecha };

    await marcarEnviado(supabase, fecha);
    return {
      enviado: true,
      fecha,
      movimientos: resumen.movimientos,
      destinatarios: enviados,
    };
  } catch (e) {
    console.error("[aviso-caja] falló el cierre de caja:", e);
    return { enviado: false, motivo: "error", fecha };
  }
}

/** Deja anotado el día, para que un segundo disparo no repita el correo. */
async function marcarEnviado(
  supabase: ReturnType<typeof createAdminClient>,
  fecha: string,
): Promise<void> {
  const { error } = await supabase
    .from("parametros_sistema")
    .upsert(
      {
        clave: CLAVE_ULTIMO_ENVIO,
        valor: fecha,
        categoria: "notificaciones",
        descripcion: "Último día del que salió el correo de cierre de caja.",
      },
      { onConflict: "clave" },
    );
  if (error) {
    // No es fatal: en el peor caso el correo sale dos veces si el cron reintenta.
    console.warn("[aviso-caja] no se pudo anotar el último envío:", error.message);
  }
}
