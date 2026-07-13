"use client";

// Semáforo de valoración de Bárbara (8vo feedback): tres puntos clickeables —
// verde "me gustó", amarillo "más o menos", rojo "no me gustó". Un click
// marca; volver a clickear el mismo color lo saca. Guarda al instante.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { setValoracionAction } from "../actions";

export const VALORACIONES = [
  { id: "me_gusto", label: "Me gustó", color: "bg-emerald-500", ring: "ring-emerald-500/40", hover: "hover:bg-emerald-200" },
  { id: "medio", label: "Más o menos", color: "bg-amber-400", ring: "ring-amber-400/40", hover: "hover:bg-amber-200" },
  { id: "no_gusto", label: "No me gustó", color: "bg-red-500", ring: "ring-red-500/40", hover: "hover:bg-red-200" },
] as const;

export function valoracionMeta(v: string | null | undefined) {
  return VALORACIONES.find((x) => x.id === v) ?? null;
}

export default function Semaforo({
  entrevistaId, valoracion, canWrite, size = 14, onChanged,
}: {
  entrevistaId: string;
  valoracion: string | null | undefined;
  canWrite: boolean;
  /** Diámetro de cada punto en px. */
  size?: number;
  /** Callback opcional (además del refresh) con el nuevo valor. */
  onChanged?: (v: string | null) => void;
}) {
  const router = useRouter();
  const [guardando, setGuardando] = useState(false);
  // Valor optimista para que el click se sienta instantáneo.
  const [local, setLocal] = useState<string | null | undefined>(undefined);
  const actual = local !== undefined ? local : valoracion ?? null;

  const setear = async (id: string) => {
    if (!canWrite || guardando) return;
    const nuevo = actual === id ? null : id;
    setLocal(nuevo);
    setGuardando(true);
    const res = await setValoracionAction(entrevistaId, nuevo);
    setGuardando(false);
    if ("error" in res && res.error) {
      setLocal(undefined); // revertir
      window.alert(res.error);
    } else {
      onChanged?.(nuevo);
      router.refresh();
    }
  };

  return (
    <div
      className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-1.5 py-1"
      onClick={(e) => e.stopPropagation()}
      title={canWrite ? "Valoración: verde = me gustó · amarillo = más o menos · rojo = no me gustó" : valoracionMeta(actual)?.label ?? "Sin valorar"}
    >
      {VALORACIONES.map((v) => {
        const activo = actual === v.id;
        return (
          <button
            key={v.id}
            type="button"
            disabled={!canWrite || guardando}
            onClick={() => setear(v.id)}
            aria-label={v.label}
            aria-pressed={activo}
            title={v.label}
            className={`rounded-full transition-all disabled:cursor-default ${
              activo ? `${v.color} ring-2 ${v.ring} scale-110` : `bg-muted-foreground/15 ${canWrite ? v.hover : ""}`
            }`}
            style={{ width: size, height: size }}
          />
        );
      })}
      {guardando && <Loader2 size={11} className="animate-spin text-muted-foreground" />}
    </div>
  );
}
