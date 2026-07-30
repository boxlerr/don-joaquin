import PageHeader from "@/components/layout/PageHeader";
import { requireSeccion, hasSeccion } from "@/lib/auth";
import { getVacacionesGlobal } from "./lib";
import VacacionesClient from "./VacacionesClient";
import HelpTutorialButton from "./help-tutorial-button";

// Los saldos se leen en el servidor, así que sin esto Next servía la página
// guardada: se corregían los días de alguien en su legajo y acá seguía el número
// viejo. El legajo no tenía el problema porque es un componente de cliente y
// pide los datos cada vez que se abre.
export const dynamic = "force-dynamic";

export default async function VacacionesPage() {
  const user = await requireSeccion("choferes_vacaciones", "read");
  const canWrite = hasSeccion(user, "choferes_vacaciones", "write");
  const { saldos, periodos, finPeriodoY, umbralConfig, choferesActivos } = await getVacacionesGlobal();

  return (
    <div className="p-8 space-y-6 w-full">
      <PageHeader
        title="Vacaciones"
        description="Cronograma, saldos y carga de vacaciones por empleado"
        action={<HelpTutorialButton />}
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
