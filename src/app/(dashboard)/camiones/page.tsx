import PageHeader from "@/components/layout/PageHeader";
import StatCard from "@/components/ui/StatCard";
import StatusBadge from "@/components/ui/StatusBadge";
import { EmptyTableRow } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Truck, Plus, Fuel, Wrench } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function CamionesPage() {
  const supabase = createAdminClient();

  const [{ data: camiones, count: total }, operativos, mantenimiento, docVencer] =
    await Promise.all([
      supabase
        .from("camiones")
        .select("*", { count: "exact" })
        .order("patente"),
      supabase
        .from("camiones")
        .select("*", { count: "exact", head: true })
        .eq("estado", "operativo"),
      supabase
        .from("camiones")
        .select("*", { count: "exact", head: true })
        .eq("estado", "mantenimiento"),
      supabase.from("camion_documentos").select("*", { count: "exact", head: true }),
    ]);

  return (
    <div className="p-8">
      <PageHeader
        title="Camiones"
        description="Flota de 11 unidades — documentación, mantenimiento y gasoil"
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Fuel size={14} />
              Cargar gasoil
            </Button>
            <Button variant="outline" size="sm">
              <Wrench size={14} />
              Registrar service
            </Button>
            <Button variant="brand" size="sm">
              <Plus size={14} />
              Agregar camión
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Total flota" value={String(total ?? 0)} sub="Unidades activas" color="brand" />
        <StatCard label="Operativos" value={String(operativos.count ?? 0)} color="success" />
        <StatCard label="En mantenimiento" value={String(mantenimiento.count ?? 0)} color="warning" />
        <StatCard
          label="Doc. registradas"
          value={String(docVencer.count ?? 0)}
          sub="Total camion_documentos"
          color="error"
        />
      </div>

      <div className="bg-white rounded-[8px] border border-[#E2E8F0] shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-2">
            <Truck size={16} className="text-[#0088D1]" />
            <h2 className="text-[#0F172A] text-sm font-semibold">Flota de Camiones</h2>
          </div>
          <div className="flex items-center gap-2">
            <select className="h-9 px-3 text-sm border border-[#E2E8F0] rounded-md bg-white text-[#475569]">
              <option>Todas las capacidades</option>
              <option>TN ESC 35</option>
              <option>TN ESC 37.5</option>
            </select>
            <Input type="search" placeholder="Buscar patente..." className="w-56 text-sm" />
          </div>
        </div>
        <Table>
          <TableHeader className="bg-[#F8FAFC]">
            <TableRow>
              {[
                "Patente",
                "Marca/Modelo",
                "Año",
                "Capacidad",
                "Tipo",
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
            {!camiones || camiones.length === 0 ? (
              <EmptyTableRow message="Sin camiones registrados" />
            ) : (
              camiones.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono font-medium">{c.patente}</TableCell>
                  <TableCell>
                    {c.marca} {c.modelo}
                  </TableCell>
                  <TableCell>{c.ano ?? "—"}</TableCell>
                  <TableCell>{Number(c.capacidad_tn).toFixed(1)} TN</TableCell>
                  <TableCell className="text-[#475569]">{c.tipo_camion ?? "—"}</TableCell>
                  <TableCell>
                    <StatusBadge
                      label={c.estado}
                      tone={
                        c.estado === "operativo"
                          ? "success"
                          : c.estado === "mantenimiento"
                            ? "warning"
                            : "neutral"
                      }
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
