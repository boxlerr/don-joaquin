"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Pencil, MapPin, Calendar, Loader2 } from "lucide-react";
import EntrevistaFormDialog from "./EntrevistaFormDialog";
import CvButton from "./CvButton";
import { setEtapaEntrevistaAction } from "../actions";
import type { Entrevista } from "./EntrevistasTable";

const ETAPAS: { id: string; label: string; badge: string }[] = [
  { id: "nuevo", label: "CV recibido", badge: "bg-slate-100 text-slate-700 border-slate-200" },
  { id: "entrevista", label: "Entrevista", badge: "bg-blue-50 text-blue-700 border-blue-200/60" },
  { id: "preocupacional", label: "Preocupacional", badge: "bg-amber-50 text-amber-700 border-amber-200/60" },
  { id: "ingresado", label: "Ingresó", badge: "bg-emerald-50 text-emerald-700 border-emerald-200/60" },
  { id: "descartado", label: "Descartado", badge: "bg-rose-50 text-rose-700 border-rose-200/60" },
];

function fmtFecha(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export default function EntrevistasBoard({
  entrevistas, canWrite,
}: {
  entrevistas: Entrevista[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [moving, setMoving] = useState<string | null>(null);

  const mover = async (e: Entrevista, dir: number) => {
    const idx = ETAPAS.findIndex((x) => x.id === (e.etapa ?? "nuevo"));
    const next = ETAPAS[idx + dir];
    if (!next) return;
    setMoving(e.id);
    const res = await setEtapaEntrevistaAction(e.id, next.id);
    setMoving(null);
    if (!("error" in res && res.error)) router.refresh();
    else window.alert(res.error);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 items-start">
      {ETAPAS.map((col, colIdx) => {
        const items = entrevistas.filter((e) => (e.etapa ?? "nuevo") === col.id);
        return (
          <div key={col.id} className="bg-muted/30 rounded-xl border border-border p-2">
            <div className="flex items-center justify-between px-1.5 py-1 mb-1.5">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${col.badge}`}>{col.label}</span>
              <span className="text-[11px] font-semibold text-muted-foreground">{items.length}</span>
            </div>
            <div className="space-y-2">
              {items.length === 0 ? (
                <p className="text-[11px] text-muted-foreground/50 text-center py-4">—</p>
              ) : (
                items.map((e) => (
                  <div key={e.id} className="bg-card border border-border rounded-lg p-2.5 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-sm text-foreground leading-tight">{e.nombre}</span>
                      {canWrite && (
                        <EntrevistaFormDialog entrevista={e}>
                          <button type="button" title="Editar" className="text-muted-foreground/60 hover:text-foreground shrink-0"><Pencil size={13} /></button>
                        </EntrevistaFormDialog>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1 space-y-0.5">
                      {(e.localidad || e.edad != null) && (
                        <div className="flex items-center gap-1"><MapPin size={10} className="shrink-0" />{e.localidad || "—"}{e.edad != null ? ` · ${e.edad} años` : ""}</div>
                      )}
                      {e.fecha_entrevista && (
                        <div className="flex items-center gap-1"><Calendar size={10} className="shrink-0" />{fmtFecha(e.fecha_entrevista)}</div>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-1 mt-2">
                      <CvButton entrevistaId={e.id} nombre={e.nombre} count={e.cv_count ?? 0} canWrite={canWrite} />
                      {canWrite && (
                        <div className="flex items-center gap-0.5">
                          <button type="button" title="Etapa anterior" disabled={colIdx === 0 || moving === e.id} onClick={() => mover(e, -1)}
                            className="p-1 rounded text-muted-foreground/60 hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none">
                            {moving === e.id ? <Loader2 size={13} className="animate-spin" /> : <ChevronLeft size={14} />}
                          </button>
                          <button type="button" title="Etapa siguiente" disabled={colIdx === ETAPAS.length - 1 || moving === e.id} onClick={() => mover(e, 1)}
                            className="p-1 rounded text-muted-foreground/60 hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none">
                            <ChevronRight size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
