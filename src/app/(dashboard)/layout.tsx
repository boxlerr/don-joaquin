import DashboardShell from "@/components/layout/DashboardShell";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  return <DashboardShell user={sidebarUser}>{children}</DashboardShell>;
}
