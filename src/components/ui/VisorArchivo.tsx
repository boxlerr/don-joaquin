"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, ExternalLink, FileQuestion, Loader2 } from "lucide-react";

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

export default function VisorArchivo({
  archivo,
  cargando = false,
  error,
  open,
  onOpenChange,
  titulo,
}: {
  archivo: ArchivoParaVer | null;
  cargando?: boolean;
  error?: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Contexto de quién es el papel (patente, chofer, tipo de documento). */
  titulo?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Ancho de pantalla completa menos un margen: un PDF A4 achicado a 500px
          no se lee, y el punto de traerlo acá adentro era justamente leerlo. */}
      <DialogContent className="grid h-[88dvh] max-h-[88dvh] w-[min(76rem,95vw)] max-w-[95vw] grid-rows-[auto_1fr] gap-3 overflow-hidden p-3 sm:max-w-[95vw] sm:p-4">
        <DialogHeader className="pr-8">
          <DialogTitle className="truncate text-base text-foreground sm:text-lg">
            {archivo?.nombre ?? titulo ?? "Documento"}
          </DialogTitle>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {titulo && archivo?.nombre && (
              <span className="text-xs text-muted-foreground">{titulo}</span>
            )}
            {archivo && (
              <>
                <a
                  href={archivo.downloadUrl ?? archivo.url}
                  download={archivo.nombre}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  <Download size={12} />
                  Descargar
                </a>
                <a
                  href={archivo.url}
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

        <div className="min-h-0 overflow-hidden rounded-lg border border-border bg-muted/30">
          {cargando ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <Loader2 size={20} className="mr-2 animate-spin" />
              Abriendo el documento…
            </div>
          ) : error ? (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-[#991B1B]">
              {error}
            </div>
          ) : !archivo ? null : esPdf(archivo) ? (
            <iframe src={archivo.url} title={archivo.nombre} className="h-full w-full border-0" />
          ) : esImagen(archivo) ? (
            <div className="flex h-full items-center justify-center overflow-auto p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={archivo.url}
                alt={archivo.nombre}
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
                href={archivo.downloadUrl ?? archivo.url}
                download={archivo.nombre}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:border-[#0088D1] hover:bg-[#E1F5FE] hover:text-primary"
              >
                <Download size={13} />
                Descargar {archivo.nombre}
              </a>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
