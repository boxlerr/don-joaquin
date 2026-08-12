"use client";

import { useCallback, useEffect } from "react";
import { useNovedades } from "@/hooks/useEnVivo";
import BarraNovedades from "@/components/envivo/BarraNovedades";

/**
 * Cada cuánto se pregunta igual, por las dudas.
 *
 * Antes esto era 15 segundos y era el ÚNICO mecanismo: dos llamadas al servidor
 * por pestaña abierta, cuatro veces por minuto, hubiera o no novedades. Una
 * jornada con cinco personas mirando la caja eran unas 19.000 invocaciones por
 * día para no enterarse de nada. Ahora el aviso llega por el canal en vivo y
 * esto queda sólo de red de seguridad, por si el WebSocket se cae y no se
 * reconecta.
 */
const RESPALDO_MS = 90_000;

/**
 * Mantiene la caja al día sin recargar la página: cuando otro carga un
 * movimiento, o dirección oculta uno, el resto de las sesiones lo ven solas.
 *
 * Lo que llega por el canal es un aviso sin datos —sólo "cambió la caja"—. El
 * evento `caja:sync` hace que la tabla y los totales vuelvan a pedirle los
 * datos al servidor, que es donde se filtra lo confidencial y lo que dirección
 * marcó como oculto. Por eso el aviso puede viajar sin permisos: no lleva nada.
 *
 * `caja:sync` = recarga silenciosa, sin spinner y sin perder el scroll. Es
 * distinto de `caja:refresh`, que dispara una carga del propio usuario.
 *
 * Si hay alguien tipeando, no se mueve nada: aparece "N movimientos nuevos ·
 * Ver" y la pantalla espera. Sacarle la fila de abajo a quien está cargando un
 * egreso es peor que enterarse un minuto más tarde.
 */
export default function SincronizadorCaja() {
  const sincronizar = useCallback(() => {
    window.dispatchEvent(new CustomEvent("caja:sync"));
  }, []);

  const { novedades, ver } = useNovedades({
    seccion: "caja",
    recargar: sincronizar,
  });

  // Respaldo: sólo con la pestaña visible —en segundo plano no tiene sentido
  // preguntar— y al volver a la pestaña se sincroniza en el acto, que es
  // cuando de verdad hace falta.
  useEffect(() => {
    const siVisible = () => {
      if (document.visibilityState !== "visible") return;
      sincronizar();
    };

    const intervalo = setInterval(siVisible, RESPALDO_MS);
    document.addEventListener("visibilitychange", siVisible);
    window.addEventListener("focus", siVisible);

    return () => {
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", siVisible);
      window.removeEventListener("focus", siVisible);
    };
  }, [sincronizar]);

  return (
    <BarraNovedades
      cantidad={novedades}
      onVer={ver}
      sustantivo="movimiento"
      sustantivoPlural="movimientos"
    />
  );
}
