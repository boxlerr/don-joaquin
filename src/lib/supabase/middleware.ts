import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Rutas públicas que NO requieren autenticación.
 * Cualquier otra ruta queda protegida y redirige a /login si no hay sesión.
 *
 * `/gasoil` es la que anota el chofer su propia vuelta. No tiene usuario en el
 * sistema —hacerle uno a cada uno de los 61 era justamente lo que había que
 * evitar—, así que la llave es el token de la URL: la valida la propia página
 * contra `gasoil_enlace` y la oficina lo puede apagar cuando quiera. Mismo
 * criterio que /api/cron/*: no pide sesión, pero no queda abierta.
 */
const PUBLIC_PATHS = ["/login", "/forgot-password", "/auth/callback", "/auth/reset-password", "/auth/error", "/gasoil"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // "Recordarme" destildado (dj_remember="0"): las cookies sb-* se
          // re-escriben como cookies de sesión (mueren al cerrar el navegador).
          const soloSesion = request.cookies.get("dj_remember")?.value === "0";
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            const opts =
              soloSesion && name.startsWith("sb-")
                ? { ...options, maxAge: undefined, expires: undefined }
                : options;
            response.cookies.set(name, value, opts);
          });
        },
      },
    },
  );

  // IMPORTANTE: getUser() valida el JWT contra el server de Supabase.
  // No usar getSession() acá: lee de cookies sin validar y es un security anti-pattern.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  // Sin sesión y ruta protegida → /login con redirect_to
  if (!user && !isPublic(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirect_to", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  // Con sesión activa intentando ir a /login → /dashboard
  if (user && pathname === "/login") {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    dashboardUrl.search = "";
    return NextResponse.redirect(dashboardUrl);
  }

  return response;
}
