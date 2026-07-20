import PageHeader from "@/components/layout/PageHeader";
import StatCard from "@/components/ui/StatCard";
import { Landmark, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { requireSeccion, hasSeccion } from "@/lib/auth";
import { getImpuestosAction } from "./actions";
import ImpuestosClient from "./ImpuestosClient";
import HelpTutorialButton from "./help-tutorial-button";
import ExportImpuestosButton from "./export-impuestos-button";

function diasRestantes(fechaISO: string): number {
  const [y, m, d] = fechaISO.split("-").map(Number);
  const venc = new Date(y!, m! - 1, d!);
  const hoy = new Date();
  const hoyMid = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return Math.round((venc.getTime() - hoyMid.getTime()) / 86400000);
}

export default async function ImpuestosPage() {
  const user = await requireSeccion("impuestos", "read");
  const canWrite = hasSeccion(user, "impuestos", "write");

  const impuestos = await getImpuestosAction();

  const pendientes = impuestos.filter((i) => !i.presentado);
  const presentados = impuestos.length - pendientes.length;
  // Vencidos = pendientes con fecha pasada; por vencer = pendientes en <= 7 días
  const vencidos = pendientes.filter((i) => diasRestantes(i.fecha_vencimiento) < 0).length;
  const porVencer = pendientes.filter((i) => {
    const d = diasRestantes(i.fecha_vencimiento);
    return d >= 0 && d <= 7;
  }).length;

  return (
    <div className="p-8 space-y-6">
      <PageHeader
        title="Impuestos"
        description="Calendario de vencimientos impositivos — checklist de presentación y alertas"
        action={
          <div className="flex items-center gap-2">
            <ExportImpuestosButton />
            <HelpTutorialButton />
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Impuestos" value={String(impuestos.length)} sub="En el calendario" color="brand" icon={Landmark} variant="dashboard" />
        <StatCard label="Presentados" value={String(presentados)} sub="Marcados como hechos" color="success" icon={CheckCircle2} variant="dashboard" />
        <StatCard label="Por vencer" value={String(porVencer)} sub="Pendientes en ≤ 7 días" color="warning" icon={Clock} variant="dashboard" />
        <StatCard label="Vencidos" value={String(vencidos)} sub="Pendientes pasados de fecha" color="error" icon={AlertTriangle} variant="dashboard" />
      </div>

      <ImpuestosClient impuestos={impuestos} canWrite={canWrite} />
    </div>
  );
}
