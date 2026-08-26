"use client";

import { useEffect, useState } from "react";
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
  getComplianceArchivoParaVerAction,
} from "../actions";
import VisorArchivo, { type ArchivoParaVer } from "@/components/ui/VisorArchivo";
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
          <DialogTitle className="text-foreground text-lg sm:text-xl flex items-center gap-2">
            <History size={18} className="shrink-0 text-primary" />
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
  // El papel se mira dentro de la aplicación, encima del historial: irse a otra
  // pestaña para ver un PDF y volver a buscar la fila es el camino largo.
  const [visor, setVisor] = useState<{ archivo: ArchivoParaVer | null; titulo: string } | null>(
    null,
  );

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

  const abrirArchivo = async (archivo_id: string, titulo: string) => {
    setOpeningId(archivo_id);
    const res = await getComplianceArchivoParaVerAction(archivo_id);
    setOpeningId(null);
    if ("archivo" in res) setVisor({ archivo: res.archivo, titulo });
    else setError(res.error);
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
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-foreground">
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
                  {/* Todos los papeles de esa presentación, no solo el primero:
                      un documento puede tener frente y dorso, o el papel viejo y
                      el de la renovación archivados juntos. */}
                  {doc.archivos.length > 0 ? (
                    <div className="flex shrink-0 flex-col gap-1 sm:max-w-[230px]">
                      {doc.archivos.map((a) => (
                        <button
                          key={a.archivo_id}
                          type="button"
                          onClick={() =>
                            void abrirArchivo(
                              a.archivo_id,
                              `${requisito.nombre} · vence ${formatFecha(doc.fecha_vencimiento)}`,
                            )
                          }
                          disabled={openingId === a.archivo_id}
                          title={a.nombre ?? "Ver el papel"}
                          className="inline-flex items-center gap-1.5 h-8 max-md:h-9 px-3 rounded-md text-xs font-semibold bg-card border border-border text-foreground hover:bg-[#E1F5FE] hover:border-[#0088D1] hover:text-primary transition-colors"
                        >
                          {openingId === a.archivo_id ? (
                            <Loader2 size={12} className="animate-spin shrink-0" />
                          ) : (
                            <ExternalLink size={12} className="shrink-0" />
                          )}
                          <span className="truncate">{a.nombre ?? "Ver el papel"}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    // Que se note la diferencia entre "cargaron la fecha a mano" y
                    // "está el papel": es la mitad de lo que se viene a mirar acá.
                    <span className="shrink-0 text-[11px] text-muted-foreground/70">
                      Sin papel cargado
                    </span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      <VisorArchivo
        archivo={visor?.archivo ?? null}
        titulo={visor?.titulo}
        open={visor !== null}
        onOpenChange={(o) => !o && setVisor(null)}
      />
    </div>
  );
}
