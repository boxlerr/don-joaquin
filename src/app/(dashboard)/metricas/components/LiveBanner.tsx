"use client";

// Banner del modo EN VIVO: el mes se está armando desde los viajes del
// sistema (sin planillas todavía). Auto-refresh cada 60s si es el mes actual.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import type { LiveInfo } from "../actions";
import { numAr, mesLabel } from "./format";

export default function LiveBanner({
  mes, esMesActual, info,
}: {
  mes: string;
  esMesActual: boolean;
  info: LiveInfo | null;
}) {
  const router = useRouter();
  const [refrescando, setRefrescando] = useState(false);

  useEffect(() => {
    if (!esMesActual) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 60_000);
    return () => clearInterval(id);
  }, [esMesActual, router]);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5">
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
      </span>
      <p className="flex-1 text-xs text-foreground">
        <span className="font-semibold">EN VIVO</span> · {mesLabel(mes)} todavía no tiene planillas:
        estás viendo los <span className="font-semibold">{numAr(info?.viajes ?? 0)} viajes</span> cargados
        en el sistema (hoja de ruta){esMesActual ? " — se actualiza sola cada minuto" : ""}.
        Sueldos y km al 100% llegan con las planillas del Drive.
      </p>
      <button
        type="button"
        onClick={() => { setRefrescando(true); router.refresh(); setTimeout(() => setRefrescando(false), 800); }}
        className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
      >
        <RefreshCw size={11} className={refrescando ? "animate-spin" : ""} /> Actualizar
      </button>
    </div>
  );
}
