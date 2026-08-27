"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileQuestion,
  Loader2,
} from "lucide-react";

/**
 * Visor de documentos DENTRO de la aplicación.
 *
 * Antes, ver el papel de un documento abría una pestaña nueva con la URL del
 * Storage: se perdía la pantalla, el filtro y el lugar de la lista, y volver
 * era un ejercicio de memoria. Acá el PDF se abre encima de la pantalla y se
 * cierra con Escape, que es como se mira un papel: de reojo y sin irse.
 *
 * El componente no busca nada: recibe la URL ya firmada (la pide quien lo abre)
 * y decide cómo mostrarla. PDF va en un marco —lo dibuja el visor del propio
 * navegador, con su zoom y su botón de imprimir—, las fotos van como foto, y lo
 * que no se puede previsualizar (un Excel, un Word) lo dice y ofrece bajarlo.
 *
 * **Varios archivos a la vez** (27/08/2026). Un trabajo del taller son casi
 * siempre dos fotos —el antes y el después— y mirarlas era abrir una, cerrar,
 * abrir la otra. Pasándole `archivos` en vez de `archivo` se pasa de una a la
 * siguiente con las flechas, con el teclado o arrastrando el dedo, sin salir.
 * Con un solo archivo se ve y se comporta exactamente igual que antes: la
 * navegación no aparece.
 */

export type ArchivoParaVer = {
  nombre: string;
  /** URL firmada para VER en el navegador. */
  url: string;
  /** URL firmada que fuerza la descarga con el nombre real. */
  downloadUrl?: string;
  mime?: string | null;
};

function esPdf(a: ArchivoParaVer): boolean {
  return (a.mime ?? "").includes("pdf") || /\.pdf$/i.test(a.nombre);
}

function esImagen(a: ArchivoParaVer): boolean {
  return (a.mime ?? "").startsWith("image/") || /\.(png|jpe?g|gif|webp|heic|avif)$/i.test(a.nombre);
}

/** Qué tan lejos hay que arrastrar para que cuente como "pasar a la otra". */
const SWIPE_MIN = 48;

export default function VisorArchivo({
  archivo,
  archivos,
  indice,
  onIndice,
  cargando = false,
  error,
  open,
  onOpenChange,
  titulo,
}: {
  archivo?: ArchivoParaVer | null;
  /** Varios archivos para pasar de uno a otro sin cerrar. Gana sobre `archivo`. */
  archivos?: ArchivoParaVer[];
  /** Cuál abrir primero. Sólo se lee al abrir; después manda el visor. */
  indice?: number;
  /** Avisa en cuál quedó, por si quien lo abrió quiere recordarlo. */
  onIndice?: (i: number) => void;
  cargando?: boolean;
  error?: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Contexto de quién es el papel (patente, chofer, tipo de documento). */
  titulo?: string;
}) {
  const lista = archivos ?? (archivo ? [archivo] : []);
  const [idx, setIdx] = useState(indice ?? 0);
  const actual: ArchivoParaVer | null = lista[idx] ?? lista[0] ?? null;
  const hayVarios = lista.length > 1;

  // Al abrir arranca donde pidió quien lo abrió; a partir de ahí el índice es
  // del visor. Si lo mandara la prop en cada render, pasar a la foto siguiente
  // volvería sola a la primera. Se ajusta en el render —el patrón de React para
  // "resetear estado cuando cambia una prop"— y no por efecto, que agregaría un
  // dibujado de más mostrando la foto equivocada.
  const [estabaAbierto, setEstabaAbierto] = useState(open);
  if (open !== estabaAbierto) {
    setEstabaAbierto(open);
    if (open) setIdx(indice ?? 0);
  }

  const mover = useCallback(
    (paso: number) => {
      if (lista.length < 2) return;
      setIdx((i) => {
        // Da la vuelta: en una tira de dos fotos, tener que volver para atrás
        // para ver la otra es un paso de más.
        const n = (i + paso + lista.length) % lista.length;
        onIndice?.(n);
        return n;
      });
    },
    [lista.length, onIndice],
  );

  // Flechas del teclado, que es como se mira una tanda de fotos en la compu.
  useEffect(() => {
    if (!open || !hayVarios) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") mover(-1);
      if (e.key === "ArrowRight") mover(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, hayVarios, mover]);

  // Arrastrar con el dedo. El taller mira estas fotos desde el teléfono: sin
  // esto habría que apuntarle a una flecha chica al costado de la pantalla.
  const tocoEn = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    tocoEn.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const desde = tocoEn.current;
    tocoEn.current = null;
    if (desde == null) return;
    const corrio = (e.changedTouches[0]?.clientX ?? desde) - desde;
    if (Math.abs(corrio) < SWIPE_MIN) return;
    mover(corrio < 0 ? 1 : -1);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Ancho de pantalla completa menos un margen: un PDF A4 achicado a 500px
          no se lee, y el punto de traerlo acá adentro era justamente leerlo. */}
      <DialogContent className="grid h-[88dvh] max-h-[88dvh] w-[min(76rem,95vw)] max-w-[95vw] grid-rows-[auto_1fr] gap-3 overflow-hidden p-3 sm:max-w-[95vw] sm:p-4">
        <DialogHeader className="pr-8">
          <DialogTitle className="truncate text-base text-foreground sm:text-lg">
            {actual?.nombre ?? titulo ?? "Documento"}
          </DialogTitle>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {hayVarios && (
              <span className="text-xs tabular-nums text-muted-foreground">
                {idx + 1} de {lista.length}
              </span>
            )}
            {titulo && actual?.nombre && (
              <span className="text-xs text-muted-foreground">{titulo}</span>
            )}
            {actual && (
              <>
                <a
                  href={actual.downloadUrl ?? actual.url}
                  download={actual.nombre}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  <Download size={12} />
                  Descargar
                </a>
                <a
                  href={actual.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary"
                >
                  <ExternalLink size={12} />
                  Abrir en otra pestaña
                </a>
              </>
            )}
          </div>
        </DialogHeader>

        <div className="relative min-h-0 overflow-hidden rounded-lg border border-border bg-muted/30">
          {cargando ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <Loader2 size={20} className="mr-2 animate-spin" />
              Abriendo el documento…
            </div>
          ) : error ? (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-[#991B1B]">
              {error}
            </div>
          ) : !actual ? null : esPdf(actual) ? (
            <iframe src={actual.url} title={actual.nombre} className="h-full w-full border-0" />
          ) : esImagen(actual) ? (
            <div
              className="flex h-full items-center justify-center overflow-auto p-2"
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={actual.url}
                alt={actual.nombre}
                className="max-h-full max-w-full object-contain"
              />
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <FileQuestion size={32} className="text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Este tipo de archivo no se puede ver acá adentro.
              </p>
              <a
                href={actual.downloadUrl ?? actual.url}
                download={actual.nombre}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:border-[#0088D1] hover:bg-[#E1F5FE] hover:text-primary"
              >
                <Download size={13} />
                Descargar {actual.nombre}
              </a>
            </div>
          )}

          {/* Las flechas van encima del archivo y no debajo: al costado de la
              foto es donde se las busca, y en el teléfono son el objetivo más
              grande de la pantalla. */}
          {hayVarios && !cargando && !error && (
            <>
              <button
                type="button"
                onClick={() => mover(-1)}
                aria-label="Ver la anterior"
                className="absolute left-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card/90 text-foreground shadow-sm backdrop-blur transition-colors hover:bg-card"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                type="button"
                onClick={() => mover(1)}
                aria-label="Ver la siguiente"
                className="absolute right-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card/90 text-foreground shadow-sm backdrop-blur transition-colors hover:bg-card"
              >
                <ChevronRight size={20} />
              </button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
