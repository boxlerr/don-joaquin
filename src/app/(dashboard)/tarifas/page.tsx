import PageHeader from "@/components/layout/PageHeader";
import { requireSeccion, hasSeccion } from "@/lib/auth";
import TarifasTabs, { type TabId } from "./TarifasTabs";
import {
  getTarifaParams,
  obtenerCircuitos,
  obtenerClientesYRutas,
  obtenerPuntosRuta,
  obtenerTarifas,
} from "./actions";
import { obtenerAumentosClientes } from "./actions-aumentos";

// Duplicada acá porque TarifasTabs es "use client" y sus valores no se pueden
// usar del lado server (mismo patrón que /mantenimiento).
const TABS_VALIDAS: TabId[] = ["calculadora", "tarifas", "aumentos", "circuitos", "ajustes"];

export default async function TarifasPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; cliente?: string }>;
}) {
  const user = await requireSeccion("tarifas", "read");
  const canWrite = hasSeccion(user, "tarifas", "write");
  const canMetricas = hasSeccion(user, "metricas", "read");
  const { tab, cliente } = await searchParams;
  const initialTab = TABS_VALIDAS.includes(tab as TabId) ? (tab as TabId) : undefined;

  const [params, { clientes, rutas }, tarifas, circuitos, puntos, aumentos] =
    await Promise.all([
      getTarifaParams(),
      obtenerClientesYRutas(),
      obtenerTarifas(),
      obtenerCircuitos(),
      obtenerPuntosRuta(),
      obtenerAumentosClientes(),
    ]);

  return (
    <div className="p-8">
      <PageHeader
        title="Tarifas"
        description="Calculadora, tarifas y aumentos por cliente, circuitos y parámetros globales"
      />
      <TarifasTabs
        params={params}
        clientes={clientes}
        rutas={rutas}
        tarifas={tarifas}
        circuitos={circuitos}
        puntos={puntos}
        aumentos={aumentos}
        canWrite={canWrite}
        canMetricas={canMetricas}
        initialTab={initialTab}
        initialCliente={cliente}
      />
    </div>
  );
}
