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
    <label className={`p-4 bg-white rounded-[8px] border border-[#E2E8F0] hover:shadow-sm transition-shadow block ${isPending ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={activo}
          onChange={onChange}
          disabled={isPending}
          className="w-4 h-4 mt-0.5 cursor-pointer accent-[#0088D1] disabled:cursor-not-allowed"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[#0F172A]">{nombre}</p>
          <p className="text-xs text-[#64748B] mt-0.5">{descripcion}</p>
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
