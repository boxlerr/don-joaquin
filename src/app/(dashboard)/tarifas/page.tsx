import PageHeader from "@/components/layout/PageHeader";
import { requireSeccion, hasSeccion } from "@/lib/auth";
import TarifasTabs, { type TabIdEntrada } from "./TarifasTabs";
import { obtenerCircuitos, obtenerClientesYRutas, obtenerPuntosRuta } from "./actions";
import { obtenerAumentosClientes } from "./actions-aumentos";

// Duplicada acá porque TarifasTabs es "use client" y sus valores no se pueden
// usar del lado server (mismo patrón que /mantenimiento). Se aceptan los ids
// viejos porque /metricas linkea con ?tab=aumentos.
const TABS_VALIDAS: TabIdEntrada[] = ["tarifas", "circuitos", "aumentos", "calculadora", "ajustes"];

export default async function TarifasPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; cliente?: string }>;
}) {
  const user = await requireSeccion("tarifas", "read");
  const canWrite = hasSeccion(user, "tarifas", "write");
  const canMetricas = hasSeccion(user, "metricas", "read");
  const { tab, cliente } = await searchParams;
  const initialTab = TABS_VALIDAS.includes(tab as TabIdEntrada) ? (tab as TabIdEntrada) : undefined;

  const [{ clientes }, circuitos, puntos, aumentos] = await Promise.all([
    obtenerClientesYRutas(),
    obtenerCircuitos(),
    obtenerPuntosRuta(),
    obtenerAumentosClientes(),
  ]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader title="Tarifas" description="Aumentos de tarifa por cliente y circuitos" />
      <TarifasTabs
        clientes={clientes}
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
