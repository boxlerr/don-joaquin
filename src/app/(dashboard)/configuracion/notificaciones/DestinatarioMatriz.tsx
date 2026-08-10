"use client";

import { useState, useTransition } from "react";
import { AlertCircle, Lock } from "lucide-react";
import { setUsuarioAlertaPrefAction } from "./actions";

/**
 * `bloqueadaPor` = nombre de la subsección confidencial que la persona NO tiene
 * (ej. "Préstamos"). El casillero se dibuja con candado y no se puede tildar: la
 * matriz es una preferencia, y una preferencia no puede otorgar un permiso. Antes
 * se podía tildar Préstamos para cualquiera y el mail salía con los montos.
 */
type Columna = { key: string; nombre: string; bloqueadaPor?: string | null };

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
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const toggle = (key: string) => {
    const next = new Set(enabled);
    const activo = !next.has(key);
    if (activo) next.add(key);
    else next.delete(key);
    setEnabled(next); // optimista
    setPendingKey(key);
    setError(null);
    startTransition(async () => {
      const res = await setUsuarioAlertaPrefAction({ usuarioId, alertaKey: key, activo });
      if ("error" in res) {
        // Revertir si falló, y DECIRLO: el guardado se revertía en silencio, así
        // que un rechazo del servidor se veía igual que un clic que no registró.
        setEnabled((prev) => {
          const rollback = new Set(prev);
          if (activo) rollback.delete(key);
          else rollback.add(key);
          return rollback;
        });
        setError(res.error);
      }
      setPendingKey(null);
    });
  };

  // El contador dice lo que REALMENTE le va a llegar: una columna tildada de antes
  // pero bloqueada por permisos no se cuenta, porque no se manda.
  const bloqueadas = new Set(columnas.filter((c) => c.bloqueadaPor).map((c) => c.key));
  const total = [...enabled].filter((k) => !bloqueadas.has(k)).length;

  return (
    <div className="p-3 sm:p-4 bg-card rounded-[8px] border border-border">
      <div className="flex items-center justify-between gap-2 sm:gap-4 mb-3">
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
          if (c.bloqueadaPor) {
            const motivo = `Sin acceso a ${c.bloqueadaPor}: no le pueden llegar estos avisos. Se otorga en Usuarios y permisos.`;
            return (
              <span
                key={c.key}
                title={motivo}
                aria-label={`${c.nombre} — ${motivo}`}
                className="inline-flex items-center gap-1.5 px-2.5 max-md:px-3 py-1 rounded-full text-[11px] max-md:text-xs font-medium border border-dashed border-amber-300/70 bg-amber-50/50 text-amber-700 cursor-not-allowed max-md:min-h-9"
              >
                <Lock size={11} className="shrink-0 text-amber-600" />
                {c.nombre}
              </span>
            );
          }
          const on = enabled.has(c.key);
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => toggle(c.key)}
              aria-pressed={on}
              // Una sola cosa en vuelo por persona: el guardado es un
              // read-modify-write de todo el JSON de la matriz, así que dos clics
              // encimados se pisan y uno se pierde sin avisar.
              disabled={pendingKey !== null}
              className={`inline-flex items-center gap-1.5 px-2.5 max-md:px-3 py-1 rounded-full text-[11px] max-md:text-xs font-medium border transition-colors disabled:opacity-60 max-md:min-h-9 ${
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
                <span aria-hidden="true">{on ? "✓" : ""}</span>
              </span>
              {c.nombre}
            </button>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="mt-2 text-xs text-[#7F1D1D] flex items-start gap-1">
          <AlertCircle size={12} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
