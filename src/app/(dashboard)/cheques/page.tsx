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
import { FileText, Plus } from "lucide-react";

export default function ChequesPage() {
  return (
    <div className="p-8">
      <PageHeader
        title="Cheques"
        description="Gestión y seguimiento de cheques recibidos y emitidos"
        action={
          <Button variant="brand" size="default" className="gap-2 px-4 py-2.5 h-auto">
            <Plus size={16} />
            Registrar cheque
          </Button>
        }
      />

      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="En cartera" value="—" color="brand" />
        <StatCard label="Al cobro" value="—" color="success" />
        <StatCard label="Vencidos" value="—" color="error" />
        <StatCard label="Total en cartera" value="—" sub="Valor acumulado" color="warning" />
      </div>

      <div className="bg-white rounded-[8px] border border-[#E2E8F0] shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-[#0088D1]" />
            <h2 className="text-[#0F172A] text-sm font-semibold">Listado de Cheques</h2>
          </div>
          <Input type="search" placeholder="Buscar cheque..." className="w-56 text-sm" />
        </div>
        <Table>
          <TableHeader className="bg-[#F8FAFC]">
            <TableRow>
              {["Número", "Banco", "Emisor", "Fecha emisión", "Fecha cobro", "Monto", "Estado", "Acciones"].map((col) => (
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
