import PageHeader from "@/components/layout/PageHeader";
import { requireArea } from "@/lib/auth";
import TarifasTabs from "./TarifasTabs";
import {
  getTarifaParams,
  obtenerClientesYRutas,
  obtenerTarifas,
} from "./actions";

export default async function TarifasPage() {
  await requireArea("comercial", "read");
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
      />
    </div>
  );
}
