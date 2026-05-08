import PageHeader from "@/components/layout/PageHeader";
import StatCard from "@/components/ui/StatCard";
import StatusBadge from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Bell,
  ShieldAlert,
  FileText,
  MapPin,
  Settings,
  Mail,
  MessageCircle,
} from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function NotificacionesPage() {
  const supabase = createAdminClient();

  const [
    activas,
    criticas,
    enviadas,
    docCount,
    chequeCount,
    viajeCount,
    sistemaCount,
    { data: tiposDoc },
  ] = await Promise.all([
    supabase
      .from("alertas")
      .select("*", { count: "exact", head: true })
      .eq("estado", "pendiente"),
    supabase
      .from("alertas")
      .select("*", { count: "exact", head: true })
      .eq("severidad", "critica"),
    supabase
      .from("notificaciones")
      .select("*", { count: "exact", head: true })
      .eq("estado", "enviada"),
    supabase
      .from("alertas")
      .select("*", { count: "exact", head: true })
      .in("tipo", ["vencimiento_doc_camion", "vencimiento_doc_chofer"]),
    supabase
      .from("alertas")
      .select("*", { count: "exact", head: true })
      .in("tipo", ["vencimiento_cheque", "cheque_rechazado_recordatorio"]),
    supabase.from("alertas").select("*", { count: "exact", head: true }).eq("tipo", "viaje_sin_cerrar"),
    supabase.from("alertas").select("*", { count: "exact", head: true }).eq("tipo", "otro"),
    supabase
      .from("tipos_documento")
      .select("nombre, aplica_a, dias_alerta_vencimiento, obligatorio")
      .eq("estado", "activo")
      .order("aplica_a")
      .order("nombre"),
  ]);

  const categorias = [
    {
      icon: ShieldAlert,
      label: "Documentación",
      description: "Vencimientos de VTV, seguro, licencias, RUTA/LINTI",
      count: docCount.count ?? 0,
    },
    {
      icon: FileText,
      label: "Cheques",
      description: "Próximos a vencer, vencidos o rechazados",
      count: chequeCount.count ?? 0,
    },
    {
      icon: MapPin,
      label: "Viajes y viáticos",
      description: "Viajes pendientes de cierre, viáticos sin rendir",
      count: viajeCount.count ?? 0,
    },
    {
      icon: Settings,
      label: "Sistema",
      description: "Backups, sesiones y eventos administrativos",
      count: sistemaCount.count ?? 0,
    },
  ];

  return (
    <div className="p-8">
      <PageHeader
        title="Notificaciones"
        description="Alertas administrativas — entrega por email (Resend) y WhatsApp"
        action={
          <Button variant="outline" size="sm">
            Marcar todas como leídas
          </Button>
        }
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard
          label="Activas"
          value={String(activas.count ?? 0)}
          sub="Pendientes de revisar"
          color="warning"
        />
        <StatCard
          label="Críticas"
          value={String(criticas.count ?? 0)}
          sub="Requieren acción inmediata"
          color="error"
        />
        <StatCard
          label="Notificaciones enviadas"
          value={String(enviadas.count ?? 0)}
          sub="Email + WhatsApp"
          color="success"
        />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        {categorias.map(({ icon: Icon, label, description, count }) => (
          <div
            key={label}
            className="bg-white rounded-[8px] border border-[#E2E8F0] shadow-sm p-5"
          >
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#E1F5FE] shrink-0">
                <Icon size={20} className="text-[#0088D1]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[#0F172A] text-sm font-semibold">{label}</p>
                <p className="text-[#475569] text-xs mt-0.5">{description}</p>
              </div>
              <span className="text-2xl font-bold text-[#0088D1]">{count}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Tipos de documento configurados con sus días de alerta */}
      <div className="bg-white rounded-[8px] border border-[#E2E8F0] shadow-sm mb-6">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-2">
            <ShieldAlert size={16} className="text-[#0088D1]" />
            <h2 className="text-[#0F172A] text-sm font-semibold">
              Tipos de documento monitoreados
            </h2>
          </div>
          <span className="text-xs text-[#94A3B8]">
            {tiposDoc?.length ?? 0} tipos activos
          </span>
        </div>
        <div className="p-5 grid grid-cols-2 gap-3">
          {tiposDoc?.map((t) => (
            <div
              key={`${t.aplica_a}-${t.nombre}`}
              className="flex items-center gap-3 p-3 rounded-lg border border-[#E2E8F0]"
            >
              <StatusBadge
                label={t.aplica_a}
                tone={t.aplica_a === "camion" ? "info" : "warning"}
              />
              <div className="flex-1 min-w-0">
                <p className="text-[#0F172A] text-sm font-medium truncate">{t.nombre}</p>
                <p className="text-[#475569] text-xs">
                  Alerta a los {t.dias_alerta_vencimiento} días{" "}
                  {t.obligatorio && (
                    <span className="ml-1 text-[#EF4444]">· Obligatorio</span>
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-[8px] border border-[#E2E8F0] shadow-sm">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-[#E2E8F0]">
          <Bell size={16} className="text-[#0088D1]" />
          <h2 className="text-[#0F172A] text-sm font-semibold">Centro de notificaciones</h2>
        </div>

        <div className="flex flex-col items-center justify-center py-16">
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-[#E1F5FE] mb-4">
            <Bell size={24} className="text-[#0088D1]" />
          </div>
          <p className="text-[#0F172A] text-sm font-medium mb-1">Sin notificaciones</p>
          <p className="text-[#94A3B8] text-sm">No hay alertas ni avisos pendientes</p>

          <div className="flex items-center gap-2 mt-6 text-xs text-[#94A3B8]">
            <Mail size={14} />
            Email
            <span className="mx-2">·</span>
            <MessageCircle size={14} />
            WhatsApp
          </div>
        </div>
      </div>
    </div>
  );
}
