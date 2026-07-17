import PageHeader from "@/components/layout/PageHeader";
import { requireSeccion, hasSeccion } from "@/lib/auth";
import { getPrestamosAction } from "./actions";
import PrestamosClient from "./PrestamosClient";
import HelpTutorialButton from "./help-tutorial-button";
import ExportPrestamosButton from "./export-prestamos-button";

/**
 * Préstamos bancarios (audio Bárbara 02/07): la planilla de la mamá en el
 * sistema — cuotas por banco con fecha, importe, número (44/48) y tasa.
 * Avisa los vencimientos y muestra cuánto hay que pagar por semana, para
 * planificar pagos y financiación de cheques. Sección confidencial.
 */
export default async function PrestamosPage() {
  const user = await requireSeccion("prestamos", "read");
  const canWrite = hasSeccion(user, "prestamos", "write");

  const prestamos = await getPrestamosAction();

  return (
    <div className="p-8 space-y-6">
      <PageHeader
        title="Préstamos"
        description="Cuotas por banco, vencimientos y carga semanal de pagos"
        action={
          <div className="flex items-center gap-2">
            <ExportPrestamosButton />
            <HelpTutorialButton />
          </div>
        }
      />

      <PrestamosClient prestamos={prestamos} canWrite={canWrite} />
    </div>
  );
}
