import PageHeader from "@/components/layout/PageHeader";
import { requireArea, hasArea } from "@/lib/auth";
import { getVacacionesGlobal } from "./lib";
import VacacionesClient from "./VacacionesClient";

export default async function VacacionesPage() {
  const user = await requireArea("logistica", "read");
  const canWrite = hasArea(user, "logistica", "write");
  const { saldos, periodos, finPeriodoY } = await getVacacionesGlobal();

  return (
    <div className="p-8 space-y-6 w-full">
      <PageHeader
        title="Vacaciones"
        description="Cronograma, saldos y carga de vacaciones por empleado"
      />
      <VacacionesClient saldos={saldos} periodos={periodos} finPeriodoY={finPeriodoY} canWrite={canWrite} />
    </div>
  );
}
