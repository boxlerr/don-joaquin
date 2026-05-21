"use client";

import { useState, useEffect } from "react";
import { X, Clock, User, Plus, RefreshCw, CheckCircle2, Banknote, MessageSquare, ArrowRight } from "lucide-react";
import { getViajeAuditTrail, type AuditTrailEntry } from "../actions";

interface AuditTrailDrawerProps {
  viajeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ESTADO_LABELS: Record<string, string> = {
  pendiente: "Pendiente",
  en_curso: "En Curso",
  cerrado: "Cerrado",
  cancelado: "Cancelado",
};

const MEDIO_LABELS: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  cheque: "Cheque",
  otro: "Otro",
};

function EntryIcon({ accion, valores_nuevos }: { accion: string; valores_nuevos: Record<string, unknown> }) {
  if (accion === "crear") return <Plus size={14} className="text-green-600" />;
  if (accion === "cambio_estado") {
    const estado = valores_nuevos?.estado as string;
    if (estado === "cerrado") return <CheckCircle2 size={14} className="text-muted-foreground" />;
    if (estado === "en_curso") return <RefreshCw size={14} className="text-blue-600" />;
    return <RefreshCw size={14} className="text-amber-600" />;
  }
  return <RefreshCw size={14} className="text-muted-foreground" />;
}

function EntryContent({ entry }: { entry: AuditTrailEntry }) {
  const nv = entry.valores_nuevos ?? {};
  const va = entry.valores_anteriores ?? {};

  if (entry.accion === "crear") {
    return (
      <p className="text-sm font-semibold text-foreground">Viaje creado</p>
    );
  }

  if (entry.accion === "cambio_estado") {
    const estadoAntes = (va.estado as string) ?? null;
    const estadoDespues = (nv.estado as string) ?? null;
    const cobrado = nv.cobrado as boolean | undefined;
    const medioCobro = nv.medio_cobro as string | undefined;
    const observaciones = nv.observaciones as string | undefined;

    return (
      <div className="space-y-1.5">
        {/* Transición de estado */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-semibold text-foreground">Cambio de estado</span>
          {estadoAntes && estadoDespues && (
            <div className="flex items-center gap-1 text-xs">
              <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                {ESTADO_LABELS[estadoAntes] ?? estadoAntes}
              </span>
              <ArrowRight size={11} className="text-muted-foreground/70" />
              <span className={`px-1.5 py-0.5 rounded font-medium ${
                estadoDespues === "cerrado" ? "bg-slate-800 text-white" :
                estadoDespues === "en_curso" ? "bg-blue-100 text-blue-700" :
                "bg-amber-100 text-amber-700"
              }`}>
                {ESTADO_LABELS[estadoDespues] ?? estadoDespues}
              </span>
            </div>
          )}
        </div>

        {/* Info de cobro si cerró el viaje */}
        {estadoDespues === "cerrado" && cobrado !== undefined && (
          <div className={`flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-md w-fit ${
            cobrado ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
          }`}>
            <Banknote size={12} />
            {cobrado
              ? `Cobrado${medioCobro ? ` · ${MEDIO_LABELS[medioCobro] ?? medioCobro}` : ""}`
              : "Pago pendiente"}
          </div>
        )}

        {/* Observaciones */}
        {observaciones && (
          <div className="flex items-start gap-1.5 text-xs text-muted-foreground bg-muted/40 rounded-md px-2 py-1.5 border border-border">
            <MessageSquare size={11} className="text-muted-foreground/70 mt-0.5 shrink-0" />
            <span className="italic">{observaciones}</span>
          </div>
        )}
      </div>
    );
  }

  if (entry.accion === "actualizar") {
    return <p className="text-sm font-semibold text-foreground">Datos actualizados</p>;
  }

  if (entry.accion === "eliminar") {
    return <p className="text-sm font-semibold text-red-600">Viaje eliminado</p>;
  }

  return <p className="text-sm font-semibold text-foreground">{entry.accion}</p>;
}

export default function AuditTrailDrawer({ viajeId, open, onOpenChange }: AuditTrailDrawerProps) {
  const [entries, setEntries] = useState<AuditTrailEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getViajeAuditTrail(viajeId).then((result) => {
      if ("data" in result && result.data) setEntries(result.data);
      setLoading(false);
    });
  }, [open, viajeId]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="fixed right-0 top-0 h-full w-[min(480px,calc(100vw-2rem))] bg-card shadow-2xl border-l border-border flex flex-col animate-in slide-in-from-right"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-full bg-[#E1F5FE] text-primary inline-flex items-center justify-center">
              <Clock size={18} />
            </div>
            <div>
              <h2 className="text-foreground font-semibold">Historial del viaje</h2>
              <p className="text-muted-foreground text-xs">Todos los cambios registrados</p>
            </div>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="size-8 rounded-full text-muted-foreground hover:bg-muted inline-flex items-center justify-center"
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground/70 text-sm">
              Cargando historial...
            </div>
          ) : entries.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground/70 text-sm">
              Sin cambios registrados
            </div>
          ) : (
            <div className="relative">
              {/* línea vertical */}
              <div className="absolute left-[18px] top-2 bottom-2 w-px bg-[#E2E8F0]" />

              <div className="space-y-5">
                {entries.map((entry) => (
                  <div key={entry.id} className="flex gap-4">
                    {/* Ícono en la línea */}
                    <div className="size-9 rounded-full bg-card border-2 border-border flex items-center justify-center shrink-0 z-10">
                      <EntryIcon accion={entry.accion} valores_nuevos={entry.valores_nuevos ?? {}} />
                    </div>

                    {/* Contenido */}
                    <div className="flex-1 pb-1 min-w-0">
                      <EntryContent entry={entry} />

                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="text-[11px] text-muted-foreground/70">
                          {new Date(entry.created_at).toLocaleString("es-AR", {
                            day: "2-digit", month: "2-digit", year: "numeric",
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </span>
                        {entry.usuario && (
                          <>
                            <span className="text-[#E2E8F0]">·</span>
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <User size={10} className="text-primary" />
                              {entry.usuario.apellido}, {entry.usuario.nombre}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
