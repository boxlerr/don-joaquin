import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            // "Recordarme" destildado (cookie dj_remember="0"): las cookies de
            // sesión de Supabase (sb-*) se guardan como cookies de sesión (sin
            // maxAge/expires) → se borran al cerrar el navegador.
            const soloSesion = cookieStore.get("dj_remember")?.value === "0";
            cookiesToSet.forEach(({ name, value, options }) => {
              const opts =
                soloSesion && name.startsWith("sb-")
                  ? { ...options, maxAge: undefined, expires: undefined }
                  : options;
              cookieStore.set(name, value, opts);
            });
          } catch {
            // Server Component context — middleware will refresh the session.
          }
        },
      },
    },
  );
}
