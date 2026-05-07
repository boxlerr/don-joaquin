import PageHeader from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Bell } from "lucide-react";

export default function NotificacionesPage() {
  return (
    <div className="p-8">
      <PageHeader
        title="Notificaciones"
        description="Alertas y avisos del sistema"
      />

      <div className="bg-white rounded-[8px] border border-[#E2E8F0] shadow-sm">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-[#E2E8F0]">
          <Bell size={16} className="text-[#0088D1]" />
          <h2 className="text-[#0F172A] text-sm font-semibold">Centro de Notificaciones</h2>
        </div>
        <EmptyState icon={Bell} message="No hay alertas ni avisos pendientes" />
      </div>
    </div>
  );
}
