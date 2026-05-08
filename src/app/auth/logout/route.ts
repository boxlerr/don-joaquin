import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getClientIP } from "@/lib/rate-limit";
import { auditLogout } from "@/lib/audit";

/**
 * POST /auth/logout — cierra sesión y redirige a /login.
 *
 * Uso desde un form:
 *   <form action="/auth/logout" method="post">
 *     <button type="submit">Cerrar sesión</button>
 *   </form>
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const ipAddress = getClientIP(request);
  const userAgent = request.headers.get("user-agent") ?? undefined;

  // Obtener usuario antes de desconectar
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.auth.signOut();

  // Registrar logout en auditoría
  if (user) {
    await auditLogout(user.id, ipAddress, userAgent);
  }

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url, { status: 303 });
}
