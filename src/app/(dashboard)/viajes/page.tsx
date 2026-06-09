import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Receipt, Zap } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireArea, hasArea } from "@/lib/auth";
import ViajesStatsPanel from "./components/ViajesStatsPanel";
import NewViajeSheet from "./components/new-viaje-sheet";
import ImportHojasRutaModal from "./components/ImportHojasRutaModal";
import ImportHojaRutaModal from "./components/ImportHojaRutaModal";
import ImportYpfModal from "./components/ImportYpfModal";
import DisponibilidadChoferes from "./components/DisponibilidadChoferes";
import { getViajeFormData, getAusenciasProximasAction } from "./actions";
import AddGastoDialog from "../gastos/components/AddGastoDialog";
import { getGastoFormData } from "../gastos/actions";

export default async function ViajesPage({
  searchParams,
}: {
  searchParams: Promise<{ choferId?: string }>;
}) {
  const user = await requireArea("viajes", "read");
  const canWrite = hasArea(user, "viajes", "write");
  const canRegistrarGasto = hasArea(user, "finanzas", "write");
  const { choferId } = await searchParams;
  const supabase = createAdminClient();

  const statsQuery = [
    supabase.from("viajes").select("*", { count: "exact", head: true }),
    supabase.from("viajes").select("*", { count: "exact", head: true }).eq("estado", "en_curso"),
    supabase.from("viajes").select("*", { count: "exact", head: true }).eq("estado", "pendiente"),
    supabase
      .from("viajes")
      .select("*", { count: "exact", head: true })
      .eq("facturado", false)
      .eq("es_vacio", false)
      .neq("estado", "cancelado"),
    supabase
      .from("viajes")
      .select("*", { count: "exact", head: true })
      .eq("es_vacio", true)
      .neq("estado", "cancelado"),
  ] as const;

  const choferQuery = choferId
    ? supabase
        .from("choferes")
        .select("nombre, apellido")
        .eq("id", choferId)
        .single()
    : null;

  const DIAS_DISPONIBILIDAD = 14;

  const [
    [total, enCurso, pendientes, sinFacturar, vacios],
    choferResult,
    formData,
    gastoFormData,
    ausenciasProximas,
  ] = await Promise.all([
    Promise.all(statsQuery),
    choferQuery ?? Promise.resolve(null),
    getViajeFormData(),
    getGastoFormData(),
    getAusenciasProximasAction(DIAS_DISPONIBILIDAD),
  ]);

  const viajeFormData = "error" in formData ? null : formData;

  const choferNombre =
    choferResult && "data" in choferResult && choferResult.data
      ? `${choferResult.data.apellido}, ${choferResult.data.nombre}`
      : null;

  return (
    <div className="p-8">
      <PageHeader
        title="Viajes"
        description="Núcleo operativo: registro, asociación y trazabilidad de viajes"
        action={
          <div className="flex items-center gap-2">
            {canRegistrarGasto && (
              <AddGastoDialog
                tiposGasto={gastoFormData.tiposGasto}
                viajes={gastoFormData.viajes}
                camiones={gastoFormData.camiones}
                choferes={gastoFormData.choferes}
              >
                <Button variant="outline" size="sm">
                  <Receipt size={14} />
                  Registrar gasto
                </Button>
              </AddGastoDialog>
            )}
            {canWrite && (
              <Link href="/viajes/carga-rapida">
                <Button variant="outline" size="sm">
                  <Zap size={14} />
                  Carga rápida
                </Button>
              </Link>
            )}
            {canWrite && <ImportHojasRutaModal />}
            {canWrite && <ImportHojaRutaModal />}
            {canWrite && <ImportYpfModal />}
            {canWrite && viajeFormData && <NewViajeSheet data={viajeFormData} />}
          </div>
        }
      />

      <ViajesStatsPanel
        stats={{
          total: total.count ?? 0,
          enCurso: enCurso.count ?? 0,
          pendientes: pendientes.count ?? 0,
          sinFacturar: sinFacturar.count ?? 0,
          vacios: vacios.count ?? 0,
        }}
        choferId={choferId}
        choferNombre={choferNombre}
      >
        <DisponibilidadChoferes ausencias={ausenciasProximas} dias={DIAS_DISPONIBILIDAD} />
      </ViajesStatsPanel>
    </div>
  );
}
