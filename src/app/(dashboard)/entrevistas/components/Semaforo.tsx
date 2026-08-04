"use client";

// Semáforo de ETAPA (21/07): los tres puntos marcan en qué etapa del pipeline
// está el candidato y, al clickearlos, lo mueven — así la lista (Tabla) y el
// Tablero quedan siempre sincronizados, porque ambos escriben la misma columna
// `etapa` y refrescan.
//   rojo = Descartado · amarillo = En preocupacional · verde = Ingresó
//   sin marcar = En entrevista (el punto de entrada del pipeline).
// Volver a clickear el punto activo lo devuelve a "En entrevista".
// Descartar es terminal y pide el motivo (igual que el botón del tablero).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserX } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { setEtapaEntrevistaAction } from "../actions";

// Orden de semáforo (izq→der): rojo → amarillo → verde, de "peor" a "mejor".
export const ETAPA_PUNTOS = [
  { etapa: "descartado", label: "Descartado", color: "bg-red-500", ring: "ring-red-500/40", hover: "hover:bg-red-200" },
  { etapa: "preocupacional", label: "En preocupacional", color: "bg-amber-400", ring: "ring-amber-400/40", hover: "hover:bg-amber-200" },
  { etapa: "ingresado", label: "Ingresó", color: "bg-emerald-500", ring: "ring-emerald-500/40", hover: "hover:bg-emerald-200" },
] as const;

export function etapaPuntoMeta(etapa: string | null | undefined) {
  return ETAPA_PUNTOS.find((x) => x.etapa === etapa) ?? null;
}

export default function Semaforo({
  entrevistaId, etapa, nombre = "", canWrite, size = 14, onChanged,
}: {
  entrevistaId: string;
  /** Etapa actual del pipeline. `null` / "entrevista" = sin punto marcado. */
  etapa: string | null | undefined;
  /** Nombre del candidato, para el título del diálogo de descarte. */
  nombre?: string;
  canWrite: boolean;
  /** Diámetro de cada punto en px. */
  size?: number;
  /** Callback opcional (además del refresh) con la nueva etapa. */
  onChanged?: (etapa: string) => void;
}) {
  const router = useRouter();
  const [guardando, setGuardando] = useState(false);
  // Valor optimista para que el click se sienta instantáneo. Solo se setea con
  // el propio click de este semáforo (siempre a la etapa que el server va a
  // confirmar), así que no necesita resetearse: tras el refresh coincide con el
  // prop, y si la etapa cambia por otro lado `local` sigue undefined y gana el prop.
  const [local, setLocal] = useState<string | undefined>(undefined);
  const [descartarOpen, setDescartarOpen] = useState(false);
  const [motivo, setMotivo] = useState("");
  const actual = local ?? etapa ?? "entrevista";

  const mover = async (destino: string, motivoDescarte?: string) => {
    if (!canWrite || guardando) return;
    setLocal(destino);
    setGuardando(true);
    const res = await setEtapaEntrevistaAction(entrevistaId, destino, motivoDescarte);
    setGuardando(false);
    if ("error" in res && res.error) {
      setLocal(undefined); // revertir
      window.alert(res.error);
    } else {
      onChanged?.(destino);
      router.refresh();
    }
  };

  const clickPunto = (destino: string) => {
    if (!canWrite || guardando) return;
    // Volver a clickear el punto activo lo devuelve a "En entrevista".
    if (actual === destino) { void mover("entrevista"); return; }
    // Descartar es terminal: pedimos el motivo antes (igual que el tablero).
    if (destino === "descartado") { setMotivo(""); setDescartarOpen(true); return; }
    void mover(destino);
  };

  const confirmarDescarte = async () => {
    setDescartarOpen(false);
    await mover("descartado", motivo.trim() || undefined);
    setMotivo("");
  };

  return (
    <div
      className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-1.5 py-1"
      onClick={(e) => e.stopPropagation()}
      title={
        canWrite
          ? "Etapa: rojo = descartado · amarillo = en preocupacional · verde = ingresó · sin marcar = en entrevista"
          : etapaPuntoMeta(actual)?.label ?? "En entrevista"
      }
    >
      {ETAPA_PUNTOS.map((p) => {
        const activo = actual === p.etapa;
        return (
          <button
            key={p.etapa}
            type="button"
            disabled={!canWrite || guardando}
            onClick={() => clickPunto(p.etapa)}
            aria-label={p.label}
            aria-pressed={activo}
            title={canWrite ? (activo ? `${p.label} — click para volver a Entrevista` : `Mover a ${p.label}`) : p.label}
            // El punto mide 10-14px: en el celular eso no se acierta con el dedo,
            // así que cuando se puede clickear el botón crece a 36px y el punto
            // (el <span>) queda del mismo tamaño de siempre adentro.
            className={`inline-flex items-center justify-center rounded-full p-0 disabled:cursor-default size-[var(--dot)] ${
              canWrite ? "max-md:size-9" : ""
            }`}
            style={{ "--dot": `${size}px` } as React.CSSProperties}
          >
            <span
              className={`block size-[var(--dot)] shrink-0 rounded-full transition-all ${
                activo ? `${p.color} ring-2 ${p.ring} scale-110` : `bg-muted-foreground/15 ${canWrite ? p.hover : ""}`
              }`}
            />
          </button>
        );
      })}
      {guardando && <Loader2 size={11} className="animate-spin text-muted-foreground" />}

      {canWrite && (
        <Dialog open={descartarOpen} onOpenChange={(o) => { if (!guardando) { setDescartarOpen(o); if (!o) setMotivo(""); } }}>
          <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserX size={18} className="text-rose-600" /> Descartar{nombre ? ` a ${nombre}` : ""}
              </DialogTitle>
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
              <Button variant="destructive" onClick={confirmarDescarte}>
                <UserX size={14} /> Descartar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
