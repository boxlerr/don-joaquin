"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Avisos que llegan juntos —un import de 40 filas— se atienden como uno solo. */
const AGRUPAR_MS = 1000;

/**
 * Escucha los avisos de una sección y llama a `alCambiar` cuando algo cambió.
 *
 * El WebSocket va del navegador a Supabase, sin pasar por Vercel: mantenerlo
 * abierto no cuesta invocaciones. Lo que sí las cuesta es lo que se hace al
 * recibir el aviso, y por eso `alCambiar` tiene que recargar el pedazo que
 * corresponde —no la página entera—. `router.refresh()` acá sería volver a
 * renderizar todo en el servidor: es justo la sensación de "se me recargó
 * sola" que estamos tratando de sacar.
 *
 * El aviso no trae datos: sólo dice qué sección cambió. Los datos se vuelven a
 * pedir por la acción de siempre, que es la que aplica los permisos.
 */
export function useEnVivo(
  seccion: string,
  alCambiar: () => void,
  { activo = true }: { activo?: boolean } = {},
) {
  const [conectado, setConectado] = useState(false);

  // En ref para no re-suscribir el canal cada vez que el padre re-renderiza.
  // Se sincroniza en un efecto porque escribir refs durante el render rompe
  // con el modo concurrente de React.
  const alCambiarRef = useRef(alCambiar);
  useEffect(() => {
    alCambiarRef.current = alCambiar;
  });

  // Si no se puede armar el cliente —falta una variable de entorno, o estamos
  // en un test que renderiza la pantalla sin Supabase— la pantalla tiene que
  // funcionar igual, sólo que sin avisos. Enterarse en vivo es un lujo; que la
  // tabla de viajes no cargue, no.
  const supabase = useMemo(() => {
    try {
      return createClient();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!activo || !supabase) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    let vivo = true;
    let canal: ReturnType<typeof supabase.channel> | null = null;

    const conectar = async () => {
      // El token PRIMERO y recién después la suscripción: el canal es privado y
      // sin el token de la sesión Realtime lo rechaza. Suscribirse antes era
      // pedirle permiso a la puerta sin haber sacado la credencial.
      try {
        await supabase.realtime.setAuth();
      } catch {
        // Sin sesión no hay avisos, y está bien: la pantalla anda igual.
        return;
      }
      if (!vivo) return;

      canal = supabase
        .channel(`cambios:${seccion}`, { config: { private: true } })
        .on("broadcast", { event: "cambio" }, () => {
          // Agrupados: si entran cuarenta filas de un import llegan varios
          // avisos seguidos y no tiene sentido recargar cuarenta veces.
          clearTimeout(timer);
          timer = setTimeout(() => {
            if (vivo) alCambiarRef.current();
          }, AGRUPAR_MS);
        })
        .subscribe((estado) => {
          if (!vivo) return;
          setConectado(estado === "SUBSCRIBED");
        });
    };

    conectar().catch(() => setConectado(false));

    return () => {
      vivo = false;
      clearTimeout(timer);
      if (canal) supabase.removeChannel(canal).catch(() => {});
      setConectado(false);
    };
  }, [seccion, activo, supabase]);

  return { conectado };
}

/**
 * Si hay alguien tipeando en la pantalla, en cualquier campo.
 *
 * Es la pieza que decide si la pantalla puede actualizarse sola o tiene que
 * esperar. Cuenta también el buscador y los filtros a propósito: sacarle la
 * tabla de abajo a alguien que está escribiendo es molesto venga de donde
 * venga el foco.
 */
export function useEscribiendo(): boolean {
  const [escribiendo, setEscribiendo] = useState(false);

  useEffect(() => {
    const evaluar = () => {
      const el = document.activeElement as HTMLElement | null;
      const esCampo =
        !!el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT" ||
          el.isContentEditable);
      setEscribiendo(esCampo);
    };

    // `focusout` llega ANTES del `focusin` del campo siguiente: evaluar en el
    // acto haría parpadear a "no está escribiendo" al pasar de un campo a otro
    // con Tab, y ahí justo se colaría un refresco.
    const alSalir = () => setTimeout(evaluar, 0);

    evaluar();
    document.addEventListener("focusin", evaluar);
    document.addEventListener("focusout", alSalir);
    return () => {
      document.removeEventListener("focusin", evaluar);
      document.removeEventListener("focusout", alSalir);
    };
  }, []);

  return escribiendo;
}

/**
 * El comportamiento completo: escucha, y decide si actualizar sola o avisar.
 *
 * Tres estados, que es lo que hace que esto no moleste:
 *
 *  1. Mirando (nadie tipeando, nada sin guardar) → se actualiza sola, sin
 *     spinner y sin perder el scroll.
 *  2. Escribiendo o con cambios sin guardar → no se mueve nada. Se cuenta la
 *     novedad y la pantalla muestra "N novedades · Ver". Es el patrón de las
 *     redes sociales: el contador sube, el contenido se queda quieto.
 *  3. Cuando toca "Ver" → ahí sí recarga, porque lo pidió.
 */
export function useNovedades({
  seccion,
  recargar,
  ocupado = false,
  activo = true,
}: {
  seccion: string;
  /** Recarga el pedazo de pantalla que corresponde. Nunca la página entera. */
  recargar: () => void;
  /** `true` si hay cambios sin guardar: ahí nunca se actualiza sola. */
  ocupado?: boolean;
  activo?: boolean;
}): { novedades: number; ver: () => void; conectado: boolean } {
  const [novedades, setNovedades] = useState(0);
  const escribiendo = useEscribiendo();

  const ocupadoRef = useRef(false);
  const recargarRef = useRef(recargar);

  useEffect(() => {
    ocupadoRef.current = ocupado || escribiendo;
    recargarRef.current = recargar;
  });

  const { conectado } = useEnVivo(
    seccion,
    () => {
      if (ocupadoRef.current) {
        setNovedades((n) => n + 1);
      } else {
        recargarRef.current();
      }
    },
    { activo },
  );

  // Al dejar de estar ocupado NO se descarga solo lo acumulado: si alguien
  // terminó de tipear y sacó el foco, moverle la tabla en ese momento es el
  // mismo susto. Queda el aviso hasta que lo toque.

  const ver = () => {
    setNovedades(0);
    recargarRef.current();
  };

  return { novedades, ver, conectado };
}
