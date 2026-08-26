"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

/**
 * Recorrido guiado sobre la pantalla de verdad.
 *
 * El tutorial que ya existe (`HelpTutorialDialog`) explica con dibujos, y sirve
 * para entender qué hace una sección. Esto es otra cosa: oscurece la pantalla,
 * ilumina el botón real del que está hablando y lo lleva a uno hasta ahí. Nace
 * de un caso concreto — Ana y Noelia no encontraban dónde cargar la VTV, y el
 * filtro que hacía falta estaba a la vista de quien ya sabe dónde mirar.
 *
 * Cómo funciona: cada paso apunta a un elemento por `data-tour`. Se lo mide en
 * cada cuadro (la lista scrollea, los filtros se acomodan, la ventana cambia de
 * tamaño) y se dibuja el agujero encima. El elemento iluminado sigue siendo
 * TOCABLE: la idea es que la persona pueda usar el filtro mientras el recorrido
 * se lo explica, no mirar una foto.
 *
 * Un paso cuyo elemento no está en pantalla —porque depende de un permiso, de un
 * filtro o del ancho— no rompe nada: se muestra la tarjeta centrada. Los pasos
 * que directamente no aplican se filtran antes de arrancar (`estaEnPantalla`).
 */

export type PasoTour = {
  id: string;
  titulo: string;
  texto: string;
  /** Selector del elemento a iluminar. Sin él, la tarjeta va en el centro. */
  target?: string;
};

/** Los pasos cuyo elemento existe hoy en la pantalla. */
export function pasosVisibles(pasos: PasoTour[]): PasoTour[] {
  if (typeof document === "undefined") return pasos;
  return pasos.filter((p) => !p.target || document.querySelector(p.target) !== null);
}

const PAD = 6; // aire entre el elemento y el borde del agujero
const ANCHO_TARJETA = 340;
const ALTO_TARJETA = 190; // estimado, sólo para decidir arriba/abajo

type Caja = { top: number; left: number; width: number; height: number };

function mismaCaja(a: Caja | null, b: Caja | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5
  );
}

export default function TourGuiado({
  pasos,
  abierto,
  onCerrar,
  onTerminar,
}: {
  pasos: PasoTour[];
  abierto: boolean;
  /** Se salió a mitad de camino (Escape, "Salir"). */
  onCerrar: () => void;
  /** Se llegó al final. Por defecto hace lo mismo que cerrar. */
  onTerminar?: () => void;
}) {
  const [i, setI] = useState(0);
  const [caja, setCaja] = useState<Caja | null>(null);
  const [ventana, setVentana] = useState({ w: 1280, h: 800 });
  const cajaRef = useRef<Caja | null>(null);

  // Arranca de cero cada vez que se abre. Se ajusta durante el render y no en un
  // efecto (es el patrón que recomienda React para "reaccionar a un prop"): con
  // un efecto, el primer cuadro del recorrido mostraba el paso donde había
  // quedado la vez anterior.
  const [abiertoAntes, setAbiertoAntes] = useState(abierto);
  if (abierto !== abiertoAntes) {
    setAbiertoAntes(abierto);
    if (abierto) setI(0);
  }

  const paso = pasos[i];
  const total = pasos.length;

  // Medición continua: la lista scrollea sola hasta el elemento y los filtros se
  // acomodan; con un solo `getBoundingClientRect` el agujero quedaba corrido.
  useEffect(() => {
    if (!abierto) return;
    let raf = 0;
    const medir = () => {
      const el = paso?.target ? document.querySelector<HTMLElement>(paso.target) : null;
      const r = el?.getBoundingClientRect();
      const nueva: Caja | null =
        r && r.width > 0 && r.height > 0
          ? { top: r.top, left: r.left, width: r.width, height: r.height }
          : null;
      if (!mismaCaja(cajaRef.current, nueva)) {
        cajaRef.current = nueva;
        setCaja(nueva);
      }
      setVentana((v) =>
        v.w === window.innerWidth && v.h === window.innerHeight
          ? v
          : { w: window.innerWidth, h: window.innerHeight },
      );
      raf = requestAnimationFrame(medir);
    };
    raf = requestAnimationFrame(medir);
    return () => cancelAnimationFrame(raf);
  }, [abierto, paso]);

  // Llevar la pantalla hasta el elemento del paso.
  useEffect(() => {
    if (!abierto || !paso?.target) return;
    const el = document.querySelector<HTMLElement>(paso.target);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [abierto, paso]);

  const siguiente = () => {
    if (i + 1 < total) setI(i + 1);
    else (onTerminar ?? onCerrar)();
  };
  const anterior = () => setI((n) => Math.max(0, n - 1));

  useEffect(() => {
    if (!abierto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
      else if (e.key === "ArrowRight") siguiente();
      else if (e.key === "ArrowLeft") anterior();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!abierto || !paso || typeof document === "undefined") return null;

  const { w: vw, h: vh } = ventana;
  const angosto = vw < 640;

  // En celular la tarjeta va fija abajo: al lado de un elemento no entra y
  // termina tapando justamente lo que se quiere señalar.
  const pos = (() => {
    if (angosto || !caja) return null;
    const cabeAbajo = caja.top + caja.height + PAD + 12 + ALTO_TARJETA < vh;
    const top = cabeAbajo
      ? caja.top + caja.height + PAD + 12
      : Math.max(12, caja.top - PAD - 12 - ALTO_TARJETA);
    const left = Math.min(
      Math.max(12, caja.left + caja.width / 2 - ANCHO_TARJETA / 2),
      vw - ANCHO_TARJETA - 12,
    );
    return { top, left };
  })();

  const sombra = "fixed bg-foreground/45 supports-backdrop-filter:backdrop-blur-[1px]";

  return createPortal(
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="Recorrido guiado">
      {/* La sombra va en cuatro piezas alrededor del elemento: así el agujero es
          el elemento REAL y se lo puede tocar mientras el recorrido lo explica. */}
      {caja ? (
        <>
          <div className={sombra} style={{ top: 0, left: 0, width: "100%", height: Math.max(0, caja.top - PAD) }} />
          <div
            className={sombra}
            style={{
              top: Math.max(0, caja.top - PAD),
              left: 0,
              width: Math.max(0, caja.left - PAD),
              height: caja.height + PAD * 2,
            }}
          />
          <div
            className={sombra}
            style={{
              top: Math.max(0, caja.top - PAD),
              left: caja.left + caja.width + PAD,
              right: 0,
              height: caja.height + PAD * 2,
            }}
          />
          <div
            className={sombra}
            style={{ top: caja.top + caja.height + PAD, left: 0, width: "100%", bottom: 0 }}
          />
          <div
            className="pointer-events-none fixed rounded-lg ring-2 ring-[#0088D1] ring-offset-2 ring-offset-transparent transition-all duration-200 motion-safe:animate-pulse"
            style={{
              top: caja.top - PAD,
              left: caja.left - PAD,
              width: caja.width + PAD * 2,
              height: caja.height + PAD * 2,
            }}
          />
        </>
      ) : (
        <div className={`${sombra} inset-0`} />
      )}

      <div
        className={
          angosto || !pos
            ? "fixed inset-x-3 bottom-3 rounded-xl border border-border bg-card p-4 shadow-lg"
            : "fixed rounded-xl border border-border bg-card p-4 shadow-lg"
        }
        style={pos ? { top: pos.top, left: pos.left, width: ANCHO_TARJETA } : undefined}
      >
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Salir del recorrido"
          className="absolute right-2 top-2 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X size={15} />
        </button>

        <p className="pr-7 text-[13px] font-bold text-foreground">{paso.titulo}</p>
        <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{paso.texto}</p>

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
          <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
            {i + 1} de {total}
          </span>
          <div className="flex items-center gap-1.5">
            {i > 0 && (
              <button
                type="button"
                onClick={anterior}
                className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-2.5 text-[12px] font-semibold text-muted-foreground hover:bg-muted"
              >
                <ChevronLeft size={13} />
                Atrás
              </button>
            )}
            <button
              type="button"
              onClick={siguiente}
              className="inline-flex h-8 items-center gap-1 rounded-md bg-[#0088D1] px-3 text-[12px] font-bold text-white hover:bg-[#0077BA]"
            >
              {i + 1 === total ? "Listo" : "Siguiente"}
              {i + 1 < total && <ChevronRight size={13} />}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
