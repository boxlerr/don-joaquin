import { cache } from "react";
import { redirect } from "next/navigation";
import DashboardShell from "@/components/layout/DashboardShell";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { getResumenUsuario } from "@/lib/alertas-lecturas";
import type { SidebarUser } from "@/components/layout/Sidebar";

const getLayoutData = cache(async () => {
  const supabase = await createClient();

  const [{ data: { user: authUser } }, currentUser] = await Promise.all([
    supabase.auth.getUser(),
    getCurrentUser(),
  ]);

  // Contador POR USUARIO: alertas pendientes que ESTE usuario no leyó (misma
  // definición que /api/alertas, así el badge llega a 0 al marcar todo).
  const alertasCount = currentUser ? (await getResumenUsuario(currentUser.id)).count : 0;

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

  return {
    sidebarUser,
    alertasCount,
    userId: currentUser?.id ?? null,
    mustChangePassword: currentUser?.must_change_password ?? false,
  };
});

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { sidebarUser, alertasCount, userId, mustChangePassword } = await getLayoutData();

  // Usuario con contraseña provisoria (alta nueva o reseteo por admin): debe
  // definir una contraseña propia antes de entrar a cualquier parte del sistema.
  if (mustChangePassword) {
    redirect("/auth/cambiar-password");
  }

  return (
    <DashboardShell user={sidebarUser} alertasCount={alertasCount} userId={userId}>
      {children}
    </DashboardShell>
  );
}
