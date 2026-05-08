import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
  await supabase.auth.signOut();

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url, { status: 303 });
}
