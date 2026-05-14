import PageHeader from "@/components/layout/PageHeader";
import StatCard from "@/components/ui/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Plus } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import AddChoferDialog from "./components/AddChoferDialog";
import ChoferCard from "./components/ChoferCard";

export default async function ChoferesPage() {
  const supabase = createAdminClient();

  const [{ data: choferes, count: total }, activos, inactivos, docs] = await Promise.all([
    supabase
      .from("choferes")
      .select("*, foto:documentos_archivos(bucket, path)", { count: "exact" })
      .order("apellido"),
    supabase
      .from("choferes")
      .select("*", { count: "exact", head: true })
      .eq("estado", "activo"),
    supabase
      .from("choferes")
      .select("*", { count: "exact", head: true })
      .eq("estado", "inactivo"),
    supabase.from("chofer_documentos").select("*", { count: "exact", head: true }),
  ]);

  const choferesMapeados = choferes?.map((c) => ({
    ...c,
    foto: c.foto ? (Array.isArray(c.foto) ? c.foto[0] : c.foto) : null,
  }));

  return (
    <div className="p-8">
      <PageHeader
        title="Choferes"
        description="Legajo digital — sin acceso al sistema (gestión administrativa)"
        action={
          <AddChoferDialog>
            <Button variant="brand" size="sm">
              <Plus size={14} />
              Nuevo chofer
            </Button>
          </AddChoferDialog>
        }
      />

      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Total choferes" value={String(total ?? 0)} sub="En planilla" color="brand" />
        <StatCard label="Activos" value={String(activos.count ?? 0)} color="success" />
        <StatCard label="Inactivos" value={String(inactivos.count ?? 0)} color="warning" />
        <StatCard
          label="Documentos"
          value={String(docs.count ?? 0)}
          sub="Registrados en legajos"
          color="error"
        />
      </div>

      {/* Contenedor de filtros y listado en Cards */}
      <div className="space-y-4">
        <div className="bg-white rounded-[8px] border border-[#E2E8F0] px-5 py-4 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-[#0088D1]" />
            <h2 className="text-[#0F172A] text-sm font-semibold">Listado de Choferes en Plantilla</h2>
          </div>
          <div className="flex items-center gap-2">
            <select className="h-9 px-3 text-sm border border-[#E2E8F0] rounded-md bg-white text-[#475569]">
              <option>Todos los estados</option>
              <option>Activo</option>
              <option>Inactivo</option>
            </select>
            <Input type="search" placeholder="Buscar por nombre o DNI..." className="w-64 text-sm" />
          </div>
        </div>

        {!choferesMapeados || choferesMapeados.length === 0 ? (
          <div className="bg-white rounded-[8px] border border-[#E2E8F0]">
            <EmptyState icon={Users} message="Sin choferes registrados" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {choferesMapeados.map((c) => (
              <ChoferCard key={c.id} chofer={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
