"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, History, Repeat2, X } from "lucide-react";
import {
  getPlanillaCambiosHistorialAction,
  type PlanillaCambioRow,
} from "./actions";

function fmtFecha(iso: string): string {
  const [y, m, d] = iso.split("-");
  return d ? `${d}/${m}/${y}` : iso;
}

/**
 * Todos los cambios de camión de todas las planillas, del más nuevo al más viejo.
 * Complementa la columna "Cambio" de la grilla, que muestra solo los del día visto.
 */
export default function CambiosDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const cerrarRef = useRef<HTMLButtonElement>(null);
  const [rows, setRows] = useState<PlanillaCambioRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let vivo = true;
    const cargar = async () => {
      setLoading(true);
      setError(null);
      const res = await getPlanillaCambiosHistorialAction();
      if (!vivo) return;
      if ("error" in res) setError(res.error);
      else setRows(res);
      setLoading(false);
    };
    void cargar();
    return () => {
      vivo = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  // Es un diálogo modal: el foco entra al panel y vuelve al botón al cerrar, y el
  // fondo no scrollea (si no, se tabula sobre la planilla que quedó tapada).
  useEffect(() => {
    if (!open) return;
    const previo = document.activeElement as HTMLElement | null;
    cerrarRef.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      previo?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  // Agrupado por fecha para que se lea como un historial.
  const porFecha = new Map<string, PlanillaCambioRow[]>();
  for (const r of rows) {
    const arr = porFecha.get(r.fecha) ?? [];
    arr.push(r);
    porFecha.set(r.fecha, arr);
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 z-[55] animate-in fade-in duration-200"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Cambios de camión"
        className="fixed top-0 right-0 h-full w-[460px] max-w-[90vw] bg-card shadow-2xl z-[60] flex flex-col animate-in slide-in-from-right duration-200"
      >
        <div className="bg-gradient-to-r from-[#0088D1] to-[#0077B6] text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Repeat2 size={16} />
            <h2 className="text-base font-bold truncate">Cambios de camión</h2>
          </div>
          <button
            ref={cerrarRef}
            onClick={onClose}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors shrink-0"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-7 w-7 border-2 border-[#0088D1] border-t-transparent" />
            </div>
          ) : error ? (
            <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-4 py-2.5 text-sm text-[#7F1D1D]">
              {error}
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <History size={32} className="mx-auto text-[#CBD5E1] mb-3" />
              <p className="text-sm">Todavía no hay cambios registrados</p>
              <p className="text-xs mt-1 text-muted-foreground/70">
                Cuando alguien cambie de camión en la planilla, va a aparecer acá
              </p>
            </div>
          ) : (
            [...porFecha.entries()].map(([fecha, items]) => (
              <div key={fecha} className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    router.push(`/viajes/planilla-diaria?fecha=${fecha}`);
                    onClose();
                  }}
                  className="flex items-center gap-2 text-xs font-bold text-[#0088D1] hover:underline"
                >
                  {fmtFecha(fecha)}
                  <span className="font-medium text-muted-foreground">
                    · {items.length} {items.length === 1 ? "cambio" : "cambios"}
                  </span>
                </button>

                {items.map((r) => (
                  <div
                    key={r.id}
                    className="border border-border rounded-lg p-3 hover:border-[#CBD5E1] transition-colors"
                  >
                    <p className="text-sm font-medium text-foreground">{r.chofer_nombre}</p>
                    <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold">
                      <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {r.patente_anterior ?? "Sin camión"}
                      </span>
                      <ArrowRight size={11} className="text-muted-foreground/70 shrink-0" />
                      <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                        {r.patente_nueva ?? "Sin camión"}
                      </span>
                    </div>
                    {r.observaciones && (
                      <p className="mt-1.5 text-xs text-muted-foreground italic">
                        {r.observaciones}
                      </p>
                    )}
                    {r.editor_nombre && (
                      <p className="mt-1.5 text-[11px] text-muted-foreground/70">
                        Guardado por {r.editor_nombre}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
