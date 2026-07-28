import { cache } from "react";
import { redirect } from "next/navigation";
import { Clock } from "lucide-react";
import DashboardShell from "@/components/layout/DashboardShell";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { getBloqueoHorario, type BloqueoHorario } from "@/lib/acceso-horario";
import { getResumenUsuario } from "@/lib/alertas-lecturas";
import type { SidebarUser } from "@/components/layout/Sidebar";

const getLayoutData = cache(async () => {
  const supabase = await createClient();

  const [{ data: { user: authUser } }, currentUser] = await Promise.all([
    supabase.auth.getUser(),
    getCurrentUser(),
  ]);

  // Bloqueo fuera del horario laboral (pedido de Nicolás, 02/07): si aplica,
  // el shell no se renderiza y se muestra la pantalla de "fuera de horario".
  const bloqueoHorario = currentUser ? await getBloqueoHorario(currentUser) : null;

  // Contador POR USUARIO: alertas pendientes que ESTE usuario no leyó (misma
  // definición que /api/alertas, así el badge llega a 0 al marcar todo).
  const alertasCount =
    currentUser && !bloqueoHorario ? (await getResumenUsuario(currentUser)).count : 0;

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
      secciones: currentUser.secciones,
    };
  }

  return {
    sidebarUser,
    alertasCount,
    userId: currentUser?.id ?? null,
    mustChangePassword: currentUser?.must_change_password ?? false,
    bloqueoHorario,
  };
});

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { sidebarUser, alertasCount, userId, mustChangePassword, bloqueoHorario } =
    await getLayoutData();

  // Usuario con contraseña provisoria (alta nueva o reseteo por admin): debe
  // definir una contraseña propia antes de entrar a cualquier parte del sistema.
  if (mustChangePassword) {
    redirect("/auth/cambiar-password");
  }

  // Fuera del horario laboral (usuarios no admin, con el bloqueo activo): no se
  // renderiza nada del sistema, solo la pantalla de bloqueo.
  if (bloqueoHorario) {
    return <FueraDeHorario bloqueo={bloqueoHorario} />;
  }

  return (
    <DashboardShell user={sidebarUser} alertasCount={alertasCount} userId={userId}>
      {children}
    </DashboardShell>
  );
}

function FueraDeHorario({ bloqueo }: { bloqueo: BloqueoHorario }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-6">
      <div className="max-w-md w-full bg-card border border-border rounded-[12px] shadow-sm p-8 text-center space-y-4">
        <div className="mx-auto w-14 h-14 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center">
          <Clock size={24} className="text-amber-600" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-foreground">Acceso fuera de horario</h1>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            El sistema está disponible de <strong>{bloqueo.desde}</strong> a{" "}
            <strong>{bloqueo.hasta}</strong> hs. Si necesitás entrar ahora, pedile a un
            administrador que te habilite el <strong>acceso 24 hs</strong> desde Usuarios.
          </p>
        </div>
        <p className="text-xs text-muted-foreground/70">
          Volvé a intentar dentro del horario — no hace falta hacer nada más.
        </p>
      </div>
    </div>
  );
}
