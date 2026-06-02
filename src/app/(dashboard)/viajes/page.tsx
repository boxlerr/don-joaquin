import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import StatCard from "@/components/ui/StatCard";
import { Button } from "@/components/ui/button";
import { MapPin, X, Receipt, Zap } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireArea, hasArea } from "@/lib/auth";
import ViajesTable from "./components/ViajesTable";
import NewViajeSheet from "./components/new-viaje-sheet";
import ImportHojasRutaModal from "./components/ImportHojasRutaModal";
import { getViajeFormData } from "./actions";
import AddGastoDialog from "../gastos/components/AddGastoDialog";
import { getGastoFormData } from "../gastos/actions";

export default async function ViajesPage({
  searchParams,
}: {
  searchParams: Promise<{ choferId?: string }>;
}) {
  const user = await requireArea("logistica", "read");
  const canWrite = hasArea(user, "logistica", "write");
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
      .neq("estado", "cancelado"),
    supabase
      .from("viajes")
      .select("*", { count: "exact", head: true })
      .eq("es_internacional", true),
  ] as const;

  const choferQuery = choferId
    ? supabase
        .from("choferes")
        .select("nombre, apellido")
        .eq("id", choferId)
        .single()
    : null;

  const [
    [total, enCurso, pendientes, sinFacturar, internacionales],
    choferResult,
    formData,
    gastoFormData,
  ] = await Promise.all([
    Promise.all(statsQuery),
    choferQuery ?? Promise.resolve(null),
    getViajeFormData(),
    getGastoFormData(),
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
            {canWrite && viajeFormData && <NewViajeSheet data={viajeFormData} />}
          </div>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <StatCard label="Total viajes" value={String(total.count ?? 0)} color="brand" />
        <StatCard label="En curso" value={String(enCurso.count ?? 0)} color="success" />
        <StatCard label="Pendientes" value={String(pendientes.count ?? 0)} color="warning" />
        <StatCard
          label="Sin facturar"
          value={String(sinFacturar.count ?? 0)}
          sub="Finalizados"
          color="error"
        />
        <StatCard
          label="Internacional"
          value={String(internacionales.count ?? 0)}
          sub="Uruguay (IVA)"
          color="brand"
        />
      </div>

      <div className="bg-card rounded-[8px] border border-border shadow-sm dark:shadow-none mb-1">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <MapPin size={16} className="text-primary" />
            <h2 className="text-foreground text-sm font-semibold">Listado de Viajes</h2>
            {choferNombre && (
              <span className="inline-flex items-center gap-1.5 pl-2 pr-1 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                Filtrado por: {choferNombre}
                <Link
                  href="/viajes"
                  className="flex items-center hover:text-primary/80 transition-colors"
                  aria-label="Limpiar filtro de chofer"
                >
                  <X size={12} />
                </Link>
              </span>
            )}
          </div>
        </div>
      </div>

      <ViajesTable choferId={choferId} />
    </div>
  );
}
