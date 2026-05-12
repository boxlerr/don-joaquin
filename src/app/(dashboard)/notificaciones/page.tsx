import PageHeader from "@/components/layout/PageHeader";
import StatCard from "@/components/ui/StatCard";
import StatusBadge from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/button";
import { Bell, ShieldAlert, FileText, MapPin, Settings, RefreshCw } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { marcarTodasVistas, actualizarAlertas } from "./actions";

export default async function NotificacionesPage() {
  const supabase = createAdminClient();

  const [
    { count: totalPendientes },
    { count: totalCriticas },
    { data: alertas },
    { count: docCount },
    { count: chequeCount },
    { count: viajeCount },
    { count: sistemaCount },
    { data: tiposDoc },
  ] = await Promise.all([
    supabase.from("alertas").select("*", { count: "exact", head: true }).eq("estado", "pendiente"),
    supabase.from("alertas").select("*", { count: "exact", head: true }).eq("estado", "pendiente").eq("severidad", "critica"),
    supabase
      .from("alertas")
      .select("id, tipo, severidad, titulo, mensaje, fecha_disparo, fecha_vencimiento, entidad_tipo")
      .eq("estado", "pendiente")
      .order("severidad", { ascending: false })
      .order("fecha_disparo", { ascending: false })
      .limit(50),
    supabase.from("alertas").select("*", { count: "exact", head: true }).eq("estado", "pendiente").in("tipo", ["vencimiento_doc_camion", "vencimiento_doc_chofer"]),
    supabase.from("alertas").select("*", { count: "exact", head: true }).eq("estado", "pendiente").in("tipo", ["vencimiento_cheque", "cheque_rechazado_recordatorio"]),
    supabase.from("alertas").select("*", { count: "exact", head: true }).eq("estado", "pendiente").eq("tipo", "viaje_sin_cerrar"),
    supabase.from("alertas").select("*", { count: "exact", head: true }).eq("estado", "pendiente").eq("tipo", "otro"),
    supabase.from("tipos_documento").select("nombre, aplica_a, dias_alerta_vencimiento, obligatorio").eq("estado", "activo").order("aplica_a").order("nombre"),
  ]);

  const categorias = [
    { icon: ShieldAlert, label: "Documentación", description: "Vencimientos de VTV, seguro, licencias, RUTA/LINTI", count: docCount ?? 0 },
    { icon: FileText, label: "Cheques", description: "Próximos a vencer, vencidos o rechazados", count: chequeCount ?? 0 },
    { icon: MapPin, label: "Viajes y viáticos", description: "Viajes pendientes de cierre, viáticos sin rendir", count: viajeCount ?? 0 },
    { icon: Settings, label: "Sistema", description: "Backups, sesiones y eventos administrativos", count: sistemaCount ?? 0 },
  ];

  const severidadLabel: Record<string, string> = {
    critica: "Crítica",
    advertencia: "Advertencia",
    info: "Info",
  };

  const severidadTone: Record<string, "error" | "warning" | "info"> = {
    critica: "error",
    advertencia: "warning",
    info: "info",
  };

  return (
    <div className="p-8">
      <PageHeader
        title="Notificaciones"
        description="Alertas del sistema sobre vencimientos, documentos y operaciones"
        action={
          <div className="flex items-center gap-2">
            <form action={actualizarAlertas}>
              <Button type="submit" variant="outline" size="sm">
                <RefreshCw size={14} />
                Actualizar alertas
              </Button>
            </form>
            {(totalPendientes ?? 0) > 0 && (
              <form action={marcarTodasVistas}>
                <Button type="submit" variant="outline" size="sm">
                  Marcar todas como leídas
                </Button>
              </form>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard
          label="Pendientes"
          value={String(totalPendientes ?? 0)}
          sub="Sin revisar"
          color="warning"
        />
        <StatCard
          label="Críticas"
          value={String(totalCriticas ?? 0)}
          sub="Requieren acción inmediata"
          color="error"
        />
        <StatCard
          label="Tipos monitoreados"
          value={String(tiposDoc?.length ?? 0)}
          sub="Documentos con alerta"
          color="success"
        />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        {categorias.map(({ icon: Icon, label, description, count }) => (
          <div key={label} className="bg-white rounded-[8px] border border-[#E2E8F0] shadow-sm p-5">
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

      {/* Alert list */}
      <div className="bg-white rounded-[8px] border border-[#E2E8F0] shadow-sm mb-6">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-2">
            <Bell size={16} className="text-[#0088D1]" />
            <h2 className="text-[#0F172A] text-sm font-semibold">Alertas pendientes</h2>
          </div>
          <span className="text-xs text-[#94A3B8]">{totalPendientes ?? 0} total</span>
        </div>

        {!alertas || alertas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-[#E1F5FE] mb-4">
              <Bell size={24} className="text-[#0088D1]" />
            </div>
            <p className="text-[#0F172A] text-sm font-medium mb-1">Sin alertas pendientes</p>
            <p className="text-[#94A3B8] text-sm">El sistema no detectó alertas activas</p>
          </div>
        ) : (
          <div className="divide-y divide-[#F1F5F9]">
            {alertas.map((alerta) => (
              <div key={alerta.id} className="flex items-start gap-4 px-5 py-4 hover:bg-[#F8FAFC] transition-colors">
                <StatusBadge
                  label={severidadLabel[alerta.severidad] ?? alerta.severidad}
                  tone={severidadTone[alerta.severidad] ?? "info"}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[#0F172A] text-sm font-semibold">{alerta.titulo}</p>
                  <p className="text-[#475569] text-xs mt-0.5">{alerta.mensaje}</p>
                  {alerta.fecha_vencimiento && (
                    <p className="text-[#94A3B8] text-xs mt-1">
                      Vence: {new Date(alerta.fecha_vencimiento).toLocaleDateString("es-AR")}
                    </p>
                  )}
                </div>
                <span className="text-xs text-[#94A3B8] shrink-0">
                  {new Date(alerta.fecha_disparo).toLocaleDateString("es-AR")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tipos de documento configurados */}
      <div className="bg-white rounded-[8px] border border-[#E2E8F0] shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-2">
            <ShieldAlert size={16} className="text-[#0088D1]" />
            <h2 className="text-[#0F172A] text-sm font-semibold">Tipos de documento monitoreados</h2>
          </div>
          <span className="text-xs text-[#94A3B8]">{tiposDoc?.length ?? 0} tipos activos</span>
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
                  Alerta a los {t.dias_alerta_vencimiento} días
                  {t.obligatorio && <span className="ml-1 text-[#EF4444]">· Obligatorio</span>}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
