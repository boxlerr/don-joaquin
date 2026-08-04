import PageHeader from "@/components/layout/PageHeader";
import { Lock } from "lucide-react";
import { requireSeccion } from "@/lib/auth";
import DashboardView from "../DashboardView";

/**
 * Dashboard completo (privado): el mismo dashboard general pero CON la
 * facturación acumulada del período y los montos por chofer. Bárbara pidió
 * poder verla junto a su padre sin que quede a la vista de todo el equipo,
 * por eso va detrás del permiso confidencial `dashboard_completo`.
 */
export default async function DashboardCompletoPage({
  searchParams,
}: {
  searchParams: Promise<{ rango?: string; desde?: string; hasta?: string }>;
}) {
  await requireSeccion("dashboard_completo", "read");

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 w-full">
      <PageHeader
        title="Dashboard completo"
        description="Resumen con facturación — solo dirección"
      />

      <div className="flex items-start gap-3 rounded-[8px] border border-amber-200 bg-amber-50 px-4 py-3">
        <Lock size={16} className="text-amber-700 mt-0.5 shrink-0" />
        <div className="text-xs text-amber-800 leading-relaxed">
          <p className="font-semibold">Vista privada — solo dirección.</p>
          <p className="mt-0.5">
            Es el mismo dashboard general, pero con la <strong>facturación acumulada
            del período</strong>, el <strong>$/km</strong> y los montos por chofer a la vista.
            El resto del equipo entra por el dashboard común, que no muestra importes.
          </p>
        </div>
      </div>

      <DashboardView sp={await searchParams} conFacturacion />
    </div>
  );
}
