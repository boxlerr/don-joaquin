import PageHeader from "@/components/layout/PageHeader";
import { requireSeccion, hasSeccion } from "@/lib/auth";
import {
  getMesesCostosAction,
  getCostosRepRepAction,
  getCostosResumenAction,
  getProveedoresCostosAction,
} from "./actions";
import CostosRepRepClient from "./CostosRepRepClient";
import HelpTutorialButton from "./help-tutorial-button";

export const dynamic = "force-dynamic";

export default async function CostosRepRepPage() {
  const user = await requireSeccion("mantenimiento_costos", "read");
  const canWrite = hasSeccion(user, "mantenimiento_costos", "write");

  const meses = await getMesesCostosAction();
  const mesInicial = meses[0] ?? null;
  const [rows, resumen, proveedores] = await Promise.all([
    getCostosRepRepAction(mesInicial),
    getCostosResumenAction(),
    getProveedoresCostosAction(),
  ]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* `triggerClassName` REEMPLAZA las clases del disparador, no las suma: con
          sólo "h-7" el botón quedaba en 28px (abajo del mínimo táctil) y sin
          alineación entre el ícono y el texto. */}
      <PageHeader
        title="Costos de Repuestos y Reparaciones"
        description="Resumen mensual por proveedor — importe neto, IVA y facturado"
        action={
          <HelpTutorialButton triggerClassName="h-9 sm:h-7 inline-flex items-center gap-1.5 text-xs" />
        }
      />
      <div className="mt-6">
        <CostosRepRepClient
          mesInicial={mesInicial}
          rowsIniciales={rows}
          resumen={resumen}
          proveedores={proveedores}
          canWrite={canWrite}
        />
      </div>
    </div>
  );
}
