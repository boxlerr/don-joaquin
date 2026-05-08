import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Cliente Supabase con service_role.
 *
 * NUNCA importar desde un Client Component.
 * Bypassea RLS — usar solo para lecturas administrativas en Server Components
 * o Route Handlers durante el bootstrap del sistema, hasta que esté implementado
 * el flujo de auth completo.
 */
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
