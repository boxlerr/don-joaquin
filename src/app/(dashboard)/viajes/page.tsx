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
import { MapPin, Plus } from "lucide-react";

export default function ViajesPage() {
  return (
    <div className="p-8">
      <PageHeader
        title="Viajes"
        description="Gestión y trazabilidad de viajes"
        action={
          <Button variant="brand" size="default" className="gap-2 px-4 py-2.5 h-auto">
            <Plus size={16} />
            Nuevo viaje
          </Button>
        }
      />

      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Total viajes" value="—" color="brand" />
        <StatCard label="En curso" value="—" color="success" />
        <StatCard label="Pendientes" value="—" color="warning" />
        <StatCard label="Finalizados" value="—" color="brand" />
      </div>

      <div className="bg-white rounded-[8px] border border-[#E2E8F0] shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-[#0088D1]" />
            <h2 className="text-[#0F172A] text-sm font-semibold">Listado de Viajes</h2>
          </div>
          <Input type="search" placeholder="Buscar viaje..." className="w-56 text-sm" />
        </div>
        <Table>
          <TableHeader className="bg-[#F8FAFC]">
            <TableRow>
              {["ID", "Fecha", "Origen", "Destino", "Chofer", "Camión", "KM", "Estado"].map((col) => (
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
