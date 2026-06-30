import PageHeader from "@/components/layout/PageHeader";
import { requireSeccion, hasSeccion } from "@/lib/auth";
import TarifasTabs from "./TarifasTabs";
import {
  getTarifaParams,
  obtenerCircuitos,
  obtenerClientesYRutas,
  obtenerPuntosRuta,
  obtenerTarifas,
} from "./actions";

export default async function TarifasPage() {
  const user = await requireSeccion("tarifas", "read");
  const canWrite = hasSeccion(user, "tarifas", "write");
  const [params, { clientes, rutas }, tarifas, circuitos, puntos] =
    await Promise.all([
      getTarifaParams(),
      obtenerClientesYRutas(),
      obtenerTarifas(),
      obtenerCircuitos(),
      obtenerPuntosRuta(),
    ]);

  return (
    <div className="p-8">
      <PageHeader
        title="Tarifas"
        description="Calculadora, tarifas por cliente, circuitos y parámetros globales"
      />
      <TarifasTabs
        params={params}
        clientes={clientes}
        rutas={rutas}
        tarifas={tarifas}
        circuitos={circuitos}
        puntos={puntos}
        canWrite={canWrite}
      />
    </div>
  );
}
