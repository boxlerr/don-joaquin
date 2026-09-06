import { redirect } from "next/navigation";
import { getCurrentUser, hasSeccion } from "@/lib/auth";
import { getSueldosResumenAction } from "./actions";
import { getSueldosAdminResumenAction } from "../../sueldos-admin/actions";
import { getNominaMesAction } from "../../sueldos-admin/nomina-actions";
import { getInflacion } from "@/lib/inflacion";
import SueldosUnificadoClient from "./SueldosUnificadoClient";

// Sección "Sueldos" unificada: liquidación de choferes (por viajes) + sueldos de
// administración y taller + aumentos, en pestañas. Cada pestaña se muestra según
// el permiso (sección `sueldos` para choferes; `sueldos_admin` para admin/taller).
// Confidencial: en la práctica solo la ven los administradores.
export default async function SueldosPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const canChoferes = hasSeccion(user, "sueldos", "read");
  const canAdmin = hasSeccion(user, "sueldos_admin", "read");
  if (!canChoferes && !canAdmin) redirect("/dashboard");
  const canAdminWrite = hasSeccion(user, "sueldos_admin", "write");

  const { month = "" } = await searchParams;
  const [choferes, admin, nomina, inflacion] = await Promise.all([
    canChoferes ? getSueldosResumenAction(month) : Promise.resolve(null),
    canAdmin ? getSueldosAdminResumenAction(month) : Promise.resolve(null),
    canAdmin ? getNominaMesAction(month) : Promise.resolve(null),
    canAdmin ? getInflacion() : Promise.resolve(null),
  ]);

  // `h-full` + `flex-col`: la planilla toma el alto que sobra en vez de empujar
  // la página. El encabezado va adentro del cliente porque comparte renglón con
  // las pestañas, y cada renglón de más son filas que quedan fuera de pantalla.
  return (
    <div className="h-full flex flex-col min-h-0 px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
      <SueldosUnificadoClient
        choferes={choferes}
        admin={admin}
        nomina={nomina}
        inflacion={inflacion}
        month={month}
        canChoferes={canChoferes}
        canAdmin={canAdmin}
        canAdminWrite={canAdminWrite}
      />
    </div>
  );
}
