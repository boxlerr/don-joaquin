import PageHeader from "@/components/layout/PageHeader";
import StatCard from "@/components/ui/StatCard";
import { EmptyState, EmptyTableRow } from "@/components/ui/EmptyState";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
} from "@/components/ui/table";
import { MapPin, DollarSign } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="p-8">
      <PageHeader
        title="Dashboard"
        description="Resumen general de operaciones"
      />

      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="Viajes activos" value="—" sub="En curso hoy" color="brand" />
        <StatCard label="Camiones operativos" value="—" sub="Del total de flota" color="success" />
        <StatCard label="Choferes disponibles" value="—" sub="Sin asignación activa" color="warning" />
        <StatCard label="Ingresos del mes" value="—" sub="Pendiente de datos" color="brand" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 bg-white rounded-[8px] border border-[#E2E8F0] shadow-sm">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-[#E2E8F0]">
            <MapPin size={16} className="text-[#0088D1]" />
            <h2 className="text-[#0F172A] text-sm font-semibold">Últimos Viajes</h2>
          </div>
          <div className="p-5">
            <Table>
              <TableHeader className="bg-[#F8FAFC]">
                <TableRow>
                  {["ID", "Origen", "Destino", "Chofer", "Estado"].map((col) => (
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

        <div className="bg-white rounded-[8px] border border-[#E2E8F0] shadow-sm">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-[#E2E8F0]">
            <DollarSign size={16} className="text-[#0088D1]" />
            <h2 className="text-[#0F172A] text-sm font-semibold">Actividad Reciente</h2>
          </div>
          <EmptyState message="Sin actividad registrada" />
        </div>
      </div>
    </div>
  );
}
