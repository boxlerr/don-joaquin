"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Pencil, MapPin, Calendar, Loader2, Trash2, UserX } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import EntrevistaFormDialog from "./EntrevistaFormDialog";
import CvButton from "./CvButton";
import { setEtapaEntrevistaAction, deleteEntrevistaAction } from "../actions";
import type { Entrevista } from "./EntrevistasTable";

const ETAPAS: { id: string; label: string; badge: string }[] = [
  { id: "nuevo", label: "Nuevo", badge: "bg-slate-100 text-slate-700 border-slate-200" },
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

const flechaBtn =
  "size-7 rounded-md border border-border bg-card text-foreground inline-flex items-center justify-center hover:bg-muted hover:border-muted-foreground/30 disabled:opacity-30 disabled:pointer-events-none transition-colors";

export default function EntrevistasBoard({
  entrevistas, canWrite, canDelete,
}: {
  entrevistas: Entrevista[];
  canWrite: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [moving, setMoving] = useState<string | null>(null);
  const [descartarDe, setDescartarDe] = useState<Entrevista | null>(null);
  const [motivo, setMotivo] = useState("");
  const [descartando, setDescartando] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [eliminarDe, setEliminarDe] = useState<Entrevista | null>(null);

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

  const confirmarDescarte = async () => {
    if (!descartarDe) return;
    setDescartando(true);
    const res = await setEtapaEntrevistaAction(descartarDe.id, "descartado", motivo);
    setDescartando(false);
    setDescartarDe(null);
    setMotivo("");
    if (!("error" in res && res.error)) router.refresh();
    else window.alert(res.error);
  };

  const confirmarEliminar = async () => {
    if (!eliminarDe) return;
    setDeletingId(eliminarDe.id);
    const res = await deleteEntrevistaAction(eliminarDe.id);
    setDeletingId(null);
    setEliminarDe(null);
    if (!("error" in res && res.error)) router.refresh();
    else window.alert(res.error);
  };

  return (
    <>
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
                        <div className="flex items-center gap-0.5 shrink-0">
                          {canWrite && (
                            <EntrevistaFormDialog entrevista={e}>
                              <button type="button" title="Editar" className="text-muted-foreground/60 hover:text-foreground p-0.5"><Pencil size={13} /></button>
                            </EntrevistaFormDialog>
                          )}
                          {canDelete && (
                            <button type="button" title="Eliminar" disabled={deletingId === e.id} onClick={() => setEliminarDe(e)}
                              className="text-muted-foreground/60 hover:text-destructive p-0.5 disabled:opacity-40">
                              {deletingId === e.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                            </button>
                          )}
                        </div>
                      </div>
                      {e.puesto && <p className="text-[11px] text-primary font-medium mt-0.5">{e.puesto}</p>}
                      <div className="text-[11px] text-muted-foreground mt-1 space-y-0.5">
                        {(e.localidad || e.edad != null) && (
                          <div className="flex items-center gap-1"><MapPin size={10} className="shrink-0" />{e.localidad || "—"}{e.edad != null ? ` · ${e.edad} años` : ""}</div>
                        )}
                        {e.fecha_entrevista && (
                          <div className="flex items-center gap-1"><Calendar size={10} className="shrink-0" />{fmtFecha(e.fecha_entrevista)}</div>
                        )}
                        {col.id === "descartado" && e.motivo_descarte && (
                          <div className="text-rose-600/90 italic pt-0.5">Motivo: {e.motivo_descarte}</div>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-1 mt-2">
                        <CvButton entrevistaId={e.id} nombre={e.nombre} count={e.cv_count ?? 0} canWrite={canWrite} />
                        {canWrite && (
                          <div className="flex items-center gap-1">
                            {col.id !== "descartado" && (
                              <button type="button" title="Descartar" onClick={() => { setDescartarDe(e); setMotivo(""); }}
                                className="size-7 rounded-md border border-rose-200 bg-rose-50 text-rose-600 inline-flex items-center justify-center hover:bg-rose-100 transition-colors">
                                <UserX size={14} />
                              </button>
                            )}
                            <button type="button" title="Etapa anterior" disabled={colIdx === 0 || moving === e.id} onClick={() => mover(e, -1)} className={flechaBtn}>
                              {moving === e.id ? <Loader2 size={13} className="animate-spin" /> : <ChevronLeft size={15} />}
                            </button>
                            <button type="button" title="Etapa siguiente" disabled={colIdx === ETAPAS.length - 1 || moving === e.id} onClick={() => mover(e, 1)} className={flechaBtn}>
                              <ChevronRight size={15} />
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

      {descartarDe && (
        <Dialog open onOpenChange={(o) => { if (!o && !descartando) { setDescartarDe(null); setMotivo(""); } }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><UserX size={18} className="text-rose-600" /> Descartar a {descartarDe.nombre}</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">¿Por qué no se contrata? (opcional)</label>
              <textarea
                rows={3} autoFocus
                placeholder="Ej: pidió sueldo fuera de rango, no tiene la licencia, no se presentó…"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-y"
              />
              <p className="text-[11px] text-muted-foreground">Queda registrado y se muestra en la lista, separado abajo.</p>
            </div>
            <DialogFooter showCloseButton>
              <Button variant="destructive" disabled={descartando} onClick={confirmarDescarte}>
                {descartando ? <Loader2 className="animate-spin" /> : <UserX size={14} />} Descartar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <ConfirmDialog
        open={!!eliminarDe}
        onOpenChange={(o) => { if (!o) setEliminarDe(null); }}
        title="Eliminar candidato"
        description={eliminarDe ? <>Se va a eliminar a <strong className="text-foreground">{eliminarDe.nombre}</strong> y sus datos. Esta acción no se puede deshacer.</> : null}
        onConfirm={confirmarEliminar}
        loading={deletingId != null}
      />
    </>
  );
}
