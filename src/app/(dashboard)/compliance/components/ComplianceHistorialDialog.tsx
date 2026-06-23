"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  History,
  ExternalLink,
  Loader2,
  FileX,
  CalendarClock,
  User,
} from "lucide-react";
import {
  getComplianceHistorialAction,
  getSignedUrlComplianceArchivoAction,
} from "../actions";
import type { ComplianceHistorialDoc, ComplianceRequisito } from "../types";
import { formatFecha } from "@/lib/utils";

interface Props {
  requisito: ComplianceRequisito;
  entidadLabel: string;
  chofer_id?: string;
  camion_id?: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export default function ComplianceHistorialDialog({
  requisito,
  entidadLabel,
  chofer_id,
  camion_id,
  open,
  onOpenChange,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="text-foreground text-xl flex items-center gap-2">
            <History size={18} className="text-primary" />
            Historial — {requisito.nombre}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {entidadLabel} · todas las versiones cargadas, de la más reciente a la más antigua.
          </DialogDescription>
        </DialogHeader>

        {open && (
          <HistorialBody requisito={requisito} chofer_id={chofer_id} camion_id={camion_id} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function HistorialBody({
  requisito,
  chofer_id,
  camion_id,
}: {
  requisito: ComplianceRequisito;
  chofer_id?: string;
  camion_id?: string;
}) {
  // loading arranca en true para no llamar a setState sincrónicamente dentro
  // del efecto (el componente se monta sólo cuando el diálogo se abre).
  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState<ComplianceHistorialDoc[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    let cancel = false;
    getComplianceHistorialAction({
      requisito_id: requisito.id,
      chofer_id: chofer_id ?? null,
      camion_id: camion_id ?? null,
    })
      .then((res) => {
        if (!cancel) setDocs(res);
      })
      .catch(() => {
        if (!cancel) setError("No se pudo cargar el historial");
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [requisito.id, chofer_id, camion_id]);

  const abrirArchivo = (archivo_id: string) => {
    setOpeningId(archivo_id);
    startTransition(async () => {
      const res = await getSignedUrlComplianceArchivoAction(archivo_id);
      setOpeningId(null);
      if ("url" in res && res.url) window.open(res.url, "_blank", "noopener,noreferrer");
      else setError(res.error ?? "No se pudo abrir el archivo");
    });
  };

  return (
    <div className="py-2 max-h-[60vh] overflow-y-auto">
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 size={20} className="animate-spin mr-2" />
          Cargando historial…
        </div>
      ) : error ? (
        <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] text-sm rounded-lg">
          {error}
        </div>
      ) : docs.length === 0 ? (
        <div className="text-center py-12">
          <FileX size={32} className="mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">
            Todavía no hay documentos cargados para este requisito.
          </p>
        </div>
      ) : (
        <ol className="relative space-y-3 pl-5">
          {/* línea de tiempo */}
          <span className="absolute left-[7px] top-2 bottom-2 w-px bg-border" aria-hidden />
          {docs.map((doc, idx) => (
            <li key={doc.id} className="relative">
              <span
                className={`absolute -left-5 top-1.5 size-3.5 rounded-full border-2 border-card ${
                  idx === 0 ? "bg-[#22C55E]" : "bg-muted-foreground/40"
                }`}
                aria-hidden
              />
              <div className="rounded-[8px] border border-border bg-card p-3 shadow-xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <CalendarClock size={14} className="text-primary shrink-0" />
                      Vence {formatFecha(doc.fecha_vencimiento)}
                      {idx === 0 && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-[#F0FDF4] text-[#166534] border border-[#BBF7D0]">
                          Última
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      {doc.fecha_emision && <p>Emisión: {formatFecha(doc.fecha_emision)}</p>}
                      {doc.periodo && <p>Período: {formatFecha(doc.periodo)}</p>}
                      {doc.numero && <p>N.º: {doc.numero}</p>}
                      {doc.observaciones && (
                        <p className="italic text-muted-foreground/80">“{doc.observaciones}”</p>
                      )}
                      <p className="flex items-center gap-1 text-muted-foreground/70">
                        <User size={11} />
                        {doc.cargado_por ?? "Usuario desconocido"} · cargado {formatFecha(doc.created_at)}
                      </p>
                    </div>
                  </div>
                  {doc.archivo_id && (
                    <button
                      type="button"
                      onClick={() => abrirArchivo(doc.archivo_id!)}
                      disabled={openingId === doc.archivo_id}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-semibold bg-card border border-border text-foreground hover:bg-[#E1F5FE] hover:border-[#0088D1] hover:text-primary transition-colors shrink-0"
                    >
                      {openingId === doc.archivo_id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <ExternalLink size={12} />
                      )}
                      Ver PDF
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
