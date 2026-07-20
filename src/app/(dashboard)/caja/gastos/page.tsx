import PageHeader from "@/components/layout/PageHeader";
import StatCard from "@/components/ui/StatCard";
import { Button } from "@/components/ui/button";
import { Receipt, Plus, AlertCircle, Truck, Calendar } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSeccion, hasSeccion } from "@/lib/auth";
import AddGastoDialog from "../../gastos/components/AddGastoDialog";
import GastosTable from "../../gastos/components/GastosTable";
import HelpTutorialButton from "../../gastos/help-tutorial-button";
import { getGastoFormData } from "../../gastos/actions";
import CajaTabs from "../CajaTabs";

function formatARS(n: number): string {
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Gastos, ahora como solapa de Caja (antes vivía en /gastos, con entrada propia
 * en el sidebar). Es un tipo de egreso de la caja, no un módulo aparte.
 * El permiso es el mismo de siempre: subsección "gastos".
 */
export default async function CajaGastosPage() {
  const user = await requireSeccion("gastos", "read");
  const canWrite = hasSeccion(user, "gastos", "write");
  const supabase = createAdminClient();

  const hoy = new Date();
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0];

  const [formData, gastosMes, sinAsignarCount, totalCount] = await Promise.all([
    getGastoFormData(),
    supabase
      .from("gastos")
      .select("monto, camion_id")
      .gte("fecha", inicioMes)
      .lte("fecha", finMes),
    supabase
      .from("gastos")
      .select("*", { count: "exact", head: true })
      .is("viaje_id", null)
      .is("camion_id", null)
      .is("chofer_id", null),
    supabase.from("gastos").select("*", { count: "exact", head: true }),
  ]);

  const totalMes = (gastosMes.data ?? []).reduce(
    (acc, g) => acc + Number(g.monto || 0),
    0
  );

  // Top camión del mes
  const porCamion = new Map<string, number>();
  for (const g of gastosMes.data ?? []) {
    if (!g.camion_id) continue;
    porCamion.set(g.camion_id, (porCamion.get(g.camion_id) ?? 0) + Number(g.monto || 0));
  }
  let topCamionLabel = "—";
  let topCamionMonto = 0;
  if (porCamion.size > 0) {
    const [topId, topMonto] = [...porCamion.entries()].sort((a, b) => b[1] - a[1])[0];
    const patente = formData.camiones.find((c) => c.id === topId)?.patente;
    topCamionLabel = patente ?? "—";
    topCamionMonto = topMonto;
  }

  return (
    <div className="p-8">
      <PageHeader
        title="Gastos"
        description="Lente operativo de gastos — trazabilidad por viaje, camión y chofer"
        action={
          <div className="flex items-center gap-2.5">
            <HelpTutorialButton />
            {canWrite && (
              <AddGastoDialog
                tiposGasto={formData.tiposGasto}
                viajes={formData.viajes}
                camiones={formData.camiones}
                choferes={formData.choferes}
              >
                <Button variant="brand" size="sm">
                  <Plus size={14} />
                  Registrar gasto
                </Button>
              </AddGastoDialog>
            )}
          </div>
        }
      />

      <CajaTabs showGastos />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total del mes"
          value={`$ ${formatARS(totalMes)}`}
          sub="Gastos cargados"
          color="brand"
          icon={Calendar}
        />
        <StatCard
          label="Total registrados"
          value={String(totalCount.count ?? 0)}
          sub="Histórico"
          color="success"
          icon={Receipt}
        />
        <StatCard
          label="Top camión (mes)"
          value={topCamionLabel}
          sub={topCamionMonto > 0 ? `$ ${formatARS(topCamionMonto)}` : "Sin gastos"}
          color="warning"
          icon={Truck}
        />
        <StatCard
          label="Sin asignar"
          value={String(sinAsignarCount.count ?? 0)}
          sub="Pendientes de vincular"
          color="error"
          icon={AlertCircle}
        />
      </div>

      <GastosTable
        tiposGasto={formData.tiposGasto}
        viajes={formData.viajes}
        camiones={formData.camiones}
      />
    </div>
  );
}
