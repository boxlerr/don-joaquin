import PageHeader from "@/components/layout/PageHeader";
import { requireSeccion, hasSeccion } from "@/lib/auth";
import { getVacacionesGlobal } from "./lib";
import VacacionesClient from "./VacacionesClient";

export default async function VacacionesPage() {
  const user = await requireSeccion("choferes_vacaciones", "read");
  const canWrite = hasSeccion(user, "choferes_vacaciones", "write");
  const { saldos, periodos, finPeriodoY, umbralConfig, choferesActivos } = await getVacacionesGlobal();

  return (
    <div className="p-8 space-y-6 w-full">
      <PageHeader
        title="Vacaciones"
        description="Cronograma, saldos y carga de vacaciones por empleado"
      />
      <VacacionesClient
        saldos={saldos}
        periodos={periodos}
        finPeriodoY={finPeriodoY}
        canWrite={canWrite}
        umbralConfig={umbralConfig}
        choferesActivos={choferesActivos}
      />
    </div>
  );
}
