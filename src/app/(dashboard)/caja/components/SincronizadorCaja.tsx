"use client";

import { useEffect } from "react";

/** Cada cuánto se busca lo que cambió en otras sesiones. */
const INTERVALO_MS = 15_000;

/**
 * Mantiene la caja al día sin recargar la página: cuando dirección oculta o
 * muestra un movimiento, el resto de las sesiones lo ven solas.
 *
 * Emite `caja:sync` —recarga silenciosa, sin spinner ni perder el scroll— a
 * diferencia de `caja:refresh`, que dispara una carga del propio usuario. Solo
 * corre con la pestaña visible: en segundo plano no tiene sentido consultar, y
 * al volver se sincroniza en el acto.
 */
export default function SincronizadorCaja() {
  useEffect(() => {
    const sincronizar = () => {
      if (document.visibilityState !== "visible") return;
      window.dispatchEvent(new CustomEvent("caja:sync"));
    };

    const intervalo = setInterval(sincronizar, INTERVALO_MS);
    document.addEventListener("visibilitychange", sincronizar);
    window.addEventListener("focus", sincronizar);

    return () => {
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", sincronizar);
      window.removeEventListener("focus", sincronizar);
    };
  }, []);

  return null;
}
