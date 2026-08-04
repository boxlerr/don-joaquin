"use client";

// Pipeline ACTIVO (rediseño 14/07): solo los candidatos en proceso, en dos
// columnas — Entrevista y Preocupacional — con botones de acción explícitos
// ("Ingresó", "→ Preocupacional", "Descartar") en vez de las flechitas ‹ ›.
// Ingresados y descartados NO viven acá: son historial (la tabla de abajo),
// así el tablero no crece infinito con los años.

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  MapPin, Calendar, Loader2, UserX, UserCheck, ArrowRight, Undo2, Pencil, Trash2, ClipboardCheck,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import EntrevistaFormDialog from "./EntrevistaFormDialog";
import CvButton from "./CvButton";
import Semaforo from "./Semaforo";
import { setEtapaEntrevistaAction, deleteEntrevistaAction } from "../actions";
import type { Entrevista } from "./EntrevistasTable";

function fmtFecha(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// En celular los botones llegan a 36px de alto: a 28px el dedo erra el toque.
const accionBtn =
  "inline-flex h-9 sm:h-7 items-center gap-1 rounded-md border px-2.5 sm:px-2 text-[11px] font-semibold transition-colors disabled:opacity-40 disabled:pointer-events-none";

export default function PipelineActivo({
  entrevistas, canWrite, canDelete, onVerMas,
}: {
  /** SOLO los candidatos en etapa entrevista / preocupacional. */
  entrevistas: Entrevista[];
  canWrite: boolean;
  canDelete: boolean;
  onVerMas: (e: Entrevista) => void;
}) {
  const router = useRouter();
  const [moviendo, setMoviendo] = useState<string | null>(null);
  const [descartarDe, setDescartarDe] = useState<Entrevista | null>(null);
  const [motivo, setMotivo] = useState("");
  const [descartando, setDescartando] = useState(false);
  const [eliminarDe, setEliminarDe] = useState<Entrevista | null>(null);
  const [deleting, setDeleting] = useState(false);

  const mover = async (e: Entrevista, etapa: string) => {
    setMoviendo(e.id);
    const res = await setEtapaEntrevistaAction(e.id, etapa);
    setMoviendo(null);
    if ("error" in res && res.error) window.alert(res.error);
    else router.refresh();
  };

  const confirmarDescarte = async () => {
    if (!descartarDe) return;
    setDescartando(true);
    const res = await setEtapaEntrevistaAction(descartarDe.id, "descartado", motivo);
    setDescartando(false);
    setDescartarDe(null);
    setMotivo("");
    if ("error" in res && res.error) window.alert(res.error);
    else router.refresh();
  };

  const confirmarEliminar = async () => {
    if (!eliminarDe) return;
    setDeleting(true);
    const res = await deleteEntrevistaAction(eliminarDe.id);
    setDeleting(false);
    setEliminarDe(null);
    if ("error" in res && res.error) window.alert(res.error);
    else router.refresh();
  };

  const columnas = [
    {
      id: "entrevista",
      label: "En entrevista",
      hint: "Recién entrevistados: se define si avanzan",
      badge: "bg-blue-50 text-blue-700 border-blue-200/60",
    },
    {
      id: "preocupacional",
      label: "En preocupacional",
      hint: "Mandados a hacer el examen médico",
      badge: "bg-amber-50 text-amber-700 border-amber-200/60",
    },
  ];

  const card = (e: Entrevista, col: string) => {
    const ocupado = moviendo === e.id;
    return (
      <div
        key={e.id}
        onClick={() => onVerMas(e)}
        className="cursor-pointer rounded-lg border border-border bg-card p-3 shadow-sm transition-colors hover:border-primary/40"
        title={`Ver la ficha de ${e.nombre}`}
      >
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={(ev) => { ev.stopPropagation(); onVerMas(e); }}
            className="rounded text-left text-sm font-semibold leading-tight text-foreground hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
          >
            {e.nombre}
          </button>
          <div className="flex shrink-0 items-center gap-1" onClick={(ev) => ev.stopPropagation()}>
            <Semaforo entrevistaId={e.id} etapa={e.etapa} nombre={e.nombre} canWrite={canWrite} size={11} />
            {canWrite && (
              <EntrevistaFormDialog entrevista={e}>
                <button
                  type="button"
                  title="Editar"
                  aria-label="Editar"
                  className="inline-flex size-9 items-center justify-center rounded text-muted-foreground/60 hover:text-foreground sm:size-6"
                >
                  <Pencil size={13} />
                </button>
              </EntrevistaFormDialog>
            )}
            {canDelete && (
              <button
                type="button"
                title="Eliminar"
                aria-label="Eliminar"
                onClick={() => setEliminarDe(e)}
                className="inline-flex size-9 items-center justify-center rounded text-muted-foreground/60 hover:text-destructive sm:size-6"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
          {(e.localidad || e.edad != null) && (
            <span className="inline-flex items-center gap-1"><MapPin size={10} />{e.localidad || "—"}{e.edad != null ? ` · ${e.edad} años` : ""}</span>
          )}
          {e.fecha_entrevista && (
            <span className="inline-flex items-center gap-1"><Calendar size={10} />{fmtFecha(e.fecha_entrevista)}</span>
          )}
          <span onClick={(ev) => ev.stopPropagation()}>
            <CvButton entrevistaId={e.id} nombre={e.nombre} count={e.cv_count ?? 0} canWrite={canWrite} />
          </span>
        </div>
        {e.observaciones && (
          <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground/80">{e.observaciones}</p>
        )}
        {col === "preocupacional" && e.preocupacional_nota && (
          <p className="mt-1 line-clamp-1 text-[11px] italic text-amber-600">Preocupacional: {e.preocupacional_nota}</p>
        )}

        {/* Acciones explícitas: qué puede pasar con este candidato */}
        {canWrite && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-2" onClick={(ev) => ev.stopPropagation()}>
            {col === "entrevista" && (
              <button
                type="button"
                disabled={ocupado}
                onClick={() => mover(e, "preocupacional")}
                className={`${accionBtn} border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100`}
                title="Mandarlo a hacer el examen preocupacional"
              >
                {ocupado ? <Loader2 size={11} className="animate-spin" /> : <ClipboardCheck size={11} />}
                Preocupacional <ArrowRight size={10} />
              </button>
            )}
            <button
              type="button"
              disabled={ocupado}
              onClick={() => mover(e, "ingresado")}
              className={`${accionBtn} border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}
              title="Ingresó al transporte"
            >
              {ocupado ? <Loader2 size={11} className="animate-spin" /> : <UserCheck size={11} />}
              Ingresó
            </button>
            <button
              type="button"
              disabled={ocupado}
              onClick={() => { setDescartarDe(e); setMotivo(""); }}
              className={`${accionBtn} border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100`}
              title="No sigue: queda registrado con su motivo"
            >
              <UserX size={11} /> Descartar
            </button>
            {col === "preocupacional" && (
              <button
                type="button"
                disabled={ocupado}
                onClick={() => mover(e, "entrevista")}
                className={`${accionBtn} ml-auto border-border bg-card text-muted-foreground hover:text-foreground`}
                title="Volver a la etapa de entrevista"
              >
                <Undo2 size={11} /> Volver
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2">
        {columnas.map((col) => {
          const items = entrevistas.filter((e) => e.etapa === col.id);
          return (
            <div key={col.id} className="rounded-xl border border-border bg-muted/30 p-2.5">
              <div className="mb-2 flex items-center justify-between px-1">
                <div>
                  <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${col.badge}`}>
                    {col.label}
                  </span>
                  <p className="mt-1 text-[10px] text-muted-foreground">{col.hint}</p>
                </div>
                <span className="text-lg font-bold text-foreground">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.length === 0 ? (
                  <p className="py-5 text-center text-[11px] text-muted-foreground/60">
                    Nadie en esta etapa.
                  </p>
                ) : (
                  items.map((e) => card(e, col.id))
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
              <label className="text-sm font-bold text-foreground">¿Por qué no se contrata? (opcional)</label>
              <textarea
                rows={3} autoFocus
                placeholder="Ej: pidió sueldo fuera de rango, no tiene la licencia, no se presentó…"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className="w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              <p className="text-[11px] text-muted-foreground">Pasa al historial con el motivo — si vuelve en unos años, queda el porqué.</p>
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
        loading={deleting}
      />
    </>
  );
}
