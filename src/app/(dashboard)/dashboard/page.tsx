import PageHeader from "@/components/layout/PageHeader";
import StatCard from "@/components/ui/StatCard";
import { EmptyTableRow } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
} from "@/components/ui/table";
import {
  MapPin,
  AlertTriangle,
  Plus,
  Wallet,
  Receipt,
  FileText,
  ShieldAlert,
  Clock,
  Truck,
  Users,
  Briefcase,
} from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";

async function countTable(name: Parameters<ReturnType<typeof createAdminClient>["from"]>[0]) {
  const supabase = createAdminClient();
  const { count } = await supabase.from(name).select("*", { count: "exact", head: true });
  return count ?? 0;
}

export default async function DashboardPage() {
  const supabase = createAdminClient();

  const [
    viajesActivos,
    viajesSinFacturar,
    saldoMovimientos,
    viaticosPendientes,
    chequesPorVencer,
    docPorVencer,
    clientesConSaldo,
    totalCamiones,
    totalChoferes,
    totalClientes,
  ] = await Promise.all([
    supabase
      .from("viajes")
      .select("*", { count: "exact", head: true })
      .in("estado", ["pendiente", "en_curso"]),
    supabase
      .from("viajes")
      .select("*", { count: "exact", head: true })
      .eq("facturado", false),
    supabase.from("caja_movimientos").select("*", { count: "exact", head: true }),
    supabase.from("viaticos").select("*", { count: "exact", head: true }),
    supabase.from("cheques").select("*", { count: "exact", head: true }),
    supabase.from("alertas").select("*", { count: "exact", head: true }),
    supabase.from("clientes").select("*", { count: "exact", head: true }),
    countTable("camiones"),
    countTable("choferes"),
    countTable("clientes"),
  ]);

  return (
    <div className="p-8">
      <PageHeader
        title="Dashboard"
        description="Resumen operativo y financiero del día"
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Receipt size={14} />
              Registrar gasto
            </Button>
            <Button variant="outline" size="sm">
              <Wallet size={14} />
              Registrar viático
            </Button>
            <Button variant="brand" size="sm">
              <Plus size={14} />
              Nuevo viaje
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Viajes activos"
          value={String(viajesActivos.count ?? 0)}
          sub="Pendientes y en curso"
          color="brand"
        />
        <StatCard
          label="Movimientos de caja"
          value={String(saldoMovimientos.count ?? 0)}
          sub="Total registrados"
          color="success"
        />
        <StatCard
          label="Viáticos"
          value={String(viaticosPendientes.count ?? 0)}
          sub="Total registrados"
          color="warning"
        />
        <StatCard
          label="Cheques en cartera"
          value={String(chequesPorVencer.count ?? 0)}
          sub="Total registrados"
          color="error"
        />
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="col-span-2 bg-white rounded-[8px] border border-[#E2E8F0] shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-[#0088D1]" />
              <h2 className="text-[#0F172A] text-sm font-semibold">Últimos viajes</h2>
            </div>
            <a href="/viajes" className="text-xs font-medium text-[#0088D1] hover:underline">
              Ver todos →
            </a>
          </div>
          <Table>
            <TableHeader className="bg-[#F8FAFC]">
              <TableRow>
                {["Fecha", "Origen → Destino", "Cliente", "Chofer", "Estado", "Facturación"].map(
                  (col) => (
                    <TableHead
                      key={col}
                      className="text-xs font-semibold text-[#475569] uppercase tracking-wide"
                    >
                      {col}
                    </TableHead>
                  ),
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              <EmptyTableRow message="Sin viajes registrados" />
            </TableBody>
          </Table>
        </div>

        <div className="bg-white rounded-[8px] border border-[#E2E8F0] shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-[#F59E0B]" />
              <h2 className="text-[#0F172A] text-sm font-semibold">Alertas activas</h2>
            </div>
            <span className="text-2xl font-bold text-[#0F172A]">{docPorVencer.count ?? 0}</span>
          </div>
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-[#94A3B8] text-sm">Sin alertas críticas activas</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <SummaryCard
          icon={Truck}
          title="Flota de camiones"
          metric={String(totalCamiones)}
          metricLabel="unidades"
          description="Registradas en el sistema"
        />
        <SummaryCard
          icon={Users}
          title="Choferes"
          metric={String(totalChoferes)}
          metricLabel="legajos"
          description="Sin acceso al sistema"
        />
        <SummaryCard
          icon={Briefcase}
          title="Clientes"
          metric={String(totalClientes)}
          metricLabel="activos"
          description={`${clientesConSaldo.count ?? 0} con cuenta corriente abierta`}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 mt-4">
        <SummaryCard
          icon={ShieldAlert}
          title="Documentación crítica"
          description="Camiones y choferes con documentación próxima a vencer"
          metric="—"
          metricLabel="próximas a vencer"
        />
        <SummaryCard
          icon={Clock}
          title="Viajes sin facturar"
          description="Viajes finalizados pendientes de carga de factura"
          metric={String(viajesSinFacturar.count ?? 0)}
          metricLabel="pendientes"
        />
      </div>
    </div>
  );
}

interface SummaryCardProps {
  icon: typeof FileText;
  title: string;
  description: string;
  metric: string;
  metricLabel: string;
}

function SummaryCard({ icon: Icon, title, description, metric, metricLabel }: SummaryCardProps) {
  return (
    <div className="bg-white rounded-[8px] border border-[#E2E8F0] shadow-sm p-5">
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#E1F5FE] shrink-0">
          <Icon size={18} className="text-[#0088D1]" />
        </div>
        <div className="flex-1">
          <p className="text-[#0F172A] text-sm font-semibold">{title}</p>
          <p className="text-[#475569] text-xs mt-0.5">{description}</p>
          <p className="mt-3 text-2xl font-bold text-[#0F172A]">
            {metric}
            <span className="ml-2 text-xs font-medium text-[#94A3B8]">{metricLabel}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
