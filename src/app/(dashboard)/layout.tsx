import DashboardShell from "@/components/layout/DashboardShell";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  const [{ data: { user } }, { count: alertasCount }] = await Promise.all([
    supabase.auth.getUser(),
    adminSupabase
      .from("alertas")
      .select("*", { count: "exact", head: true })
      .eq("estado", "pendiente"),
  ]);

  let sidebarUser = null;
  if (user) {
    const { data: usuario } = await supabase
      .from("usuarios")
      .select("nombre, apellido, email, roles(nombre)")
      .eq("id", user.id)
      .maybeSingle();

    if (usuario) {
      const avatarUrl =
        (user.user_metadata?.avatar_url as string | undefined) ??
        (user.user_metadata?.picture as string | undefined) ??
        null;

      sidebarUser = {
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        email: usuario.email,
        rol: usuario.roles?.nombre ?? null,
        avatarUrl,
      };
    }
  }

  return (
    <DashboardShell user={sidebarUser} alertasCount={alertasCount ?? 0}>
      {children}
    </DashboardShell>
  );
}
