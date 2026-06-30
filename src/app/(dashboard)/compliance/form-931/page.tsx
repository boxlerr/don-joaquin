import PageHeader from "@/components/layout/PageHeader";
import StatCard from "@/components/ui/StatCard";
import { FileCheck2, CheckCircle2, Clock, AlertTriangle, ShieldAlert } from "lucide-react";
import { requireArea, hasArea } from "@/lib/auth";
import { getForm931Action } from "./actions";
import Form931Client from "./Form931Client";

function diasRestantes(fechaISO: string): number {
  const [y, m, d] = fechaISO.split("-").map(Number);
  const venc = new Date(y!, m! - 1, d!);
  const hoy = new Date();
  const hoyMid = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return Math.round((venc.getTime() - hoyMid.getTime()) / 86400000);
}

export default async function Form931Page() {
  const user = await requireArea("compliance", "read");
  const canWrite = hasArea(user, "compliance", "write");

  const periodos = await getForm931Action();

  const completo = (p: (typeof periodos)[number]) => p.enviado_ypf && p.enviado_loma;
  const completos = periodos.filter(completo).length;
  const pendientes = periodos.filter((p) => !completo(p));
  const vencidos = pendientes.filter((p) => diasRestantes(p.fecha_limite) < 0).length;
  const porVencer = pendientes.filter((p) => {
    const d = diasRestantes(p.fecha_limite);
    return d >= 0 && d <= 7;
  }).length;

  return (
    <div className="p-8 space-y-6">
      <PageHeader
        title="Formulario 931"
        description="Checklist de envío del F931 a YPF y a Loma Negra — con alertas de vencimiento"
      />

      {/* Aviso: cómo funciona + bloqueante */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <ShieldAlert size={18} className="mt-0.5 shrink-0 text-amber-600" />
        <div>
          <p className="font-semibold">El F931 es bloqueante: sin presentarlo, no puede cargar nadie.</p>
          <p className="text-xs mt-0.5 text-amber-700">
            Cada mes hay que enviarlo a las dos plataformas: <strong>Nico lo manda a YPF</strong> y{" "}
            <strong>Noelia a Loma Negra</strong>. Marcá cada envío al hacerlo. Si llega la fecha límite
            sin enviarse, salta alerta a todos (campana + email de Compliance).
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Períodos" value={String(periodos.length)} sub="En seguimiento" color="brand" icon={FileCheck2} variant="dashboard" />
        <StatCard label="Completos" value={String(completos)} sub="Enviado a YPF y Loma" color="success" icon={CheckCircle2} variant="dashboard" />
        <StatCard label="Por vencer" value={String(porVencer)} sub="Pendientes en ≤ 7 días" color="warning" icon={Clock} variant="dashboard" />
        <StatCard label="Vencidos" value={String(vencidos)} sub="Pendientes pasados de fecha" color="error" icon={AlertTriangle} variant="dashboard" />
      </div>

      <Form931Client periodos={periodos} canWrite={canWrite} />
    </div>
  );
}
