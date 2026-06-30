import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getResumenUsuario } from "@/lib/alertas-lecturas";

export const dynamic = "force-dynamic";

/**
 * GET /api/alertas — alertas NO leídas del usuario actual (per-user).
 *
 * El usuario se deriva de la cookie de sesión (createClient → auth.getUser);
 * nunca se acepta un id del cliente. Los datos se leen vía el helper, que usa el
 * service role internamente. Dos modos sobre el mismo handler:
 *
 *   - default (campana):  ResumenItem[] (<= 8)         → dropdown de la campana
 *   - ?mode=resumen:      { count, items: ResumenItem[] } → provider/polling
 *
 * Ambos comparten la MISMA definición de "no leída" que el badge del layout, así
 * el contador es coherente y llega a 0 al marcar todo.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "no_auth" }, { status: 401 });
  }

  const { count, items } = await getResumenUsuario(user.id, 8);

  const mode = request.nextUrl.searchParams.get("mode");
  if (mode === "resumen") {
    return NextResponse.json({ count, items });
  }

  return NextResponse.json(items);
}
