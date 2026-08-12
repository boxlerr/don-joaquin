"use client";

import { useEffect, useRef } from "react";

export const MENSAJE_POR_DEFECTO =
  "Tenés cambios sin guardar. Se guardaron como borrador, pero todavía no se cargaron al sistema. ¿Salir igual?";

/**
 * Avisa antes de irse de una pantalla con cosas cargadas y sin guardar.
 *
 * Es la segunda línea de defensa, no la primera: lo que evita perder el trabajo
 * es el borrador (`useBorrador`). Esto evita el otro problema, que es irse sin
 * darse cuenta y creer que quedó cargado. Por eso el mensaje dice las dos
 * cosas: que no se perdió, y que todavía no está en el sistema.
 *
 * Cubre los dos caminos por los que alguien se va:
 *
 *  - Cerrar o recargar la pestaña → `beforeunload`. El texto lo pone el
 *    navegador, no se puede cambiar; sólo se puede pedir que pregunte.
 *  - Tocar algo del sidebar → clic en un `<a>`. El App Router no expone un
 *    evento de "estoy por navegar", así que se intercepta el clic antes de que
 *    lo agarre Next (fase de captura).
 */
export function useCambiosSinGuardar(hayCambios: boolean, mensaje: string = MENSAJE_POR_DEFECTO) {
  // En ref para no re-suscribir los listeners en cada tecla que se toca. La
  // sincronización va en un efecto: escribir refs durante el render rompe con
  // el modo concurrente de React.
  const hayCambiosRef = useRef(hayCambios);
  const mensajeRef = useRef(mensaje);

  useEffect(() => {
    hayCambiosRef.current = hayCambios;
    mensajeRef.current = mensaje;
  });

  useEffect(() => {
    const alCerrar = (e: BeforeUnloadEvent) => {
      if (!hayCambiosRef.current) return;
      e.preventDefault();
      // Los navegadores viejos miran `returnValue`; los nuevos, el preventDefault.
      e.returnValue = "";
    };

    const alClickear = (e: MouseEvent) => {
      if (!hayCambiosRef.current) return;
      // Clic con modificador o del medio: abre en otra pestaña, la nuestra no se va.
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }

      const ancla = (e.target as HTMLElement | null)?.closest?.("a");
      const href = ancla?.getAttribute("href");
      if (!ancla || !href) return;
      if (ancla.target && ancla.target !== "_self") return;
      // Un ancla a la misma página (#seccion, o el mismo link del sidebar en el
      // que ya estás) no saca a nadie de ningún lado.
      if (href.startsWith("#")) return;
      if (ancla.getAttribute("download") !== null) return;
      if (href === window.location.pathname + window.location.search) return;

      if (!window.confirm(mensajeRef.current)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener("beforeunload", alCerrar);
    // Captura: hay que llegar antes que el router de Next, que escucha en burbuja.
    document.addEventListener("click", alClickear, true);

    return () => {
      window.removeEventListener("beforeunload", alCerrar);
      document.removeEventListener("click", alClickear, true);
    };
  }, []);
}
