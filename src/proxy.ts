import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // robots.txt queda fuera de la sesión: si lo mandamos al login, el crawler
  // no puede leerlo y no se entera de que el sitio es privado.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots\\.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
