"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import EnviarEnlaceDialog from "./EnviarEnlaceDialog";

/**
 * El botón que abre el diálogo del enlace.
 *
 * Existe sólo para que la página siga siendo un Server Component: el diálogo
 * necesita estado, y meterlo entero en la cabecera obligaría a marcar toda la
 * pantalla como cliente.
 */
export default function BotonEnviarEnlace({ puedeRotar }: { puedeRotar: boolean }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted/60"
      >
        <Share2 size={14} />
        Enviar el enlace
      </button>
      <EnviarEnlaceDialog open={abierto} onOpenChange={setAbierto} puedeRotar={puedeRotar} />
    </>
  );
}
