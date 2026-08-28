"use client";

import { useState } from "react";
import { CirclePlus, Loader2, Pencil, X } from "lucide-react";

function fmt(n: number): string {
  return `$ ${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Lo que se pagó, editable dentro de la tabla — el mismo gesto que `CeldaFecha`:
 * se toca el valor, se escribe y se guarda con Enter o al salir del campo.
 *
 * Acepta cómo se escribe la plata acá: "1.234,56" y "1234.56" son lo mismo.
 * Vaciar el campo NO carga un cero, borra el importe — son cosas distintas y el
 * total del mes cuenta aparte los que no tienen nada cargado.
 */
export default function CeldaImporte({
  valor,
  onGuardar,
  canEdit,
  placeholder = "Cargar importe",
}: {
  valor: number | null;
  onGuardar: (importe: number | null) => Promise<{ error?: string } | void>;
  canEdit: boolean;
  placeholder?: string;
}) {
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [texto, setTexto] = useState("");

  const abrir = () => {
    setTexto(valor != null ? String(valor) : "");
    setError(null);
    setEditando(true);
  };

  const guardar = async (crudo: string) => {
    const limpio = crudo.trim();
    let importe: number | null = null;
    if (limpio !== "") {
      // "1.234,56" (como se escribe acá) y "1234.56" (como sale de un Excel)
      // tienen que entrar los dos. Se sacan los puntos de miles y la coma pasa
      // a punto; si no hay coma, el punto que haya ya es el decimal.
      const normalizado = limpio.includes(",")
        ? limpio.replace(/\./g, "").replace(",", ".")
        : limpio;
      const n = Number(normalizado.replace(/[^0-9.\-]/g, ""));
      if (!Number.isFinite(n)) {
        setError("Importe inválido");
        return;
      }
      if (n < 0) {
        setError("No puede ser negativo");
        return;
      }
      importe = Math.round(n * 100) / 100;
    }

    setGuardando(true);
    setError(null);
    const res = await onGuardar(importe);
    setGuardando(false);
    if (res && "error" in res && res.error) {
      setError(res.error);
      return;
    }
    setEditando(false);
  };

  if (!canEdit) {
    return valor != null ? (
      <span className="tabular-nums font-medium text-foreground">{fmt(valor)}</span>
    ) : (
      <span className="text-muted-foreground/40">—</span>
    );
  }

  if (editando) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          inputMode="decimal"
          autoFocus
          disabled={guardando}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              guardar(texto);
            }
            if (e.key === "Escape") {
              e.preventDefault();
              setEditando(false);
            }
          }}
          onBlur={() => guardar(texto)}
          placeholder="0,00"
          aria-label="Importe pagado"
          className="h-9 w-28 rounded-md border border-border bg-card px-2 text-right text-xs tabular-nums text-foreground outline-none focus:border-[#0088D1] md:h-7"
        />
        {guardando && <Loader2 size={13} className="animate-spin text-muted-foreground" />}
        {valor != null && !guardando && (
          <button
            type="button"
            // `onMouseDown`: el `onBlur` del campo dispara antes que el click y
            // guardaría el texto viejo en lugar de borrar.
            onMouseDown={(e) => {
              e.preventDefault();
              guardar("");
            }}
            title="Quitar el importe"
            className="inline-flex size-9 items-center justify-center text-muted-foreground hover:text-red-600 md:size-5"
          >
            <X size={14} />
          </button>
        )}
        {error && <span className="text-[11px] text-red-600">{error}</span>}
      </div>
    );
  }

  // Sin importe: campo punteado para completar, igual que la fecha sin cargar.
  if (valor == null) {
    return (
      <button
        type="button"
        onClick={abrir}
        title="Cargar cuánto se pagó"
        className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-[#CBD5E1] px-2.5 text-xs text-muted-foreground transition-colors hover:border-[#0088D1] hover:bg-[#0088D1]/5 hover:text-primary md:h-auto md:px-2 md:py-1"
      >
        <CirclePlus size={12} />
        {placeholder}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={abrir}
      title="Editar el importe"
      className="group inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 font-medium tabular-nums text-foreground transition-colors hover:bg-muted md:h-auto md:border-transparent md:px-2 md:py-1"
    >
      {fmt(valor)}
      <Pencil size={11} className="opacity-60 transition-opacity md:opacity-0 md:group-hover:opacity-60" />
    </button>
  );
}
