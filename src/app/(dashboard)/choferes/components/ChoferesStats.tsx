"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Truck,
  Briefcase,
  Wrench,
  Handshake,
  FileText,
  CalendarX2,
  Hourglass,
  ChevronRight,
} from "lucide-react";
import MetricCard from "@/components/ui/MetricCard";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatFecha } from "@/lib/utils";

export type DocVigenciaListItem = {
  id: string | null;
  chofer: string | null;
  chofer_id: string | null;
  tipo_documento: string | null;
  fecha_vencimiento: string | null;
  dias_restantes: number | null;
  estado_vigencia: string | null;
};

/** Dotación al cierre de cada uno de los últimos 12 meses. La calcula la página. */
export type SerieDotacion = number[];

interface Props {
  total: number;
  activos: number;
  inactivos: number;
  choferesCount: number;
  administrativoCount: number;
  mantenimientoCount: number;
  fleteroCount: number;
  series: {
    total: SerieDotacion;
    chofer: SerieDotacion;
    administrativo: SerieDotacion;
    mantenimiento: SerieDotacion;
    fletero: SerieDotacion;
  };
  totalDocs: number;
  alDiaCount: number;
  vencidosCount: number;
  porVencerCount: number;
  vencidosDocs: DocVigenciaListItem[];
  porVencerDocs: DocVigenciaListItem[];
}

/**
 * Qué cambió en el año, dicho en una frase.
 *
 * Un sparkline sin leyenda obliga a adivinar la escala: "+7 en 12 meses" es el
 * dato, la línea es sólo la forma en que llegó ahí.
 */
function captionTendencia(points: number[]): string {
  if (points.length < 2) return "";
  const delta = points[points.length - 1]! - points[0]!;
  if (delta === 0) return "Sin cambios en 12 meses";
  return `${delta > 0 ? "+" : "−"}${Math.abs(delta)} en 12 meses`;
}

export default function ChoferesStats({
  total,
  activos,
  inactivos,
  choferesCount,
  administrativoCount,
  mantenimientoCount,
  fleteroCount,
  series,
  totalDocs,
  alDiaCount,
  vencidosCount,
  porVencerCount,
  vencidosDocs,
  porVencerDocs,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [filterType, setFilterType] = useState<"vencido" | "por_vencer" | null>(null);

  const handleCardClick = (type: "vencido" | "por_vencer") => {
    const list = type === "vencido" ? vencidosDocs : porVencerDocs;
    if (list.length === 0) return;
    setFilterType(type);
    setOpen(true);
  };

  const selectedDocs = filterType === "vencido" ? vencidosDocs : porVencerDocs;
  const title = filterType === "vencido" ? "Documentos vencidos" : "Documentos próximos a vencer";
  const description =
    filterType === "vencido"
      ? "Listado de documentación vencida que requiere renovación urgente."
      : "VTV y demás documentación por vencer dentro del plazo de alerta.";

  // Desglose de los vencidos por antigüedad: 45 sueltos no dicen si es un atraso
  // de esta semana o una deuda de un año. Los tramos cubren todo el rango, así
  // que las tres columnas siempre suman el número grande.
  const venc = { reciente: 0, medio: 0, viejo: 0 };
  for (const d of vencidosDocs) {
    const dias = d.dias_restantes ?? 0;
    if (dias > -30) venc.reciente++;
    else if (dias > -90) venc.medio++;
    else venc.viejo++;
  }

  // Lo mismo del otro lado: cuánto margen queda para renovar.
  const porVenc = { urgente: 0, quincena: 0, resto: 0 };
  for (const d of porVencerDocs) {
    const dias = d.dias_restantes ?? 0;
    if (dias <= 7) porVenc.urgente++;
    else if (dias <= 15) porVenc.quincena++;
    else porVenc.resto++;
  }

  const pctAlDia = totalDocs > 0 ? (alDiaCount / totalDocs) * 100 : 0;

  return (
    <>
      {/* Fila 1 — desglose de personal por rol */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-3 sm:mb-4">
        <MetricCard
          label="Total personal"
          value={String(total)}
          sub={`${activos} activos · ${inactivos} inactivos`}
          icon={Users}
          tone="brand"
          trend={{ points: series.total, caption: captionTendencia(series.total) }}
        />
        <MetricCard
          label="Choferes"
          value={String(choferesCount)}
          sub="En ruta"
          icon={Truck}
          tone="success"
          trend={{ points: series.chofer, caption: captionTendencia(series.chofer) }}
        />
        <MetricCard
          label="Administración"
          value={String(administrativoCount)}
          sub="Oficina"
          icon={Briefcase}
          tone="brand"
          trend={{ points: series.administrativo, caption: captionTendencia(series.administrativo) }}
        />
        <MetricCard
          label="Mantenimiento"
          value={String(mantenimientoCount)}
          sub="Taller"
          icon={Wrench}
          tone="warning"
          trend={{ points: series.mantenimiento, caption: captionTendencia(series.mantenimiento) }}
        />
        <MetricCard
          label="Fleteros"
          value={String(fleteroCount)}
          sub="Tercerizados"
          icon={Handshake}
          tone="neutral"
          trend={{ points: series.fletero, caption: captionTendencia(series.fletero) }}
        />
      </div>

      {/* Fila 2 — documentación. En celular van de a dos como la fila de arriba:
          apiladas de a una, el panel se comía la pantalla entera antes del
          listado, que es a lo que se entra. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <MetricCard
          label="Documentos"
          value={String(totalDocs)}
          sub="En legajos"
          icon={FileText}
          tone="success"
          // La barra se llena con lo que está al día, no con lo vencido: así un
          // legajo sano se ve lleno y no vacío.
          bar={{
            pct: pctAlDia,
            title: `${alDiaCount} de ${totalDocs} documentos al día (${Math.round(pctAlDia)}%)`,
          }}
          breakdown={[
            { label: "Al día", value: String(alDiaCount), tone: "success" },
            { label: "Por vencer", value: String(porVencerCount), tone: "warning" },
            { label: "Vencidos", value: String(vencidosCount), tone: "error" },
          ]}
        />
        <MetricCard
          label="Vencidos"
          value={String(vencidosCount)}
          sub="Hay que renovarlos"
          icon={CalendarX2}
          tone="error"
          onClick={vencidosCount > 0 ? () => handleCardClick("vencido") : undefined}
          breakdown={[
            { label: "Menos de 30 días", value: String(venc.reciente), tone: "warning" },
            { label: "De 30 a 90 días", value: String(venc.medio), tone: "error" },
            { label: "Más de 90 días", value: String(venc.viejo), tone: "error" },
          ]}
        />
        <MetricCard
          label="Por vencer"
          value={String(porVencerCount)}
          sub="Todavía se está a tiempo"
          icon={Hourglass}
          tone="warning"
          onClick={porVencerCount > 0 ? () => handleCardClick("por_vencer") : undefined}
          breakdown={[
            { label: "En 7 días o menos", value: String(porVenc.urgente), tone: "error" },
            { label: "De 8 a 15 días", value: String(porVenc.quincena), tone: "warning" },
            { label: "Más de 15 días", value: String(porVenc.resto), tone: "neutral" },
          ]}
        />
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[85dvh] overflow-y-auto rounded-lg">
          <DialogHeader className="pb-3 border-b border-[#F1F5F9] relative">
            {/* `pr-10`: el botón de cerrar mide 36px en touch, no 28. */}
            <DialogTitle className="text-lg sm:text-xl font-bold text-foreground pr-10">{title}</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              {description}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 mt-4">
            {selectedDocs.map((doc, index) => {
              const dias = doc.dias_restantes;
              const diasText =
                dias === null
                  ? ""
                  : dias < 0
                  ? `Vencido hace ${Math.abs(dias)} d`
                  : dias === 0
                  ? "Vence hoy"
                  : `Faltan ${dias} d`;

              return (
                // En celular las tres columnas (chofer / fecha / estado) no
                // entran en 343px: el chofer va arriba, y abajo la fecha con
                // el estado.
                <div
                  key={`${doc.id}-${index}`}
                  onClick={() => {
                    setOpen(false);
                    if (doc.chofer_id) {
                      router.push(`/choferes/${doc.chofer_id}?tab=documentos`);
                    }
                  }}
                  className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-0 sm:p-4 border border-[#E2E8F0] rounded-[8px] hover:bg-slate-50 hover:border-primary/40 cursor-pointer transition-all"
                >
                  <div className="min-w-0 flex-1 sm:pr-4">
                    <div className="font-semibold text-sm text-foreground truncate">
                      {doc.chofer ?? "Chofer desconocido"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {doc.tipo_documento ?? "Documento"}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <div className="text-left sm:text-right sm:pr-4 shrink-0">
                      <div className="text-sm font-medium text-foreground">
                        {doc.fecha_vencimiento ? formatFecha(doc.fecha_vencimiento) : "—"}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {diasText}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                      <StatusBadge
                        label={doc.estado_vigencia === "vencido" ? "VENCIDO" : "POR VENCER"}
                        tone={doc.estado_vigencia === "vencido" ? "error" : "warning"}
                      />
                      <ChevronRight size={16} className="text-muted-foreground/50" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
