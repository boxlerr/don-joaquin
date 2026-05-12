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
      <button
        type="button"
        role="switch"
        aria-checked={activo}
        disabled={isPending}
        onClick={onToggle}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          activo ? "bg-[#0088D1]" : "bg-[#CBD5E1]"
        }`}
        aria-label="Activar destinatario"
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            activo ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}
