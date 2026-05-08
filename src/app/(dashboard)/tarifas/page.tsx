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
import { DollarSign, Plus, Upload } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function TarifasPage() {
  const supabase = createAdminClient();

  const [{ count: total }, vigentes, fijas, porTonelaje] = await Promise.all([
    supabase.from("tarifas").select("*", { count: "exact", head: true }),
    supabase
      .from("tarifas")
      .select("*", { count: "exact", head: true })
      .eq("activa", true),
    supabase
      .from("tarifas")
      .select("*", { count: "exact", head: true })
      .eq("modalidad", "fija"),
    supabase
      .from("tarifas")
      .select("*", { count: "exact", head: true })
      .in("modalidad", ["por_kilo", "por_tonelada"]),
  ]);

  return (
    <div className="p-8">
      <PageHeader
        title="Tarifas y Fletes"
        description="Modalidades fija, por kilos y por toneladas — historial preservado"
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Upload size={14} />
              Importar Excel
            </Button>
            <Button variant="brand" size="sm">
              <Plus size={14} />
              Nueva tarifa
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Total tarifas" value={String(total ?? 0)} color="brand" />
        <StatCard label="Vigentes" value={String(vigentes.count ?? 0)} color="success" />
        <StatCard label="Modalidad fija" value={String(fijas.count ?? 0)} color="info" />
        <StatCard
          label="Por kilo / TN"
          value={String(porTonelaje.count ?? 0)}
          color="warning"
        />
      </div>

      <div className="bg-white rounded-[8px] border border-[#E2E8F0] shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-2">
            <DollarSign size={16} className="text-[#0088D1]" />
            <h2 className="text-[#0F172A] text-sm font-semibold">Tabla de Tarifas</h2>
          </div>
          <div className="flex items-center gap-2">
            <select className="h-9 px-3 text-sm border border-[#E2E8F0] rounded-md bg-white text-[#475569]">
              <option>Todas las modalidades</option>
              <option>Fija</option>
              <option>Por kilo</option>
              <option>Por tonelada</option>
            </select>
            <Input type="search" placeholder="Buscar tarifa..." className="w-56 text-sm" />
          </div>
        </div>
        <Table>
          <TableHeader className="bg-[#F8FAFC]">
            <TableRow>
              {[
                "Cliente",
                "Ruta",
                "Modalidad",
                "Valor",
                "Moneda",
                "Vigencia desde",
                "Vigencia hasta",
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
            <EmptyTableRow message="Sin tarifas registradas" />
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
