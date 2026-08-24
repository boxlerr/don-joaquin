import { NextResponse } from "next/server";
import { enviarResumenCajaDelDia } from "@/lib/aviso-caja";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cierre de caja del día (lo dispara Vercel Cron 1×/día — ver vercel.json).
 *
 * Manda UN correo con todo lo que entró y salió, cuando cierra el sistema.
 * Pedido de Julián el 24/08/2026, el mismo día que frenó la versión anterior —
 * un mail por cada movimiento— porque llenaba la bandeja.
 *
 * **El horario tiene que seguir al del sistema.** Está agendado a las 21:00 UTC
 * = 18:00 en Argentina, que es el `acceso_hora_hasta` configurado hoy en
 * Configuración → Seguridad (la hora a la que el sistema se cierra para los que
 * no son admin). Si esa hora se cambia, hay que cambiar también el `schedule` de
 * vercel.json: el cron de Vercel es fijo y no lee la base. Argentina no tiene
 * horario de verano, así que la conversión es siempre −3.
 *
 * Es idempotente: si se dispara dos veces el mismo día, el segundo no manda nada
 * (queda anotado en `parametros_sistema.caja_resumen_ultimo_envio`). Con
 * `?forzar=1` se saltea esa marca, para poder probarlo a mano:
 *
 *     curl -H "x-cron-secret: $CRON_SECRET" "https://…/api/cron/caja-cierre?forzar=1"
 *
 * Seguridad: mismo esquema que /api/cron/notificaciones — el `CRON_SECRET` en el
 * header `x-cron-secret` o en `Authorization: Bearer <CRON_SECRET>`.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET no configurado" }, { status: 500 });
  }

  const provided =
    request.headers.get("x-cron-secret") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    "";
  if (provided !== secret) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const url = new URL(request.url);
  const forzar = url.searchParams.get("forzar") === "1";
  // `?simular=1` arma el correo y NO lo manda: sirve para ver cómo queda.
  const simular = url.searchParams.get("simular") === "1";
  // Para reenviar el cierre de un día puntual: ?fecha=2026-08-24.
  const fecha = url.searchParams.get("fecha") ?? undefined;

  try {
    const resultado = await enviarResumenCajaDelDia({ fecha, forzar, simular });
    return NextResponse.json({ ok: true, resultado });
  } catch (e) {
    console.error("[cron/caja-cierre] error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error en el cierre de caja" },
      { status: 500 },
    );
  }
}
