import PageHeader from "@/components/layout/PageHeader";
export const dynamic = "force-dynamic";
import StatCard from "@/components/ui/StatCard";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertOctagon, Clock, ShieldCheck } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { marcarTodasVistas, actualizarAlertas } from "./actions";
import NotificacionesView from "./NotificacionesView";
import TiposMonitoreados from "./TiposMonitoreados";
import { diasRestantes, type AlertaItem } from "./utils";

export default async function NotificacionesPage() {
  await requireUser();
  const supabase = createAdminClient();

  const [
    { data: alertasRaw },
    { data: tiposDoc },
    { data: camionDocs },
    { data: choferDocs },
  ] = await Promise.all([
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
      .select("id, tipo_documento_id, fecha_vencimiento, camiones(patente)"),
    supabase
      .from("chofer_documentos")
      .select("id, tipo_documento_id, fecha_vencimiento, choferes(nombre, apellido)"),
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

  const DIAS_CRITICO = 7;
  const nowIso = new Date().toISOString();

  // Alertas de documentos calculadas EN VIVO desde camion_documentos / chofer_documentos.
  // Incluye vencidos (que el generador de alertas omitía) y próximos según los días
  // de anticipación de cada tipo. Son auto-resolutivas: se actualizan al renovar el doc.
  const docAlertas: AlertaItem[] = [];

  function procesar(
    docs:
      | {
          id: string;
          tipo_documento_id: string;
          fecha_vencimiento: string | null;
          camiones?: { patente: string } | null;
          choferes?: { nombre: string; apellido: string } | null;
        }[]
      | null
      | undefined,
    ambito: "camion" | "chofer",
  ) {
    for (const d of docs ?? []) {
      const tipo = tipoById.get(d.tipo_documento_id);
      if (!tipo) continue;
      const c = conteos[d.tipo_documento_id]!;
      c.total++;
      if (!d.fecha_vencimiento) continue;
      // Misma lógica que el chip (parseo por partes, sin desfase de timezone).
      const diasRest = diasRestantes(d.fecha_vencimiento);
      if (diasRest === null) continue;

      const vencido = diasRest < 0;
      const proximo = !vencido && diasRest <= tipo.dias_alerta_vencimiento;
      if (vencido) c.vencidos++;
      else if (proximo) c.proximos++;

      if (!vencido && !proximo) continue;

      const entidad = ambito === "camion"
        ? (d.camiones?.patente ?? "Camión")
        : d.choferes
          ? `${d.choferes.apellido} ${d.choferes.nombre}`
          : "Chofer";

      docAlertas.push({
        id: `docvenc-${d.id}`,
        tipo: ambito === "camion" ? "vencimiento_doc_camion" : "vencimiento_doc_chofer",
        severidad: vencido || diasRest <= DIAS_CRITICO ? "critica" : "advertencia",
        titulo: `${tipo.nombre} — ${entidad}`,
        mensaje: vencido
          ? `${tipo.nombre} venció hace ${Math.abs(diasRest)} día${Math.abs(diasRest) !== 1 ? "s" : ""}.`
          : `${tipo.nombre} vence en ${diasRest} día${diasRest !== 1 ? "s" : ""}.`,
        fecha_disparo: nowIso,
        fecha_vencimiento: d.fecha_vencimiento,
        entidad_tipo: ambito === "camion" ? "camion_documentos" : "chofer_documentos",
        entidad_id: d.id,
        marcable: false,
      });
    }
  }
  procesar(camionDocs, "camion");
  procesar(choferDocs, "chofer");

  // Alertas reales de la tabla (cheques, cumpleaños, prueba, compliance). Excluimos las
  // de documentos porque ya las calculamos arriba en vivo (evita duplicados).
  const otrasAlertas = alertas.filter(
    (a) => a.tipo !== "vencimiento_doc_camion" && a.tipo !== "vencimiento_doc_chofer",
  );

  const alertasMerged: AlertaItem[] = [...docAlertas, ...otrasAlertas];

  const docVencidos = docAlertas.filter((a) => a.mensaje.includes("venció")).length;
  const docProximos = docAlertas.length - docVencidos;

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
            {otrasAlertas.length > 0 && (
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
          label="Vencidos"
          value={String(docVencidos)}
          sub="Documentos vencidos"
          color="error"
          icon={AlertOctagon}
          variant="dashboard"
        />
        <StatCard
          label="Próximos a vencer"
          value={String(docProximos)}
          sub="Dentro del plazo de alerta"
          color="warning"
          icon={Clock}
          variant="dashboard"
        />
        <StatCard
          label="Tipos monitoreados"
          value={String(tipos.length)}
          sub="Documentos vigilados"
          color="success"
          icon={ShieldCheck}
          variant="dashboard"
        />
      </div>

      <NotificacionesView alertas={alertasMerged} />

      <div className="mt-6">
        <TiposMonitoreados tipos={tipos} conteos={conteos} />
      </div>
    </div>
  );
}
