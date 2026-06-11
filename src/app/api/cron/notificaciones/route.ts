import { NextResponse } from "next/server";
import { generarAlertas } from "@/lib/alertas";
import { enviarResumenDiario } from "@/lib/notificaciones";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cron de notificaciones (lo dispara Vercel Cron 1×/día — ver vercel.json).
 *
 * 1. Genera alertas nuevas (esto ya envía por email las CRÍTICAS al instante).
 * 2. Manda el resumen diario con todas las alertas pendientes.
 *
 * Seguridad: requiere el `CRON_SECRET` en el header `x-cron-secret` o en
 * `Authorization: Bearer <CRON_SECRET>`. Vercel Cron agrega el Bearer solo si
 * la variable CRON_SECRET está definida; el `x-cron-secret` facilita dispararlo
 * desde un cron externo gratuito (cron-job.org, etc.) o a mano con curl.
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

  try {
    const generadas = await generarAlertas();
    const resumen = await enviarResumenDiario();
    return NextResponse.json({
      ok: true,
      alertas_generadas: generadas,
      resumen,
    });
  } catch (e) {
    console.error("[cron/notificaciones] error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error en el cron de notificaciones" },
      { status: 500 },
    );
  }
}
