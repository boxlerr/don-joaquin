import PageHeader from "@/components/layout/PageHeader";
import { requireArea, hasArea } from "@/lib/auth";
import TarifasTabs from "./TarifasTabs";
import {
  getTarifaParams,
  obtenerClientesYRutas,
  obtenerTarifas,
} from "./actions";

export default async function TarifasPage() {
  const user = await requireArea("comercial", "read");
  const canWrite = hasArea(user, "comercial", "write");
  const [params, { clientes, rutas }, tarifas] = await Promise.all([
    getTarifaParams(),
    obtenerClientesYRutas(),
    obtenerTarifas(),
  ]);

  return (
    <div className="p-8">
      <PageHeader
        title="Tarifas"
        description="Calculadora, tarifas por cliente y parámetros globales"
      />
      <TarifasTabs
        params={params}
        clientes={clientes}
        rutas={rutas}
        tarifas={tarifas}
        canWrite={canWrite}
      />
    </div>
  );
}
