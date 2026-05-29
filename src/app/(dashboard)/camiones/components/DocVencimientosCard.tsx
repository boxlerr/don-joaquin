"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, ChevronRight } from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import StatusBadge from "@/components/ui/StatusBadge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export type DocVencimiento = {
  id: string | null;
  camion_id: string | null;
  patente: string | null;
  tipo_documento: string | null;
  fecha_vencimiento: string | null;
  dias_restantes: number | null;
  estado_vigencia: string | null;
};

function formatFecha(f: string | null) {
  if (!f) return "—";
  const [y, m, d] = f.split("-");
  return `${d}/${m}/${y}`;
}

export default function DocVencimientosCard({ documentos }: { documentos: DocVencimiento[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const irADocumento = (camionId: string | null) => {
    if (!camionId) return;
    setOpen(false);
    router.push(`/camiones?camionId=${camionId}&tab=docs`);
  };

  return (
    <>
      <StatCard
        label="Documentación"
        value={String(documentos.length)}
        sub="Vencimientos próximos"
        color="error"
        icon={FileText}
        onClick={() => setOpen(true)}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle className="text-foreground text-lg font-bold">
              Documentos próximos a vencer
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              VTV y demás documentación vencida o por vencer dentro del plazo de alerta.
            </DialogDescription>
          </DialogHeader>

          {documentos.length === 0 ? (
            <p className="text-muted-foreground text-sm py-6 text-center">
              No hay documentos próximos a vencer.
            </p>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto -mx-2 px-2">
              <div className="flex flex-col divide-y divide-border">
                {documentos.map((doc) => {
                  const vencido = (doc.dias_restantes ?? 0) < 0;
                  return (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => irADocumento(doc.camion_id)}
                      className="flex items-center justify-between gap-4 py-3 w-full text-left rounded-md hover:bg-muted/50 transition-colors px-2 -mx-2"
                      title="Abrir documentación del camión para actualizar"
                    >
                      <div className="flex flex-col">
                        <span className="font-mono font-medium text-foreground">{doc.patente}</span>
                        <span className="text-xs text-muted-foreground">{doc.tipo_documento}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col items-end">
                          <span className="text-sm text-foreground">{formatFecha(doc.fecha_vencimiento)}</span>
                          <span className="text-[11px] text-muted-foreground">
                            {vencido
                              ? `Vencido hace ${Math.abs(doc.dias_restantes ?? 0)} d`
                              : `Faltan ${doc.dias_restantes ?? 0} d`}
                          </span>
                        </div>
                        <StatusBadge
                          label={vencido ? "Vencido" : "Por vencer"}
                          tone={vencido ? "error" : "warning"}
                        />
                        <ChevronRight size={16} className="text-muted-foreground/50 shrink-0" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
