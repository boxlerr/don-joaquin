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
import { Users, Plus } from "lucide-react";

export default function ChoferesPage() {
  return (
    <div className="p-8">
      <PageHeader
        title="Choferes"
        description="Gestión del personal de conducción"
        action={
          <Button variant="brand" size="default" className="gap-2 px-4 py-2.5 h-auto">
            <Plus size={16} />
            Agregar chofer
          </Button>
        }
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Total choferes" value="—" color="brand" />
        <StatCard label="Disponibles" value="—" color="success" />
        <StatCard label="En viaje" value="—" color="warning" />
      </div>

      <div className="bg-white rounded-[8px] border border-[#E2E8F0] shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-[#0088D1]" />
            <h2 className="text-[#0F172A] text-sm font-semibold">Listado de Choferes</h2>
          </div>
          <Input type="search" placeholder="Buscar chofer..." className="w-56 text-sm" />
        </div>
        <Table>
          <TableHeader className="bg-[#F8FAFC]">
            <TableRow>
              {["Nombre", "DNI", "Licencia", "Vencimiento licencia", "Teléfono", "Estado", "Acciones"].map((col) => (
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
            <EmptyTableRow message="Sin choferes registrados" />
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
