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
import { FileText, Plus, Download } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";

const TABS = [
  { label: "Todos" },
  { label: "En cartera" },
  { label: "Entregados" },
  { label: "Depositados" },
  { label: "Acreditados" },
  { label: "Rechazados" },
  { label: "Anulados" },
];

export default async function ChequesPage() {
  const supabase = createAdminClient();

  const [{ data: bancos }, { count: totalCheques }] = await Promise.all([
    supabase.from("bancos").select("id, nombre").eq("estado", "activo").order("nombre"),
    supabase.from("cheques").select("*", { count: "exact", head: true }),
  ]);

  return (
    <div className="p-8">
      <PageHeader
        title="Gestión de Cheques"
        description="Cartera completa con trazabilidad por estado"
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Download size={14} />
              Exportar
            </Button>
            <Button variant="brand" size="sm">
              <Plus size={14} />
              Registrar cheque
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="En cartera" value="—" sub="Valor acumulado" color="brand" />
        <StatCard label="Por vencer" value="—" sub="Próximos 7 días" color="warning" />
        <StatCard label="Vencidos" value="—" color="error" />
        <StatCard label="Total registrados" value={String(totalCheques ?? 0)} color="success" />
      </div>

      <div className="bg-white rounded-[8px] border border-[#E2E8F0] shadow-sm">
        <div className="flex items-center gap-1 px-5 pt-4 border-b border-[#E2E8F0] overflow-x-auto">
          {TABS.map((tab, i) => (
            <button
              key={tab.label}
              type="button"
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                i === 0
                  ? "border-[#0088D1] text-[#0088D1]"
                  : "border-transparent text-[#475569] hover:text-[#0F172A]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-b border-[#E2E8F0] bg-[#F8FAFC]">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-[#0088D1]" />
            <h2 className="text-[#0F172A] text-sm font-semibold">Listado de Cheques</h2>
          </div>
          <div className="flex items-center gap-2">
            <select className="h-9 px-3 text-sm border border-[#E2E8F0] rounded-md bg-white text-[#475569]">
              <option value="">Todos los bancos ({bancos?.length ?? 0})</option>
              {bancos?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nombre}
                </option>
              ))}
            </select>
            <Input type="search" placeholder="N° de cheque o librador..." className="w-64 text-sm" />
          </div>
        </div>

        <Table>
          <TableHeader className="bg-[#F8FAFC]">
            <TableRow>
              {[
                "Número",
                "Banco",
                "Librador",
                "Importe",
                "Fecha emisión",
                "Fecha cobro",
                "Cliente / Concepto",
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
            <EmptyTableRow message="Sin cheques registrados" />
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
