import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import StatCard from "@/components/ui/StatCard";
import { Button } from "@/components/ui/button";
import { MapPin, Plus, Download, X } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import ViajesTable from "./components/ViajesTable";

export default async function ViajesPage({
  searchParams,
}: {
  searchParams: Promise<{ choferId?: string }>;
}) {
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
  ] = await Promise.all([
    Promise.all(statsQuery),
    choferQuery ?? Promise.resolve(null),
  ]);

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
            <Button variant="outline" size="sm">
              <Download size={14} />
              Exportar
            </Button>
            <Button variant="brand" size="sm">
              <Plus size={14} />
              Nuevo viaje
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-5 gap-4 mb-6">
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

      <div className="bg-white rounded-[8px] border border-[#E2E8F0] shadow-sm mb-1">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-3">
            <MapPin size={16} className="text-[#0088D1]" />
            <h2 className="text-[#0F172A] text-sm font-semibold">Listado de Viajes</h2>
            {choferNombre && (
              <span className="inline-flex items-center gap-1.5 pl-2 pr-1 py-0.5 rounded-full text-xs font-medium bg-[#E1F5FE] text-[#0088D1] border border-[#0088D1]/20">
                Filtrado por: {choferNombre}
                <Link
                  href="/viajes"
                  className="flex items-center hover:text-[#004A99] transition-colors"
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
