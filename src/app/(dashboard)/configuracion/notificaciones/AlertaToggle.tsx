"use client";

import { useState, useTransition } from "react";
import { AlertCircle } from "lucide-react";
import { toggleAlertaAction } from "./actions";

interface Props {
  alertaKey: string;
  nombre: string;
  descripcion: string;
  initialActivo: boolean;
}

export default function AlertaToggle({ alertaKey, nombre, descripcion, initialActivo }: Props) {
  const [activo, setActivo] = useState(initialActivo);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const nuevoActivo = e.target.checked;
    setActivo(nuevoActivo);
    setError(null);
    startTransition(async () => {
      const result = await toggleAlertaAction({ alerta: alertaKey, activo: nuevoActivo });
      if ("error" in result) {
        setActivo(!nuevoActivo);
        setError(result.error);
      }
    });
  }

  return (
    <label className={`p-3.5 sm:p-4 bg-card rounded-[8px] border border-border hover:shadow-sm transition-shadow block ${isPending ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={activo}
          onChange={onChange}
          disabled={isPending}
          className="w-4 h-4 max-md:w-5 max-md:h-5 mt-0.5 shrink-0 cursor-pointer accent-[#0088D1] disabled:cursor-not-allowed"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">{nombre}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{descripcion}</p>
          {error && (
            <p className="text-xs text-[#7F1D1D] mt-1 flex items-center gap-1">
              <AlertCircle size={12} />
              {error}
            </p>
          )}
        </div>
      </div>
    </label>
  );
}
