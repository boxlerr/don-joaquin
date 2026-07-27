"use client";

// Banner del modo EN VIVO: el mes se está armando desde los viajes del
// sistema (sin planillas todavía).
//
// Sin botón de actualizar: si es el mes en curso se refresca sola cada 25s
// mientras la pestaña está a la vista, y al instante cuando volvés a la
// pestaña (que es cuando de verdad importa que el número esté fresco). El
// contador de segundos corre en vivo para que se vea que está andando.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { LiveInfo } from "../actions";
import { numAr, mesLabel } from "./format";

const CADA_MS = 25_000;

export default function LiveBanner({
  mes, esMesActual, info,
}: {
  mes: string;
  esMesActual: boolean;
  info: LiveInfo | null;
}) {
  const router = useRouter();
  // Segundos desde el último dato recibido. Arranca en 0 en server y cliente,
  // así que no hay desajuste de hidratación.
  const [segundos, setSegundos] = useState(0);
  const ultimoRefresh = useRef(0);

  // `info` es un objeto nuevo en cada render del server component: sirve de
  // señal de "llegó data fresca". Reset durante el render (patrón de React
  // para derivar estado de props), no dentro de un efecto.
  const [infoPrevia, setInfoPrevia] = useState(info);
  if (info !== infoPrevia) {
    setInfoPrevia(info);
    setSegundos(0);
  }

  // El banner solo se monta cuando el mes está EN VIVO (se arma desde viajes),
  // así que siempre conviene refrescar: los viajes se cargan de a poco y también
  // se completan meses ya pasados. `esMesActual` solo cambia el texto.
  useEffect(() => {
    // Throttle: entrar y salir de la pestaña rápido no dispara una ráfaga.
    const refrescar = () => {
      if (document.visibilityState !== "visible") return;
      const t = Date.now();
      if (t - ultimoRefresh.current < 5_000) return;
      ultimoRefresh.current = t;
      router.refresh();
    };

    const intervalo = setInterval(refrescar, CADA_MS);
    // Volver a la pestaña = querer el dato al día.
    const onVisible = () => { if (document.visibilityState === "visible") refrescar(); };
    document.addEventListener("visibilitychange", onVisible);

    const tick = setInterval(() => setSegundos((s) => s + 1), 1000);

    return () => {
      clearInterval(intervalo);
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5">
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
      </span>
      <p className="flex-1 text-xs text-foreground">
        <span className="font-semibold">EN VIVO</span> · {mesLabel(mes)} todavía no tiene planillas:
        estás viendo los <span className="font-semibold">{numAr(info?.viajes ?? 0)} viajes</span> cargados
        en el sistema (hoja de ruta){esMesActual ? "" : " — mes ya cerrado en el calendario"}.
        Sueldos y km al 100% llegan con las planillas del Drive.
      </p>
      <span className="shrink-0 font-mono text-[10.5px] text-muted-foreground tabular-nums">
        {segundos < 5 ? "recién actualizado" : `actualizado hace ${segundos}s`}
      </span>
    </div>
  );
}
