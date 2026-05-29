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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <StatCard label="Total choferes" value={String(total)} sub="En planilla" color="brand" />
        <StatCard label="Activos" value={String(activos)} color="success" />
        <StatCard label="Inactivos" value={String(inactivos)} color="warning" />
        <StatCard label="Documentos" value={String(totalDocs)} sub="En legajos" color="brand" />
        
        <StatCard
          label="Vencidos"
          value={String(vencidosCount)}
          color="error"
          sub="Vencidos"
          onClick={vencidosCount > 0 ? () => handleCardClick("vencido") : undefined}
        />
        <StatCard
          label="Por vencer"
          value={String(porVencerCount)}
          color="warning"
          sub="Por vencer"
          onClick={porVencerCount > 0 ? () => handleCardClick("por_vencer") : undefined}
        />
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto p-6 rounded-lg">
          <DialogHeader className="pb-3 border-b border-[#F1F5F9] relative">
            <DialogTitle className="text-xl font-bold text-foreground pr-6">{title}</DialogTitle>
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
                <div
                  key={`${doc.id}-${index}`}
                  onClick={() => {
                    setOpen(false);
                    if (doc.chofer_id) {
                      router.push(`/choferes/${doc.chofer_id}?tab=documentos`);
                    }
                  }}
                  className="flex items-center justify-between p-4 border border-[#E2E8F0] rounded-[8px] hover:bg-slate-50 hover:border-primary/40 cursor-pointer transition-all"
                >
                  <div className="min-w-0 flex-1 pr-4">
                    <div className="font-semibold text-sm text-foreground truncate">
                      {doc.chofer ?? "Chofer desconocido"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {doc.tipo_documento ?? "Documento"}
                    </div>
                  </div>

                  <div className="text-right pr-4 shrink-0">
                    <div className="text-sm font-medium text-foreground">
                      {doc.fecha_vencimiento ? formatFecha(doc.fecha_vencimiento) : "—"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {diasText}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <StatusBadge
                      label={doc.estado_vigencia === "vencido" ? "VENCIDO" : "POR VENCER"}
                      tone={doc.estado_vigencia === "vencido" ? "error" : "warning"}
                    />
                    <ChevronRight size={16} className="text-muted-foreground/50" />
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
