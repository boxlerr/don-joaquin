import { redirect } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import { getCurrentUser, hasSeccion } from "@/lib/auth";
import { getMetricasAction } from "./actions";
import MetricasClient from "./MetricasClient";
import MesSelectorMetricas from "./components/MesSelectorMetricas";
import ExportarButton from "./components/ExportarButton";
import HelpTutorialButton from "./help-tutorial-button";

// Métricas históricas — las 6 planillas de gestión (sueldo s/facturación,
// facturación por km, costo vs km, km vacíos, km al 100%, toneladas) en un
// dashboard con comparación contra el mes anterior y el mismo mes del año
// anterior, más modo EN VIVO para el mes en curso.
// Confidencial: sección `metricas` (por defecto, solo admins).
export default async function MetricasPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; tab?: string; compare?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasSeccion(user, "metricas", "read")) redirect("/dashboard");

  const { month = "", compare = "" } = await searchParams;
  const data = await getMetricasAction(month, compare);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <PageHeader
        title="Métricas históricas"
        description="Las planillas de gestión mensuales, comparadas contra el mes anterior y el año anterior"
        action={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <MesSelectorMetricas
              value={data.mes.slice(0, 7)}
              mesesDisponibles={data.mesesDisponibles}
              hoyMes={data.hoyMes}
            />
            <HelpTutorialButton />
            <ExportarButton mes={data.mes} />
          </div>
        }
      />
      <MetricasClient data={data} />
    </div>
  );
}
