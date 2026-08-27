import PageHeader from "@/components/layout/PageHeader";
import { requireSeccion, hasSeccion } from "@/lib/auth";
import { getPrestamosAction, getTopesAction } from "./actions";
import PrestamosClient from "./PrestamosClient";
import { focoDeParam } from "./filtros";
import HelpTutorialButton from "./help-tutorial-button";
import ExportPrestamosButton from "./export-prestamos-button";
import AddPrestamoDialog from "./AddPrestamoDialog";

/**
 * Préstamos bancarios (audio Bárbara 02/07): la planilla de la mamá en el
 * sistema — cuotas por banco con fecha, importe, número (44/48) y tasa.
 * Avisa los vencimientos y muestra cuánto hay que pagar por semana, para
 * planificar pagos y financiación de cheques. Sección confidencial.
 */
export default async function PrestamosPage({
  searchParams,
}: {
  searchParams: Promise<{ foco?: string }>;
}) {
  const user = await requireSeccion("prestamos", "read");
  const canWrite = hasSeccion(user, "prestamos", "write");

  const [prestamos, topes] = await Promise.all([getPrestamosAction(), getTopesAction()]);
  // Se puede entrar directo a una lista (?foco=vencidas, desde el resumen del día).
  const focoInicial = focoDeParam((await searchParams).foco);
  // Las grafías de banco que ya se usan: alimentan el desplegable del alta y de
  // la edición, y evitan que se dupliquen por mayúsculas o acentos.
  const bancos = [...new Set(prestamos.map((p) => p.banco))];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <PageHeader
        title="Préstamos"
        description="Cuotas por banco, vencimientos y carga semanal de pagos"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ExportPrestamosButton />
            <HelpTutorialButton />
            {/* También arriba: cargar un préstamo es la acción principal y
                estaba sólo al pie de la tabla. */}
            {canWrite && <AddPrestamoDialog bancos={bancos} />}
          </div>
        }
      />

      <PrestamosClient prestamos={prestamos} canWrite={canWrite} topes={topes} focoInicial={focoInicial} />
    </div>
  );
}
