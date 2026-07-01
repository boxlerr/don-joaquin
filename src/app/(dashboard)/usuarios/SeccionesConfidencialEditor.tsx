"use client";

import { useMemo, useState, useTransition } from "react";
import { setSeccionConfidencialAction } from "./actions";
import type { AreaCodigo } from "@/lib/auth";
import { SECCIONES, seccionesDeArea, type SeccionCodigo } from "@/lib/secciones";
import { areaTitulo } from "./area-meta";
import { ShieldAlert, Lock, LockOpen, AlertCircle } from "lucide-react";

interface Area {
  codigo: AreaCodigo;
  nombre: string;
  orden: number;
}

interface Props {
  areas: Area[];
  /** Confidencialidad efectiva actual por subsección (DB > catálogo de código). */
  initial: Record<SeccionCodigo, boolean>;
}

// Áreas que tienen al menos una subsección, en orden.
const AREAS_CON_SECCIONES = [...new Set(SECCIONES.map((s) => s.area))];

export default function SeccionesConfidencialEditor({ areas, initial }: Props) {
  const [conf, setConf] = useState<Record<SeccionCodigo, boolean>>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<SeccionCodigo | null>(null);
  const [isPending, startTransition] = useTransition();

  const areaOrden = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of areas) m[a.codigo] = a.orden;
    return m;
  }, [areas]);

  const areasMostrar = useMemo(
    () => [...AREAS_CON_SECCIONES].sort((a, b) => (areaOrden[a] ?? 99) - (areaOrden[b] ?? 99)),
    [areaOrden],
  );

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

  return (
    <div className="bg-card rounded-[8px] border border-border shadow-sm">
      <div className="px-5 py-4 border-b border-border space-y-2">
        <div className="flex items-center gap-2">
          <ShieldAlert size={16} className="text-amber-600" />
          <h2 className="text-foreground text-sm font-semibold">Secciones confidenciales</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Una sección marcada <b className="text-foreground">confidencial</b> arranca{" "}
          <b className="text-foreground">cerrada</b> para todos los roles no-admin (aunque tengan el
          área): hay que otorgarla a mano en <b className="text-foreground">Permisos finos por
          subsección</b>. Los admin (Nicolás y Bárbara) siempre la ven. Ideal para lo sensible
          (sueldos, caja, facturación) — se ajusta acá sin tocar código.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-5 py-2 bg-red-50 border-b border-red-200 text-red-600 text-xs">
          <AlertCircle size={13} />
          {error}
        </div>
      )}

      <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
        {areasMostrar.map((area) => {
          const subs = seccionesDeArea(area);
          if (subs.length === 0) return null;
          return (
            <div key={area} className="rounded-lg border border-border overflow-hidden">
              <div className="px-3 py-2 bg-muted/40 border-b border-border">
                <span className="text-xs font-semibold text-foreground">{areaTitulo(area)}</span>
              </div>
              <div className="divide-y divide-border">
                {subs.map((s) => {
                  const on = !!conf[s.codigo];
                  const isSaving = saving === s.codigo && isPending;
                  return (
                    <div key={s.codigo} className="flex items-center justify-between gap-2 px-3 py-2">
                      <span className="flex items-center gap-1.5 text-xs text-foreground min-w-0">
                        {on ? (
                          <Lock size={12} className="text-amber-600 shrink-0" />
                        ) : (
                          <LockOpen size={12} className="text-muted-foreground shrink-0" />
                        )}
                        <span className="truncate">{s.nombre}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => toggle(s.codigo)}
                        disabled={isSaving}
                        aria-pressed={on}
                        className={`h-8 w-36 rounded-md border text-[11px] font-medium shrink-0 transition-colors ${
                          on
                            ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                            : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/60"
                        } ${isSaving ? "opacity-60" : ""}`}
                      >
                        {on ? "Confidencial" : "Hereda del área"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
