import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Receipt, Zap, ClipboardList } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSeccion, hasSeccion, hasArea } from "@/lib/auth";
import ViajesStatsPanel from "./components/ViajesStatsPanel";
import NewViajeSheet from "./components/new-viaje-sheet";
import ImportsMenu from "./components/ImportsMenu";
import HelpTutorialButton from "./help-tutorial-button";
import DisponibilidadChoferes from "./components/DisponibilidadChoferes";
import { getViajeFormData, getAusenciasProximasAction } from "./actions";
import { esFaltaDato } from "./types";
import { resolverRango } from "../choferes/ranking/lib";
import AddGastoDialog from "../gastos/components/AddGastoDialog";
import { getGastoFormData } from "../gastos/actions";

export default async function ViajesPage({
  searchParams,
}: {
  searchParams: Promise<{
    choferId?: string;
    filtro?: string;
    rango?: string;
    desde?: string;
    hasta?: string;
    /** ?falta=km|monto|tonelaje|chofer — llega desde /metricas. */
    falta?: string;
    /** ?q=RAMALLO — llega desde "A dónde fueron" con el destino ya buscado. */
    q?: string;
  }>;
}) {
  const user = await requireSeccion("viajes_listado", "read");
  const canWrite = hasSeccion(user, "viajes_listado", "write");
  const canRegistrarGasto = hasArea(user, "finanzas", "write");
  const { choferId, filtro, rango, desde, hasta, falta, q } = await searchParams;
  const supabase = createAdminClient();

  // Período elegido por el selector de fechas. Default "total" = todos los viajes
  // (las tarjetas muestran el histórico completo si no se elige un rango).
  const periodo = resolverRango({ rango: rango ?? "total", desde, hasta });
  const aplicarFecha = periodo.rango !== "total";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conFecha = (q: any) =>
    aplicarFecha ? q.gte("fecha_viaje", periodo.desde).lte("fecha_viaje", periodo.hasta) : q;

  const statsQuery = [
    // Total = viajes reales: excluye cancelados (soft-delete), igual que las
    // tarjetas y el listado (getViajesAction sin filtro ya los excluye).
    conFecha(supabase.from("viajes").select("*", { count: "exact", head: true }).neq("estado", "cancelado")),
    // "Sin remito": viajes reales (no vacíos) todavía sin facturar.
    conFecha(
      supabase
        .from("viajes")
        .select("*", { count: "exact", head: true })
        .eq("facturado", false)
        .eq("es_vacio", false)
        .neq("estado", "cancelado"),
    ),
    // Vueltas en vacío.
    conFecha(
      supabase
        .from("viajes")
        .select("*", { count: "exact", head: true })
        .eq("es_vacio", true)
        .neq("estado", "cancelado"),
    ),
    // Incompletos: les falta origen, destino o chofer (se cargan después).
    conFecha(
      supabase
        .from("viajes")
        .select("*", { count: "exact", head: true })
        .neq("estado", "cancelado")
        .or("origen_id.is.null,destino_id.is.null,chofer_id.is.null"),
    ),
  ];

  const choferQuery = choferId
    ? supabase
        .from("choferes")
        .select("nombre, apellido")
        .eq("id", choferId)
        .single()
    : null;

  const DIAS_DISPONIBILIDAD = 14;

  const [
    [total, sinFacturar, vacios, incompletos],
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
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <HelpTutorialButton triggerClassName="h-7 px-2.5 rounded-[min(var(--radius-md),12px)] border border-border bg-card text-primary hover:bg-muted inline-flex items-center gap-1 text-[0.8rem] font-medium [&_svg]:size-3.5" />
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
            {canWrite && (
              <Link href="/viajes/planilla-diaria">
                <Button variant="outline" size="sm">
                  <ClipboardList size={14} />
                  Planilla diaria
                </Button>
              </Link>
            )}
            {canWrite && <ImportsMenu />}
            {canWrite && viajeFormData && <NewViajeSheet data={viajeFormData} />}
          </div>
        }
      />

      <ViajesStatsPanel
        stats={{
          total: total.count ?? 0,
          sinFacturar: sinFacturar.count ?? 0,
          vacios: vacios.count ?? 0,
          incompletos: incompletos.count ?? 0,
        }}
        choferId={choferId}
        initialBusqueda={q}
        choferNombre={choferNombre}
        filtroInicial={filtro}
        faltaInicial={esFaltaDato(falta) ? falta : undefined}
        gastoFormData={gastoFormData}
        rango={periodo.rango}
        desdePeriodo={periodo.desde}
        hastaPeriodo={periodo.hasta}
      >
        <DisponibilidadChoferes ausencias={ausenciasProximas} dias={DIAS_DISPONIBILIDAD} />
      </ViajesStatsPanel>
    </div>
  );
}
