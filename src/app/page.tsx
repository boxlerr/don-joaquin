import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function RootPage() {
  const user = await getCurrentUser();
  // Cada uno entra por donde trabaja: Anabela a Compliance, el resto al
  // dashboard. Lo define `usuarios.pantalla_inicio`.
  redirect(user ? user.pantalla_inicio ?? "/dashboard" : "/login");

}
