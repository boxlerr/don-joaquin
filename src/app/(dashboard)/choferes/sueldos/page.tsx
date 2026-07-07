import { redirect } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import { getCurrentUser, hasSeccion } from "@/lib/auth";
import MesSelector from "../../combustible/components/MesSelector";
import { getSueldosResumenAction } from "./actions";
import { getSueldosAdminResumenAction } from "../../sueldos-admin/actions";
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
  const [choferes, admin, inflacion] = await Promise.all([
    canChoferes ? getSueldosResumenAction(month) : Promise.resolve(null),
    canAdmin ? getSueldosAdminResumenAction(month) : Promise.resolve(null),
    canAdmin ? getInflacion() : Promise.resolve(null),
  ]);

  return (
    <div className="p-8 space-y-6">
      <PageHeader
        title="Sueldos"
        description="Liquidación de choferes (por viajes) y sueldos de administración y taller"
        action={<MesSelector currentMonth={month} />}
      />
      <SueldosUnificadoClient
        choferes={choferes}
        admin={admin}
        inflacion={inflacion}
        month={month}
        canChoferes={canChoferes}
        canAdmin={canAdmin}
        canAdminWrite={canAdminWrite}
      />
    </div>
  );
}
