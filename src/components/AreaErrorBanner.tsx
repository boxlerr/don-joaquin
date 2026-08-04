"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { ShieldAlert, X } from "lucide-react";

const AREA_LABELS: Record<string, string> = {
  logistica: "Logística",
  flota: "Flota & Mantenimiento",
  combustible: "Combustible",
  comercial: "Comercial",
  finanzas: "Finanzas",
  rrhh: "RRHH",
  sistema: "Sistema",
};

const NIVEL_LABELS: Record<string, string> = {
  read: "lectura",
  write: "edición",
  admin: "administración",
};

export default function AreaErrorBanner() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  const error = params.get("error");
  const area = params.get("area");
  const nivel = params.get("nivel");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronización intencional al cambiar props/abrir (carga o reset de estado)
    setVisible(error === "area_required" && !!area);
  }, [error, area]);

  if (!visible) return null;

  const handleClose = () => {
    setVisible(false);
    const next = new URLSearchParams(params.toString());
    next.delete("error");
    next.delete("area");
    next.delete("nivel");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };

  const areaNombre = area ? AREA_LABELS[area] ?? area : "esa sección";
  const nivelLabel = nivel ? NIVEL_LABELS[nivel] ?? nivel : null;

  return (
    // Los márgenes acompañan al padding de página (p-4 sm:p-6 lg:p-8): con
    // `mx-8` fijo, el cartel quedaba más angosto que el contenido en celular.
    <div className="mx-4 sm:mx-6 lg:mx-8 mt-4 sm:mt-6 flex items-start gap-3 rounded-[8px] border border-amber-200 bg-amber-50 px-4 py-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100">
        <ShieldAlert size={16} className="text-amber-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-amber-900">
          Acceso restringido
        </p>
        <p className="mt-0.5 text-xs text-amber-800/90">
          No tenés permisos de {nivelLabel ?? "acceso"} sobre el área{" "}
          <span className="font-semibold">{areaNombre}</span>. Si necesitás acceder,
          pedile al administrador que actualice tu rol.
        </p>
      </div>
      <button
        type="button"
        onClick={handleClose}
        aria-label="Cerrar aviso"
        className="rounded p-1 text-amber-700/80 transition-colors hover:bg-amber-100 hover:text-amber-900"
      >
        <X size={14} />
      </button>
    </div>
  );
}
