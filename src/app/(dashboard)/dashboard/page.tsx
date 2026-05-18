import PageHeader from "@/components/layout/PageHeader";
import StatCard from "@/components/ui/StatCard";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  AlertTriangle,
  Plus,
  Wallet,
  Receipt,
  FileText,
  Briefcase,
  Route,
  ShieldAlert,
  Clock,
  Truck,
  Users,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getViajesAction } from "@/app/(dashboard)/viajes/actions";
import RecentViajesTable from "./components/RecentViajesTable";

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
    viajesResult,
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
    supabase.from("alertas").select("*", { count: "exact", head: true }).eq("estado", "pendiente"),
    supabase.from("clientes").select("*", { count: "exact", head: true }),
    supabase.from("camiones").select("*", { count: "exact", head: true }),
    supabase.from("choferes").select("*", { count: "exact", head: true }),
    supabase.from("clientes").select("*", { count: "exact", head: true }),
    getViajesAction({ pageSize: 5 }),
  ]);

  const alertCount = docPorVencer.count ?? 0;
  const ultimosViajes = (viajesResult && "data" in viajesResult) ? viajesResult.data : [];

  return (
    <div className="p-8 space-y-6 w-full">
      <PageHeader
        title="Dashboard"
        description="Resumen operativo y financiero del día"
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="border-slate-200 hover:bg-slate-50 hover:text-[#0088D1] transition-colors">
              <Receipt size={14} className="text-[#0088D1]" />
              Registrar gasto
            </Button>
            <Button variant="outline" size="sm" className="border-slate-200 hover:bg-slate-50 hover:text-[#0088D1] transition-colors">
              <Wallet size={14} className="text-[#0088D1]" />
              Registrar viático
            </Button>
            <Button variant="brand" size="sm" className="bg-gradient-to-r from-[#0088D1] to-[#004A99] hover:from-[#004A99] hover:to-[#003C80] shadow-sm transition-all duration-300 font-semibold text-white">
              <Plus size={14} />
              Nuevo viaje
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Viajes activos"
          value={String(viajesActivos.count ?? 0)}
          sub="Pendientes y en curso"
          color="brand"
          icon={Briefcase}
          variant="dashboard"
        />
        <StatCard
          label="Movimientos de caja"
          value={String(saldoMovimientos.count ?? 0)}
          sub="Total registrados"
          color="success"
          icon={Receipt}
          variant="dashboard"
        />
        <StatCard
          label="Viáticos"
          value={String(viaticosPendientes.count ?? 0)}
          sub="Total registrados"
          color="warning"
          icon={Route}
          variant="dashboard"
        />
        <StatCard
          label="Cheques en cartera"
          value={String(chequesPorVencer.count ?? 0)}
          sub="Total registrados"
          color="error"
          icon={FileText}
          variant="dashboard"
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 bg-white rounded-[8px] border border-[#E2E8F0] shadow-sm flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-[#0088D1]" />
              <h2 className="text-[#0F172A] text-sm font-bold">Últimos viajes</h2>
            </div>
            <a href="/viajes" className="text-xs font-semibold text-[#0088D1] hover:text-[#004A99] hover:underline transition-colors">
              Ver todos →
            </a>
          </div>
          <div className="flex-1 bg-gradient-to-b from-white to-slate-50/10">
            <RecentViajesTable initialViajes={ultimosViajes} />
          </div>
        </div>

        <div className="bg-white rounded-[8px] border border-[#E2E8F0] shadow-sm flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-[#F59E0B]" />
              <h2 className="text-[#0F172A] text-sm font-bold">Alertas activas</h2>
            </div>
            <span className={`text-2xl font-black ${alertCount > 0 ? "text-[#D97706]" : "text-slate-800"}`}>
              {alertCount}
            </span>
          </div>
          <div className="p-5 flex-1 flex items-center justify-center bg-gradient-to-b from-white to-slate-50/10">
            {alertCount > 0 ? (
              // Active Alerts Warning Card (Amber Theme)
              <div className="w-full bg-gradient-to-br from-[#FFFBEB] to-[#FFFDF5] rounded-[8px] p-4.5 border border-[#FDE68A]/60 shadow-[0_2px_8px_rgba(245,158,11,0.02)] flex flex-col justify-between relative overflow-hidden h-full">
                <div className="flex items-start gap-3 z-10">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#F59E0B] shrink-0 mt-1 animate-ping absolute" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#F59E0B] shrink-0 mt-1 z-10" />
                  <div className="flex flex-col">
                    <p className="text-[#92400E] text-[10px] font-extrabold uppercase tracking-wider">Documentación Crítica</p>
                    <p className="text-[#B45309] text-sm font-bold mt-0.5 leading-snug">Se requiere atención</p>
                    <p className="text-[#B45309]/80 text-[11px] font-semibold mt-1 leading-relaxed">
                      Hay {alertCount} legajo de documentación próximo a vencer. Revise el módulo de conductores o camiones.
                    </p>
                  </div>
                </div>
                
                <div className="mt-3 pt-3 border-t border-[#FDE68A]/40 flex items-center justify-between z-10">
                  <a href="/choferes" className="text-xs font-bold text-[#D97706] hover:text-[#92400E] flex items-center gap-1 transition-colors">
                    Resolver alerta
                    <ChevronRight size={14} />
                  </a>
                  <span className="bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    Vencimiento
                  </span>
                </div>

                <svg className="w-16 h-16 text-[#F59E0B]/10 shrink-0 z-0 absolute right-1 bottom-1 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={1.2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
            ) : (
              // Pristine Safe Card (Green Theme)
              <div className="w-full bg-gradient-to-br from-[#ECFDF5] to-[#F0FDF4] rounded-[8px] p-4.5 border border-[#A7F3D0]/60 shadow-[0_2px_8px_rgba(16,185,129,0.02)] flex flex-col justify-between relative overflow-hidden h-full">
                <div className="flex items-start gap-3 z-10">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#10B981] shrink-0 mt-1 animate-ping absolute" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#10B981] shrink-0 mt-1 z-10" />
                  <div className="flex flex-col">
                    <p className="text-[#064E3B] text-[10px] font-extrabold uppercase tracking-wider">Flota al día</p>
                    <p className="text-[#047857] text-sm font-bold mt-0.5 leading-snug">Sin alertas activas</p>
                    <p className="text-[#047857]/80 text-[11px] font-semibold mt-1 leading-relaxed">
                      Todo bajo control. La documentación y permisos de camiones y choferes se encuentran validados.
                    </p>
                  </div>
                </div>
                
                <div className="mt-3 pt-3 border-t border-[#A7F3D0]/40 flex items-center justify-between z-10">
                  <span className="text-xs font-bold text-[#059669] flex items-center gap-1">
                    Sistemas seguros
                  </span>
                  <CheckCircle2 size={16} className="text-[#10B981]" />
                </div>

                <svg className="w-16 h-16 text-[#10B981]/8 shrink-0 z-0 absolute right-1 bottom-1 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={1.2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <SummaryCard
          icon={Truck}
          title="Flota de camiones"
          metric={String(totalCamiones.count ?? 0)}
          metricLabel="unidades"
          description="Registradas en el sistema"
          href="/camiones"
          type="truck"
        />
        <SummaryCard
          icon={Users}
          title="Choferes"
          metric={String(totalChoferes.count ?? 0)}
          metricLabel="legajos"
          description="Sin acceso al sistema"
          href="/choferes"
          iconColor="text-[#7C3AED]"
          iconBg="bg-[#F3E8FF]"
          type="users"
        />
        <SummaryCard
          icon={Briefcase}
          title="Clientes"
          metric={String(totalClientes.count ?? 0)}
          metricLabel="activos"
          description={`${clientesConSaldo.count ?? 0} con cuenta corriente abierta`}
          href="/clientes"
          iconColor="text-[#059669]"
          iconBg="bg-[#ECFDF5]"
          type="building"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <SummaryCard
          icon={ShieldAlert}
          title="Documentación crítica"
          description="Camiones y choferes con documentación próxima a vencer"
          metric="—"
          metricLabel="próximas a vencer"
          href="/choferes"
          iconColor="text-[#E11D48]"
          iconBg="bg-[#FFF1F2]"
          type="clipboard"
        />
        <SummaryCard
          icon={Clock}
          title="Viajes sin facturar"
          description="Viajes finalizados pendientes de carga de factura"
          metric={String(viajesSinFacturar.count ?? 0)}
          metricLabel="pendiente"
          href="/viajes"
          iconColor="text-[#D97706]"
          iconBg="bg-[#FEF3C7]"
          type="invoice"
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
  href?: string;
  iconColor?: string;
  iconBg?: string;
  type: "truck" | "users" | "building" | "clipboard" | "invoice";
}

function SummaryCard({
  icon: Icon,
  title,
  description,
  metric,
  metricLabel,
  href,
  iconColor = "text-[#0088D1]",
  iconBg = "bg-[#E1F5FE]",
  type,
}: SummaryCardProps) {
  const CardWrapper = href ? "a" : "div";

  return (
    <CardWrapper
      href={href}
      className={`relative overflow-hidden bg-white rounded-[8px] border border-[#E2E8F0] shadow-sm p-5 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 group block ${
        href ? "cursor-pointer" : ""
      }`}
    >
      <div className="flex items-start gap-4">
        <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${iconBg} shrink-0 transition-transform duration-300 group-hover:scale-105 shadow-sm`}>
          <Icon size={20} className={iconColor} />
        </div>
        <div className="flex-1 min-w-0 z-10">
          <div className="flex items-center justify-between">
            <span className="text-[#0F172A] text-sm font-bold group-hover:text-[#0088D1] transition-colors duration-300">
              {title}
            </span>
            <ChevronRight size={16} className="text-[#94A3B8] opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:text-[#0088D1] transition-all duration-300" />
          </div>
          <p className="text-slate-500 text-xs mt-0.5 leading-relaxed">
            {description}
          </p>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-800 tracking-tight leading-none">
              {metric}
            </span>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
              {metricLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Silhouette SVGs with responsive themes & optimized opacities */}
      {type === "truck" && (
        <svg className="absolute -right-2 -bottom-4 w-18 h-18 text-sky-400 opacity-[0.14] pointer-events-none transition-transform duration-500 group-hover:scale-105 z-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 8h-2.5V5.5c0-.83-.67-1.5-1.5-1.5H3c-.83 0-1.5.67-1.5 1.5v10c0 .83.67 1.5 1.5 1.5h1.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5h5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5H21c.83 0 1.5-.67 1.5-1.5v-5c0-.83-.67-1.5-1.5-1.5h-.5zm-12 9.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm10 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
        </svg>
      )}
      {type === "users" && (
        <svg className="absolute -right-2 -bottom-4 w-18 h-18 text-purple-400 opacity-[0.14] pointer-events-none transition-transform duration-500 group-hover:scale-105 z-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
        </svg>
      )}
      {type === "building" && (
        <svg className="absolute -right-2 -bottom-4 w-18 h-18 text-emerald-400 opacity-[0.14] pointer-events-none transition-transform duration-500 group-hover:scale-105 z-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v-2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z" />
        </svg>
      )}
      {type === "clipboard" && (
        <svg className="absolute -right-2 -bottom-4 w-18 h-18 text-rose-400 opacity-[0.14] pointer-events-none transition-transform duration-500 group-hover:scale-105 z-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
        </svg>
      )}
      {type === "invoice" && (
        <svg className="absolute -right-2 -bottom-4 w-18 h-18 text-amber-400 opacity-[0.14] pointer-events-none transition-transform duration-500 group-hover:scale-105 z-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
        </svg>
      )}
    </CardWrapper>
  );
}



