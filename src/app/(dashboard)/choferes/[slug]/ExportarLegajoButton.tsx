"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download, FileText, Lock } from "lucide-react";

/**
 * Abre el legajo maquetado en una pestaña nueva; el navegador abre solo el
 * diálogo de impresión, donde se elige "Guardar como PDF".
 *
 * Es el mismo camino que el resto de los documentos del sistema (ranking,
 * planilla diaria): el repo no genera PDFs en el servidor.
 *
 * Los sueldos van aparte porque son confidenciales: el legajo se imprime y
 * circula, y no es lo mismo que salga con los montos.
 */
export default function ExportarLegajoButton({
  choferId,
  canVerSueldos,
}: {
  choferId: string;
  canVerSueldos: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const cerrar = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", cerrar);
    return () => document.removeEventListener("mousedown", cerrar);
  }, [abierto]);

  const base = `/choferes/${choferId}/legajo`;

  // Sin permiso de sueldos no hay nada que elegir: un solo click.
  if (!canVerSueldos) {
    return (
      <Button
        variant="outline"
        className="h-10 w-full border-[#CBD5E1] px-4 text-sm text-foreground/90 hover:bg-muted/40 sm:w-auto sm:flex-shrink-0"
        onClick={() => window.open(base, "_blank", "noopener,noreferrer")}
      >
        <Download size={15} className="mr-2 text-primary" />
        Exportar
      </Button>
    );
  }

  return (
    <div className="relative w-full sm:w-auto sm:flex-shrink-0" ref={ref}>
      <Button
        variant="outline"
        className="h-10 w-full border-[#CBD5E1] px-4 text-sm text-foreground/90 hover:bg-muted/40 sm:w-auto"
        onClick={() => setAbierto((v) => !v)}
      >
        <Download size={15} className="mr-2 text-primary" />
        Exportar
      </Button>

      {/* En celular el menú cuelga desde la izquierda: anclado a la derecha de un
          disparador angosto se salía de la pantalla. */}
      {abierto && (
        <div className="absolute left-0 z-30 mt-1 w-[min(16rem,calc(100vw-3rem))] overflow-hidden rounded-[6px] border border-border bg-card shadow-lg sm:left-auto sm:right-0 sm:w-64">
          <button
            type="button"
            onClick={() => {
              setAbierto(false);
              window.open(base, "_blank", "noopener,noreferrer");
            }}
            className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left hover:bg-muted/60"
          >
            <FileText size={15} className="mt-0.5 shrink-0 text-primary" />
            <span>
              <span className="block text-sm font-medium text-foreground">Legajo completo</span>
              <span className="block text-[11px] text-muted-foreground">Sin los datos de sueldo</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setAbierto(false);
              window.open(`${base}?sueldos=1`, "_blank", "noopener,noreferrer");
            }}
            className="flex w-full items-start gap-2.5 border-t border-border px-3 py-2.5 text-left hover:bg-muted/60"
          >
            <Lock size={15} className="mt-0.5 shrink-0 text-[#B91C1C]" />
            <span>
              <span className="block text-sm font-medium text-foreground">Con sueldos</span>
              <span className="block text-[11px] text-muted-foreground">
                Confidencial: incluye los montos liquidados
              </span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
