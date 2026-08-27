"use client";

import { useEffect } from "react";

/**
 * Mover una lista con el dedo, sin depender de que el navegador quiera.
 *
 * Nace del selector de camiones del Taller (27/08/2026). La lista tenía todo lo
 * que hace falta para scrollear —`overflow-y: auto`, altura acotada, contenido
 * de sobra, un solo contenedor de scroll, `touch-action: pan-y`— y aun así en
 * el teléfono el dedo no la movía. Falló igual en iPhone y en Android, o sea en
 * los dos motores. Tres intentos de arreglarlo por CSS no alcanzaron, y en un
 * Chromium con touch emulado el mismo código scrollea perfecto: el problema no
 * se puede reproducir fuera del aparato.
 *
 * La causa está en el diálogo, aunque no donde se la buscó: mientras hay un
 * panel abierto, `useDismiss` de floating-ui —que es lo que detecta el toque
 * "afuera" para cerrarlo— engancha `touchmove` en el documento en fase de
 * captura, y de ahí le cuelga otro `touchmove` al elemento que está bajo el
 * dedo SIN pasarle opciones. Sin opciones, sobre un elemento, un listener es NO
 * PASIVO: el navegador ya no puede scrollear por su cuenta y tiene que esperar
 * al JavaScript, y el scroll rápido se pierde. Eso explica las tres cosas que
 * ninguna hipótesis de CSS explicaba: por qué sólo falla con el dedo (con la
 * rueda ese camino no corre), por qué falla igual en iPhone y en Android (es
 * JavaScript, no el motor de dibujo) y por qué los toques sí funcionan.
 *
 * Así que se deja de pedirle permiso al navegador. Acá el arrastre se toma a
 * mano —`touchstart` / `touchmove` / `touchend`— y la lista se mueve escribiendo
 * `scrollTop`, que es una propiedad que SIEMPRE se puede escribir. Si el
 * navegador además hubiera scrolleado por su cuenta, el `preventDefault` lo
 * evita, así que no hay doble movimiento.
 *
 * Se agrega ENCIMA del scroll nativo, no en su lugar: el `overflow-y: auto`
 * sigue puesto. En la computadora esto no se activa (no hay eventos táctiles) y
 * la rueda del mouse sigue funcionando como siempre.
 *
 * Al soltar, la lista sigue de largo un poco y frena sola: sin eso, mover una
 * lista de 150 camiones sería arrastrar de a pantallas.
 */

/** Cuánta velocidad conserva en cada cuadro al soltar. 0.95 ≈ frena en ~1s. */
const ROCE = 0.95;
/** Por debajo de esto ya no se mueve: evita quedar temblando en el último pixel. */
const VELOCIDAD_MINIMA = 0.05;
/** Arrastres más viejos que esto no cuentan para el envión. */
const VENTANA_MS = 100;
/** A partir de acá el dedo está deslizando, no tocando. */
const UMBRAL_ARRASTRE = 8;

/**
 * Recibe el ELEMENTO, no un ref.
 *
 * Con un ref no funcionaba y costó verlo: el diálogo monta su contenido en un
 * portal y en un paso posterior, así que cuando el efecto corría `ref.current`
 * todavía era `null`; como las dependencias no volvían a cambiar, el efecto no
 * se repetía nunca y los listeners no se enganchaban jamás. Tomando el nodo por
 * estado (`ref={setLista}` del lado del que lo usa), el efecto se vuelve a
 * ejecutar en cuanto la lista aparece de verdad.
 */
export function useScrollTactil(el: HTMLElement | null, activo = true) {
  useEffect(() => {
    if (!el || !activo) return;
    // Sin dedos no hay nada que hacer: en la computadora manda el navegador.
    if (typeof window === "undefined" || !("ontouchstart" in window)) return;

    let arrastrando = false;
    let desdeY = 0;
    let scrollAlEmpezar = 0;
    let ultimaY = 0;
    let ultimoT = 0;
    let velocidad = 0;
    let envion = 0;
    let deslizo = false;

    const frenar = () => {
      if (envion) cancelAnimationFrame(envion);
      envion = 0;
    };

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      frenar();
      arrastrando = true;
      desdeY = t.clientY;
      ultimaY = t.clientY;
      ultimoT = e.timeStamp;
      scrollAlEmpezar = el.scrollTop;
      velocidad = 0;
      deslizo = false;
    };

    const onMove = (e: TouchEvent) => {
      if (!arrastrando) return;
      const t = e.touches[0];
      if (!t) return;

      // Hacia dónde se fue el dedo desde que empezó. Se calcula contra el
      // inicio y no acumulando pasos: acumular arrastra el error y la lista
      // termina desfasada del dedo.
      const recorrido = desdeY - t.clientY;
      if (Math.abs(recorrido) > UMBRAL_ARRASTRE) deslizo = true;
      const antes = el.scrollTop;
      el.scrollTop = scrollAlEmpezar + recorrido;

      // Sólo se queda con el gesto si de verdad movió algo. Si la lista ya está
      // en el tope o en el fondo, se lo deja al navegador: así el tirón de más
      // sigue haciendo lo que la persona espera (cerrar el panel, refrescar).
      if (el.scrollTop !== antes && e.cancelable) e.preventDefault();

      const dt = e.timeStamp - ultimoT;
      if (dt > 0) {
        const v = (ultimaY - t.clientY) / dt;
        // Se promedia con lo anterior: un dedo tiembla, y sin suavizar el
        // envión sale para cualquier lado.
        velocidad = dt < VENTANA_MS ? velocidad * 0.3 + v * 0.7 : v;
        ultimaY = t.clientY;
        ultimoT = e.timeStamp;
      }
    };

    const onEnd = () => {
      if (!arrastrando) return;
      arrastrando = false;

      // Deslizar para ver la lista NO puede terminar eligiendo el camión que
      // quedó abajo del dedo. Al soltar después de un arrastre, el navegador
      // manda igual un `click` sobre esa fila: se lo intercepta una sola vez,
      // en captura, antes de que llegue al botón.
      if (deslizo) {
        const tragarClick = (ev: MouseEvent) => {
          ev.preventDefault();
          ev.stopPropagation();
        };
        el.addEventListener("click", tragarClick, { capture: true, once: true });
        // Si no vino ningún click (el caso normal cuando el dedo sale de la
        // lista), el listener no puede quedar colgado esperando al próximo.
        setTimeout(() => el.removeEventListener("click", tragarClick, true), 400);
      }

      const seguir = () => {
        velocidad *= ROCE;
        if (Math.abs(velocidad) < VELOCIDAD_MINIMA) {
          envion = 0;
          return;
        }
        const antes = el.scrollTop;
        el.scrollTop += velocidad * 16; // 16ms ≈ un cuadro
        // Llegó al tope o al fondo: no tiene sentido seguir empujando.
        if (el.scrollTop === antes) {
          envion = 0;
          return;
        }
        envion = requestAnimationFrame(seguir);
      };
      envion = requestAnimationFrame(seguir);
    };

    // `passive: false` es lo único que permite `preventDefault` en el gesto.
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onEnd, { passive: true });

    return () => {
      frenar();
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [el, activo]);
}
