import PageHeader from "@/components/layout/PageHeader";
import { requireArea, hasArea } from "@/lib/auth";
import {
  getMesesCostosAction,
  getCostosRepRepAction,
  getCostosResumenAction,
} from "./actions";
import CostosRepRepClient from "./CostosRepRepClient";

export const dynamic = "force-dynamic";

export default async function CostosRepRepPage() {
  const user = await requireArea("mantenimiento", "read");
  const canWrite = hasArea(user, "mantenimiento", "write");

  const meses = await getMesesCostosAction();
  const mesInicial = meses[0] ?? null;
  const [rows, resumen] = await Promise.all([
    getCostosRepRepAction(mesInicial),
    getCostosResumenAction(),
  ]);

  return (
    <div className="p-8">
      <PageHeader
        title="Costos de Repuestos y Reparaciones"
        description="Resumen mensual por proveedor — importe neto y facturado, gravado (21%) y no gravado"
      />
      <div className="mt-6">
        <CostosRepRepClient
          meses={meses}
          mesInicial={mesInicial}
          rowsIniciales={rows}
          resumen={resumen}
          canWrite={canWrite}
        />
      </div>
    </div>
  );
}
