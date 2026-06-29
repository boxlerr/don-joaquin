"use client";

import { useState, useTransition } from "react";
import { setUsuarioAlertaPrefAction } from "./actions";

type Columna = { key: string; nombre: string };

export default function DestinatarioMatriz({
  usuarioId,
  nombre,
  email,
  rol,
  columnas,
  enabledInicial,
}: {
  usuarioId: string;
  nombre: string;
  email: string;
  rol?: string | null;
  columnas: Columna[];
  enabledInicial: string[];
}) {
  const [enabled, setEnabled] = useState<Set<string>>(new Set(enabledInicial));
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const toggle = (key: string) => {
    const next = new Set(enabled);
    const activo = !next.has(key);
    if (activo) next.add(key);
    else next.delete(key);
    setEnabled(next); // optimista
    setPendingKey(key);
    startTransition(async () => {
      const res = await setUsuarioAlertaPrefAction({ usuarioId, alertaKey: key, activo });
      if ("error" in res) {
        // revertir si falló
        setEnabled((prev) => {
          const rollback = new Set(prev);
          if (activo) rollback.delete(key);
          else rollback.add(key);
          return rollback;
        });
      }
      setPendingKey(null);
    });
  };

  const total = enabled.size;

  return (
    <div className="p-4 bg-card rounded-[8px] border border-border">
      <div className="flex items-center justify-between gap-4 mb-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{nombre}</p>
          <p className="text-xs text-muted-foreground truncate">
            {email}
            {rol ? ` • ${rol}` : ""}
          </p>
        </div>
        <span
          className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
            total > 0
              ? "bg-emerald-50 text-emerald-700 border-emerald-200/60"
              : "bg-slate-100 text-slate-500 border-slate-200/60"
          }`}
        >
          {total > 0 ? `${total} aviso${total !== 1 ? "s" : ""}` : "Sin avisos"}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {columnas.map((c) => {
          const on = enabled.has(c.key);
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => toggle(c.key)}
              disabled={pendingKey === c.key}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors disabled:opacity-60 ${
                on
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "bg-muted/40 text-muted-foreground border-border hover:border-primary/30"
              }`}
            >
              <span
                className={`flex items-center justify-center w-3.5 h-3.5 rounded-[4px] border text-white text-[9px] ${
                  on ? "bg-primary border-primary" : "border-muted-foreground/40"
                }`}
              >
                {on ? "✓" : ""}
              </span>
              {c.nombre}
            </button>
          );
        })}
      </div>
    </div>
  );
}
