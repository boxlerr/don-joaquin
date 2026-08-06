import { requireSeccion, hasSeccion } from "@/lib/auth";
import { getCalendario } from "@/lib/feriados-server";
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

  // Feriados para el calendario día por día. Sólo los plenos: los días no
  // laborables (Jueves Santo, los religiosos) son optativos y acá se trabaja,
  // así que pintarlos haría creer que esos días no falta nadie.
  const calendario = await getCalendario();
  const feriados = Object.fromEntries(
    [...calendario.values()].filter((f) => f.es_feriado).map((f) => [f.fecha, f.nombre]),
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full">
      {/* El encabezado lo arma el cliente: las acciones (exportar, importar,
          cargar) van al lado del título, y ésas necesitan sus handlers. */}
      <VacacionesClient
        tutorial={<HelpTutorialButton />}
        saldos={saldos}
        periodos={periodos}
        finPeriodoY={finPeriodoY}
        canWrite={canWrite}
        umbralConfig={umbralConfig}
        choferesActivos={choferesActivos}
        feriados={feriados}
      />
    </div>
  );
}
