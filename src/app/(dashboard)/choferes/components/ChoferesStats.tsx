"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import StatCard from "@/components/ui/StatCard";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import StatusBadge from "@/components/ui/StatusBadge";
import { ChevronRight } from "lucide-react";
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

interface Props {
  total: number;
  activos: number;
  inactivos: number;
  choferesCount: number;
  administrativoCount: number;
  mantenimientoCount: number;
  fleteroCount: number;
  totalDocs: number;
  vencidosCount: number;
  porVencerCount: number;
  vencidosDocs: DocVigenciaListItem[];
  porVencerDocs: DocVigenciaListItem[];
}

export default function ChoferesStats({
  total,
  activos,
  inactivos,
  choferesCount,
  administrativoCount,
  mantenimientoCount,
  fleteroCount,
  totalDocs,
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

  return (
    <>
      {/* Fila 1 — desglose de personal por rol */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-3">
        <StatCard
          label="Total personal"
          value={String(total)}
          sub={`${activos} activos · ${inactivos} inactivos`}
          color="brand"
        />
        <StatCard
          label="Choferes"
          value={String(choferesCount)}
          sub="Rol: chofer"
          color="success"
        />
        <StatCard
          label="Administración"
          value={String(administrativoCount)}
          sub="Rol: administrativo"
          color="brand"
        />
        <StatCard
          label="Mantenimiento"
          value={String(mantenimientoCount)}
          sub="Rol: mantenimiento"
          color="warning"
        />
        <StatCard
          label="Fleteros"
          value={String(fleteroCount)}
          sub="Tercerizados"
          color="brand"
        />
      </div>

      {/* Fila 2 — documentación. En celular van de a dos como la fila de arriba:
          apiladas de a una, el panel se comía la pantalla entera antes del
          listado, que es a lo que se entra. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <StatCard label="Documentos" value={String(totalDocs)} sub="En legajos" color="brand" />
        <StatCard
          label="Vencidos"
          value={String(vencidosCount)}
          color="error"
          sub="Documentos vencidos"
          onClick={vencidosCount > 0 ? () => handleCardClick("vencido") : undefined}
        />
        <StatCard
          label="Por vencer"
          value={String(porVencerCount)}
          color="warning"
          sub="Próximos a vencer"
          onClick={porVencerCount > 0 ? () => handleCardClick("por_vencer") : undefined}
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
