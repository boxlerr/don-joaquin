import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // robots.txt queda fuera de la sesión: si lo mandamos al login, el crawler
  // no puede leerlo y no se entera de que el sitio es privado.
  //
  // /api/cron/* también queda fuera, y es CRÍTICO: quien lo llama es Vercel Cron,
  // que no tiene cookie de sesión. Al pasar por acá se comía un 307 al login y el
  // job nunca se ejecutaba — ninguna alerta se generaba ni salía por mail, sin
  // ningún error visible. Esas rutas no quedan abiertas: validan `CRON_SECRET`
  // por su cuenta (ver app/api/cron/notificaciones/route.ts).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots\\.txt|api/cron/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
