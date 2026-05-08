import PageHeader from "@/components/layout/PageHeader";
import StatCard from "@/components/ui/StatCard";
import { EmptyTableRow } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
} from "@/components/ui/table";
import { MapPin, Plus, Filter, Download } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function ViajesPage() {
  const supabase = createAdminClient();

  const [
    total,
    enCurso,
    pendientes,
    sinFacturar,
    internacionales,
    clientes,
    choferes,
    camiones,
  ] = await Promise.all([
    supabase.from("viajes").select("*", { count: "exact", head: true }),
    supabase.from("viajes").select("*", { count: "exact", head: true }).eq("estado", "en_curso"),
    supabase.from("viajes").select("*", { count: "exact", head: true }).eq("estado", "pendiente"),
    supabase.from("viajes").select("*", { count: "exact", head: true }).eq("facturado", false),
    supabase
      .from("viajes")
      .select("*", { count: "exact", head: true })
      .eq("es_internacional", true),
    supabase
      .from("clientes")
      .select("id, razon_social")
      .eq("estado", "activo")
      .order("razon_social"),
    supabase
      .from("choferes")
      .select("id, nombre, apellido")
      .eq("estado", "activo")
      .order("apellido"),
    supabase.from("camiones").select("id, patente").eq("estado", "operativo").order("patente"),
  ]);

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

      <div className="bg-white rounded-[8px] border border-[#E2E8F0] shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-[#0088D1]" />
            <h2 className="text-[#0F172A] text-sm font-semibold">Listado de Viajes</h2>
          </div>
          <Button variant="ghost" size="sm">
            <Filter size={14} />
            Filtros
          </Button>
        </div>

        <div className="grid grid-cols-6 gap-3 px-5 py-3 border-b border-[#E2E8F0] bg-[#F8FAFC]">
          <Input type="date" className="text-sm" />
          <Input type="date" className="text-sm" />
          <select className="h-9 px-3 text-sm border border-[#E2E8F0] rounded-md bg-white text-[#475569]">
            <option value="">Todos los clientes ({clientes.data?.length ?? 0})</option>
            {clientes.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.razon_social}
              </option>
            ))}
          </select>
          <select className="h-9 px-3 text-sm border border-[#E2E8F0] rounded-md bg-white text-[#475569]">
            <option value="">Todos los choferes ({choferes.data?.length ?? 0})</option>
            {choferes.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.apellido}, {c.nombre}
              </option>
            ))}
          </select>
          <select className="h-9 px-3 text-sm border border-[#E2E8F0] rounded-md bg-white text-[#475569]">
            <option value="">Todos los camiones ({camiones.data?.length ?? 0})</option>
            {camiones.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.patente}
              </option>
            ))}
          </select>
          <select className="h-9 px-3 text-sm border border-[#E2E8F0] rounded-md bg-white text-[#475569]">
            <option>Todos los estados</option>
            <option>Pendiente</option>
            <option>En curso</option>
            <option>Cerrado</option>
          </select>
        </div>

        <Table>
          <TableHeader className="bg-[#F8FAFC]">
            <TableRow>
              {[
                "Fecha",
                "Origen → Destino",
                "Cliente",
                "Camión",
                "Chofer",
                "Tipo carga",
                "KM",
                "Tonelaje",
                "Remito",
                "Facturación",
                "Estado",
              ].map((col) => (
                <TableHead
                  key={col}
                  className="text-xs font-semibold text-[#475569] uppercase tracking-wide"
                >
                  {col}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <EmptyTableRow message="Sin viajes registrados" />
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
