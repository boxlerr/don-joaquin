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
import { Wallet, Plus } from "lucide-react";

export default function CajaPage() {
  return (
    <div className="p-8">
      <PageHeader
        title="Caja"
        description="Control de movimientos de caja y efectivo"
        action={
          <Button variant="brand" size="default" className="gap-2 px-4 py-2.5 h-auto">
            <Plus size={16} />
            Nuevo movimiento
          </Button>
        }
      />

      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Saldo actual" value="—" color="brand" />
        <StatCard label="Ingresos del mes" value="—" color="success" />
        <StatCard label="Egresos del mes" value="—" color="error" />
        <StatCard label="Movimientos hoy" value="—" color="warning" />
      </div>

      <div className="bg-white rounded-[8px] border border-[#E2E8F0] shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-2">
            <Wallet size={16} className="text-[#0088D1]" />
            <h2 className="text-[#0F172A] text-sm font-semibold">Movimientos de Caja</h2>
          </div>
          <div className="flex items-center gap-2">
            <Input type="date" className="text-sm w-auto" />
            <Input type="search" placeholder="Buscar..." className="w-44 text-sm" />
          </div>
        </div>
        <Table>
          <TableHeader className="bg-[#F8FAFC]">
            <TableRow>
              {["Fecha", "Descripción", "Tipo", "Referencia", "Monto", "Saldo acum.", "Usuario"].map((col) => (
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
            <EmptyTableRow message="Sin movimientos registrados" />
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
