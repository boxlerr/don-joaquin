import PageHeader from "@/components/layout/PageHeader";
import { Lock } from "lucide-react";
import { requireSeccion, hasSeccion } from "@/lib/auth";
import { getPrestamosAction } from "./actions";
import PrestamosClient from "./PrestamosClient";

/**
 * Préstamos bancarios (audio Bárbara 02/07): la planilla de la mamá en el
 * sistema — cuotas por banco con fecha, importe, número (44/48) y tasa.
 * Avisa los vencimientos y muestra cuánto hay que pagar por semana, para
 * planificar pagos y financiación de cheques. Sección confidencial.
 */
export default async function PrestamosPage() {
  const user = await requireSeccion("prestamos", "read");
  const canWrite = hasSeccion(user, "prestamos", "write");

  const prestamos = await getPrestamosAction();

  return (
    <div className="p-8 space-y-6">
      <PageHeader
        title="Préstamos"
        description="Cuotas por banco, vencimientos y carga semanal de pagos"
      />

      <div className="flex items-start gap-3 rounded-[8px] border border-amber-200 bg-amber-50 px-4 py-3">
        <Lock size={16} className="text-amber-700 mt-0.5 shrink-0" />
        <div className="text-xs text-amber-800 leading-relaxed">
          <p className="font-semibold">Sección privada — solo dirección.</p>
          <p className="mt-0.5">
            El sistema avisa los vencimientos por la campana de notificaciones (una semana antes,
            el día previo y si una cuota quedó vencida sin marcar como pagada).
          </p>
        </div>
      </div>

      <PrestamosClient prestamos={prestamos} canWrite={canWrite} />
    </div>
  );
}
