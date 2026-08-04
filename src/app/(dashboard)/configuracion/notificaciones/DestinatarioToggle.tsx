"use client";

import { useState, useTransition } from "react";
import { AlertCircle } from "lucide-react";
import { toggleDestinatarioAction } from "./actions";

interface Props {
  usuarioId: string;
  initialActivo: boolean;
}

export default function DestinatarioToggle({ usuarioId, initialActivo }: Props) {
  const [activo, setActivo] = useState(initialActivo);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onToggle() {
    const nuevo = !activo;
    setActivo(nuevo);
    setError(null);
    startTransition(async () => {
      const result = await toggleDestinatarioAction({ usuarioId, activo: nuevo });
      if ("error" in result) {
        setActivo(!nuevo);
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      {error && (
        <span className="text-xs text-[#7F1D1D] flex items-center gap-1">
          <AlertCircle size={12} />
          {error}
        </span>
      )}
      {/* El botón es la zona táctil (36px en celular); la pastilla de adentro es
          lo que se ve. En desktop mide lo mismo que ella. */}
      <button
        type="button"
        role="switch"
        aria-checked={activo}
        disabled={isPending}
        onClick={onToggle}
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-md disabled:opacity-50 disabled:cursor-not-allowed sm:size-auto"
        aria-label="Activar destinatario"
      >
        <span
          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
            activo ? "bg-[#0088D1]" : "bg-[#CBD5E1]"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-card shadow transition-transform ${
              activo ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </span>
      </button>
    </div>
  );
}
