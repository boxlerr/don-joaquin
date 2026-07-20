"use client";

import { useState } from "react";
import { CalendarPlus, Loader2, X } from "lucide-react";

function fmt(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Fecha editable dentro de la tabla: se hace clic sobre el valor y se edita ahí
 * mismo, sin abrir el diálogo. Guarda al elegir la fecha.
 *
 * Se usa tanto para el vencimiento como para "Presentado el". En este último la
 * fecha es opcional: cargarla marca el impuesto como entregado y borrarla lo
 * vuelve a dejar pendiente.
 */
export default function CeldaFecha({
  valor,
  onGuardar,
  canEdit,
  permitirVaciar = false,
  placeholder = "—",
  tone = "default",
}: {
  valor: string | null;
  onGuardar: (fecha: string | null) => Promise<{ error?: string } | void>;
  canEdit: boolean;
  /** Deja borrar la fecha (vuelve a "pendiente"). */
  permitirVaciar?: boolean;
  placeholder?: string;
  tone?: "default" | "success";
}) {
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardar = async (fecha: string | null) => {
    setGuardando(true);
    setError(null);
    const res = await onGuardar(fecha);
    setGuardando(false);
    if (res && "error" in res && res.error) {
      setError(res.error);
      return;
    }
    setEditando(false);
  };

  if (!canEdit) {
    return valor ? (
      <span className="tabular-nums text-foreground">{fmt(valor)}</span>
    ) : (
      <span className="text-muted-foreground/40">{placeholder}</span>
    );
  }

  if (editando) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          type="date"
          defaultValue={valor ?? ""}
          autoFocus
          disabled={guardando}
          onChange={(e) => {
            if (e.target.value) guardar(e.target.value);
          }}
          className="h-7 rounded-md border border-border bg-card px-2 text-xs text-foreground outline-none focus:border-[#0088D1]"
        />
        {guardando && <Loader2 size={13} className="animate-spin text-muted-foreground" />}
        {permitirVaciar && valor && !guardando && (
          <button
            type="button"
            onClick={() => guardar(null)}
            title="Quitar la fecha (vuelve a pendiente)"
            className="text-muted-foreground hover:text-red-600"
          >
            <X size={13} />
          </button>
        )}
        {!guardando && (
          <button
            type="button"
            onClick={() => setEditando(false)}
            className="text-[11px] text-muted-foreground hover:underline"
          >
            Cancelar
          </button>
        )}
        {error && <span className="text-[11px] text-red-600">{error}</span>}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditando(true)}
      title="Editar fecha"
      className={`group inline-flex items-center gap-1.5 rounded px-1 -mx-1 tabular-nums transition-colors hover:bg-muted ${
        valor
          ? tone === "success"
            ? "font-medium text-emerald-700"
            : "text-foreground"
          : "text-muted-foreground/50"
      }`}
    >
      {valor ? fmt(valor) : placeholder}
      {!valor && <CalendarPlus size={12} className="opacity-0 group-hover:opacity-100" />}
    </button>
  );
}
