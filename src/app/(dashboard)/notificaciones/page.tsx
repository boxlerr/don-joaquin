import PageHeader from "@/components/layout/PageHeader";
export const dynamic = "force-dynamic";
import StatCard from "@/components/ui/StatCard";
import { Button } from "@/components/ui/button";
import {
  ShieldAlert,
  FileText,
  MapPin,
  Settings,
  RefreshCw,
} from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { marcarTodasVistas, actualizarAlertas } from "./actions";
import NotificacionesView from "./NotificacionesView";
import TiposMonitoreados from "./TiposMonitoreados";
import { categoriaDeAlerta, type AlertaItem } from "./utils";

export default async function NotificacionesPage() {
  await requireUser();
  const supabase = createAdminClient();

  const [
    { count: totalPendientes },
    { count: totalCriticas },
    { data: alertasRaw },
    { data: tiposDoc },
    { data: camionDocs },
    { data: choferDocs },
  ] = await Promise.all([
    supabase.from("alertas").select("*", { count: "exact", head: true }).eq("estado", "pendiente"),
    supabase
      .from("alertas")
      .select("*", { count: "exact", head: true })
      .eq("estado", "pendiente")
      .eq("severidad", "critica"),
    supabase
      .from("alertas")
      .select("id, tipo, severidad, titulo, mensaje, fecha_disparo, fecha_vencimiento, entidad_tipo, entidad_id")
      .eq("estado", "pendiente")
      .order("severidad", { ascending: false })
      .order("fecha_disparo", { ascending: false })
      .limit(200),
    supabase
      .from("tipos_documento")
      .select("id, nombre, aplica_a, dias_alerta_vencimiento, obligatorio")
      .eq("estado", "activo"),
    supabase
      .from("camion_documentos")
      .select("tipo_documento_id, fecha_vencimiento"),
    supabase
      .from("chofer_documentos")
      .select("tipo_documento_id, fecha_vencimiento"),
  ]);

  const alertas = (alertasRaw ?? []) as AlertaItem[];

  const tipos = (tiposDoc ?? []) as {
    id: string;
    nombre: string;
    aplica_a: "camion" | "chofer";
    dias_alerta_vencimiento: number;
    obligatorio: boolean;
  }[];

  const tipoById = new Map(tipos.map((t) => [t.id, t]));
  const conteos: Record<string, { total: number; proximos: number; vencidos: number }> = {};
  for (const t of tipos) conteos[t.id] = { total: 0, proximos: 0, vencidos: 0 };

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  function acumular(docs: { tipo_documento_id: string; fecha_vencimiento: string | null }[] | null | undefined) {
    for (const d of docs ?? []) {
      const tipo = tipoById.get(d.tipo_documento_id);
      if (!tipo) continue;
      const c = conteos[d.tipo_documento_id]!;
      c.total++;
      if (!d.fecha_vencimiento) continue;
      const venc = new Date(d.fecha_vencimiento);
      venc.setHours(0, 0, 0, 0);
      const diasRest = Math.ceil((venc.getTime() - hoy.getTime()) / 86400000);
      if (diasRest < 0) c.vencidos++;
      else if (diasRest <= tipo.dias_alerta_vencimiento) c.proximos++;
    }
  }
  acumular(camionDocs);
  acumular(choferDocs);

  const catCounts = {
    documentacion: 0,
    cheques: 0,
    viajes: 0,
    sistema: 0,
  };
  for (const a of alertas) catCounts[categoriaDeAlerta(a.tipo)]++;

  const categorias = [
    {
      icon: ShieldAlert,
      label: "Documentación",
      description: "Vencimientos de VTV, seguro, licencias, RUTA/LINTI",
      count: catCounts.documentacion,
    },
    {
      icon: FileText,
      label: "Cheques",
      description: "Próximos a vencer, vencidos o rechazados",
      count: catCounts.cheques,
    },
    {
      icon: MapPin,
      label: "Viajes y viáticos",
      description: "Viajes pendientes de cierre, viáticos sin rendir",
      count: catCounts.viajes,
    },
    {
      icon: Settings,
      label: "Sistema",
      description: "Backups, sesiones y eventos administrativos",
      count: catCounts.sistema,
    },
  ];

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
          value={String(tipos.length)}
          sub="Documentos con alerta"
          color="success"
        />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        {categorias.map(({ icon: Icon, label, description, count }) => (
          <div
            key={label}
            className="bg-card rounded-[8px] border border-border shadow-sm p-5"
          >
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#E1F5FE] shrink-0">
                <Icon size={20} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-foreground text-sm font-semibold">{label}</p>
                <p className="text-muted-foreground text-xs mt-0.5">{description}</p>
              </div>
              <span className="text-2xl font-bold text-primary">{count}</span>
            </div>
          </div>
        ))}
      </div>

      <NotificacionesView alertas={alertas} />

      <div className="mt-6">
        <TiposMonitoreados tipos={tipos} conteos={conteos} />
      </div>
    </div>
  );
}
