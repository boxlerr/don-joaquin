import PageHeader from "@/components/layout/PageHeader";
import { requireSeccion, hasSeccion } from "@/lib/auth";
import { getImpuestosAction } from "./actions";
import ImpuestosClient from "./ImpuestosClient";
import HelpTutorialButton from "./help-tutorial-button";
import ExportImpuestosButton from "./export-impuestos-button";

// Las métricas se cuentan del lado del cliente junto con las solapas y el
// filtro: son el mismo número. Contarlas acá arriba y filtrar allá abajo era
// justamente lo que dejaba a la tarjeta diciendo 11 y a la lista mostrando 3.

export default async function ImpuestosPage() {
  const user = await requireSeccion("impuestos", "read");
  const canWrite = hasSeccion(user, "impuestos", "write");

  const impuestos = await getImpuestosAction();

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <PageHeader
        title="Impuestos"
        description="Calendario de vencimientos impositivos — checklist de presentación y alertas"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ExportImpuestosButton />
            <HelpTutorialButton />
          </div>
        }
      />

      <ImpuestosClient impuestos={impuestos} canWrite={canWrite} />
    </div>
  );
}
