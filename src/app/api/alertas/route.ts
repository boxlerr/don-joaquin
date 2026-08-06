import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getResumenUsuario } from "@/lib/alertas-lecturas";
import { getResumenDiario } from "@/lib/resumen-diario";

export const dynamic = "force-dynamic";

/**
 * GET /api/alertas — alertas NO leídas del usuario actual (per-user).
 *
 * El usuario se deriva de la cookie de sesión (createClient → auth.getUser);
 * nunca se acepta un id del cliente. Los datos se leen vía el helper, que usa el
 * service role internamente. Tres modos sobre el mismo handler:
 *
 *   - default (campana):  ResumenItem[] (<= 8)         → dropdown de la campana
 *   - ?mode=resumen:      { count, items: ResumenItem[] } → provider/polling
 *   - ?mode=diario:       ResumenDiario                 → pop-up de apertura del día
 *
 * Los dos primeros comparten la MISMA definición de "no leída" que el badge del
 * layout, así el contador es coherente y llega a 0 al marcar todo. El diario es
 * otra cosa: ignora leído/no leído y muestra el ESTADO del día agrupado, que es
 * el punto del pop-up (recordar todos los días lo que sigue pendiente).
 */
export async function GET(request: NextRequest) {
  // getCurrentUser deriva el usuario de la cookie y trae sus permisos por
  // sección: hacen falta para no mandarle alertas confidenciales a quien no
  // puede verlas (las de préstamos llevan montos en el mensaje).
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "no_auth" }, { status: 401 });
  }

  const mode = request.nextUrl.searchParams.get("mode");

  // Antes del resumen de la campana: el diario arma su propio conjunto (incluye
  // las live y no mira lecturas), así que traer el otro sería trabajo tirado.
  if (mode === "diario") {
    return NextResponse.json(await getResumenDiario(user));
  }

  const { count, items, allIds } = await getResumenUsuario(user, 8);

  if (mode === "resumen") {
    return NextResponse.json({ count, items, allIds });
  }

  return NextResponse.json(items);
}
