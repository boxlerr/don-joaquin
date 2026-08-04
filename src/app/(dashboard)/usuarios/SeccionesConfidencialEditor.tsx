"use client";

import { useState, useTransition } from "react";
import { setSeccionConfidencialAction } from "./actions";
import { type SeccionCodigo } from "@/lib/secciones";
import { ShieldAlert, Lock, LockOpen, AlertCircle } from "lucide-react";
import { SIDEBAR_ARBOL } from "./sidebar-tree";

interface Props {
  /** Confidencialidad efectiva actual por subsección (DB > catálogo de código). */
  initial: Record<SeccionCodigo, boolean>;
}

export default function SeccionesConfidencialEditor({ initial }: Props) {
  const [conf, setConf] = useState<Record<SeccionCodigo, boolean>>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<SeccionCodigo | null>(null);
  const [isPending, startTransition] = useTransition();

  const toggle = (seccion: SeccionCodigo) => {
    const prev = !!conf[seccion];
    const next = !prev;
    setError(null);
    setSaving(seccion);
    setConf((c) => ({ ...c, [seccion]: next }));

    startTransition(async () => {
      const res = await setSeccionConfidencialAction(seccion, next);
      setSaving(null);
      if ("error" in res) {
        setError(res.error);
        setConf((c) => ({ ...c, [seccion]: prev })); // revertir
      }
    });
  };

  const Fila = ({ seccion, label, indent }: { seccion: SeccionCodigo; label: string; indent?: boolean }) => {
    const on = !!conf[seccion];
    const isSaving = saving === seccion && isPending;
    return (
      <div className={`flex items-center justify-between gap-2 py-1.5 max-md:py-2.5 pr-3 ${indent ? "pl-7" : "pl-3"}`}>
        <span className="flex items-center gap-1.5 text-xs text-foreground min-w-0">
          {on ? (
            <Lock size={12} className="text-amber-600 shrink-0" />
          ) : (
            <LockOpen size={12} className="text-muted-foreground/50 shrink-0" />
          )}
          <span className="truncate">{label}</span>
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[10px] font-semibold w-[74px] text-right ${on ? "text-amber-600" : "text-muted-foreground/50"}`}>
            {on ? "Confidencial" : "Según el rol"}
          </span>
          {/* El botón es la zona táctil (36px en celular); la pastilla de adentro
              es lo que se ve. En desktop mide lo mismo que ella. */}
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label={`${label}: ${on ? "confidencial" : "según el rol"}`}
            disabled={isSaving}
            onClick={() => toggle(seccion)}
            className={`inline-flex size-9 shrink-0 items-center justify-center rounded-md sm:size-auto ${
              isSaving ? "opacity-60" : "hover:opacity-90"
            }`}
          >
            <span
              className={`relative block h-5 w-9 shrink-0 rounded-full transition-colors ${
                on ? "bg-amber-500" : "bg-muted-foreground/30"
              }`}
            >
              <span
                className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-all ${on ? "left-[18px]" : "left-0.5"}`}
              />
            </span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-card rounded-[8px] border border-border shadow-sm">
      <div className="px-4 sm:px-5 py-4 border-b border-border space-y-2">
        <div className="flex items-center gap-2">
          <ShieldAlert size={16} className="text-amber-600 shrink-0" />
          <h2 className="text-foreground text-sm font-semibold">Secciones confidenciales</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Prendé el switch de una sección para hacerla <b className="text-foreground">confidencial</b>:
          queda <b className="text-foreground">cerrada para todos</b> salvo el Administrador — aunque el
          rol tenga Edición. Ideal para lo sensible (sueldos, caja, métricas). Está organizado igual
          que el menú lateral.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 sm:px-5 py-2 bg-red-50 border-b border-red-200 text-red-600 text-xs">
          <AlertCircle size={13} className="shrink-0" />
          {error}
        </div>
      )}

      <div className="p-3 sm:p-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
        {SIDEBAR_ARBOL.map((grupo) => (
          <div key={grupo.label} className="rounded-lg border border-border overflow-hidden self-start">
            <div className="px-3 py-2 bg-muted/40 border-b border-border flex items-center gap-1.5">
              <span className="size-1.5 rounded-full" style={{ background: grupo.color }} />
              <span className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: grupo.color }}>
                {grupo.label}
              </span>
            </div>
            <div className="divide-y divide-border">
              {grupo.paginas.map((pagina) =>
                pagina.subs ? (
                  <div key={pagina.label}>
                    <div className="px-3 py-1.5 text-[11px] font-semibold text-foreground bg-muted/20 border-b border-border/60">
                      {pagina.label}
                    </div>
                    <div className="divide-y divide-border/60">
                      {pagina.subs.map((sub) => (
                        <Fila key={sub.seccion} seccion={sub.seccion} label={sub.label} indent />
                      ))}
                    </div>
                  </div>
                ) : (
                  <Fila key={pagina.seccion} seccion={pagina.seccion!} label={pagina.label} />
                ),
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
