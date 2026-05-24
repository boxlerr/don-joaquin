import { cache } from "react";
import DashboardShell from "@/components/layout/DashboardShell";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import type { SidebarUser } from "@/components/layout/Sidebar";

const getLayoutData = cache(async () => {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  const [{ data: { user: authUser } }, { count: alertasCount }, currentUser] = await Promise.all([
    supabase.auth.getUser(),
    adminSupabase
      .from("alertas")
      .select("*", { count: "exact", head: true })
      .eq("estado", "pendiente"),
    getCurrentUser(),
  ]);

  let sidebarUser: SidebarUser | null = null;
  if (currentUser) {
    const avatarUrl =
      (authUser?.user_metadata?.avatar_url as string | undefined) ??
      (authUser?.user_metadata?.picture as string | undefined) ??
      null;

    sidebarUser = {
      nombre: currentUser.nombre,
      apellido: currentUser.apellido,
      email: currentUser.email,
      rol: currentUser.rol.nombre,
      avatarUrl,
      permisos: currentUser.permisos,
    };
  }

  return { sidebarUser, alertasCount: alertasCount ?? 0 };
});

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { sidebarUser, alertasCount } = await getLayoutData();

  return (
    <DashboardShell user={sidebarUser} alertasCount={alertasCount}>
      {children}
    </DashboardShell>
  );
}
