import PageHeader from "@/components/layout/PageHeader";
export const dynamic = "force-dynamic";
import StatCard from "@/components/ui/StatCard";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertOctagon, Clock, ShieldCheck } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { DOC_LIVE, getHistorialLeidas, getPendientesNoLeidasIds } from "@/lib/alertas-lecturas";
import { marcarTodasVistas, actualizarAlertas } from "./actions";
import NotificacionesView from "./NotificacionesView";
import TiposMonitoreados from "./TiposMonitoreados";
import HelpTutorialButton from "./help-tutorial-button";
import { diasRestantes, type AlertaItem } from "./utils";
import { visiblePara } from "@/lib/alertas-visibilidad";

export default async function NotificacionesPage() {
  const user = await requireUser();
  const supabase = createAdminClient();

  const [
    { data: alertasRaw },
    leidasUsuario,
    pendientesNoLeidasIds,
    { data: tiposDoc },
    { data: camionDocs },
    { data: choferDocs },
  ] = await Promise.all([
    supabase
      .from("alertas")
      .select("id, tipo, severidad, titulo, mensaje, fecha_disparo, fecha_vencimiento, entidad_tipo, entidad_id")
      .eq("estado", "pendiente")
      // Mismo filtro/cap que getPendientesNoLeidasIds, para que badge, lista y
      // "Marcar todas" operen sobre exactamente el mismo conjunto.
      .not("tipo", "in", `(${DOC_LIVE.join(",")})`)
      .order("severidad", { ascending: false })
      .order("fecha_disparo", { ascending: false })
      .limit(1000),
    // Historial de leídas POR USUARIO (lo que ESTE usuario marcó leído y no borró).
    getHistorialLeidas(user.id),
    // IDs de pendientes que ESTE usuario aún no leyó (para particionar más abajo).
    getPendientesNoLeidasIds(user),
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

  // Las alertas de secciones confidenciales sólo las ve quien tiene permiso:
  // las de préstamos traen montos y esta pantalla sólo pide estar logueado.
  const puedeVer = visiblePara(user);

  // Sólo las pendientes que ESTE usuario no leyó (estado leído es per-user).
  const noLeidasSet = new Set(pendientesNoLeidasIds);
  const alertas = ((alertasRaw ?? []) as AlertaItem[]).filter(
    (a) => noLeidasSet.has(a.id) && puedeVer(a),
  );

  const leidas = leidasUsuario.filter(puedeVer);

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
          : diasRest === 0
            ? `${tipo.nombre} vence hoy.`
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
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Notificaciones"
        description="Alertas del sistema sobre vencimientos, documentos y operaciones"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <HelpTutorialButton />
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-5 sm:mb-6">
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

      <NotificacionesView alertas={alertasMerged} leidas={leidas} />

      <div className="mt-6">
        <TiposMonitoreados tipos={tipos} conteos={conteos} />
      </div>
    </div>
  );
}
