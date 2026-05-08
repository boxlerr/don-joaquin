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
import { Briefcase, Plus, Download } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function ClientesPage() {
  const supabase = createAdminClient();

  const [{ data: clientes, count: total }, activos, multinacionales] = await Promise.all([
    supabase.from("clientes").select("*", { count: "exact" }).order("razon_social"),
    supabase
      .from("clientes")
      .select("*", { count: "exact", head: true })
      .eq("estado", "activo"),
    supabase
      .from("clientes")
      .select("*", { count: "exact", head: true })
      .eq("es_multinacional", true),
  ]);

  return (
    <div className="p-8">
      <PageHeader
        title="Clientes"
        description="Cartera de clientes y cuentas corrientes"
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Download size={14} />
              Exportar CC
            </Button>
            <Button variant="brand" size="sm">
              <Plus size={14} />
              Nuevo cliente
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Total clientes" value={String(total ?? 0)} color="brand" />
        <StatCard label="Activos" value={String(activos.count ?? 0)} color="success" />
        <StatCard
          label="Multinacionales"
          value={String(multinacionales.count ?? 0)}
          sub="Loma Negra, YPF, etc."
          color="warning"
        />
        <StatCard label="Con saldo deudor" value="—" sub="Pendiente CC" color="error" />
      </div>

      <div className="bg-white rounded-[8px] border border-[#E2E8F0] shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-2">
            <Briefcase size={16} className="text-[#0088D1]" />
            <h2 className="text-[#0F172A] text-sm font-semibold">Listado de Clientes</h2>
          </div>
          <Input
            type="search"
            placeholder="Buscar por razón social, CUIT..."
            className="w-80 text-sm"
          />
        </div>
        <Table>
          <TableHeader className="bg-[#F8FAFC]">
            <TableRow>
              {[
                "Razón social",
                "Nombre comercial",
                "CUIT",
                "Localidad",
                "Provincia",
                "Cond. IVA",
                "Multinacional",
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
            {!clientes || clientes.length === 0 ? (
              <EmptyTableRow message="Sin clientes registrados" />
            ) : (
              clientes.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.razon_social}</TableCell>
                  <TableCell className="text-[#475569]">{c.nombre_comercial ?? "—"}</TableCell>
                  <TableCell className="font-mono">{c.cuit ?? "—"}</TableCell>
                  <TableCell>{c.localidad ?? "—"}</TableCell>
                  <TableCell>{c.provincia ?? "—"}</TableCell>
                  <TableCell className="text-[#475569]">{c.condicion_iva}</TableCell>
                  <TableCell>{c.es_multinacional ? "Sí" : "—"}</TableCell>
                  <TableCell>
                    <StatusBadge
                      label={c.estado}
                      tone={c.estado === "activo" ? "success" : "neutral"}
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
