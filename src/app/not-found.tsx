/**
 * Pantalla de página no encontrada (404).
 *
 * Hasta acá, cualquier dirección mal escrita caía en el 404 negro de Next: una
 * pantalla que no se parece en nada al sistema, no dice qué pasó y —lo peor— no
 * tiene ni un link para salir. El que llegaba ahí tenía que volver a escribir la
 * dirección a mano.
 *
 * Ahora la pantalla es del sistema y siempre ofrece una salida: "Ir al inicio"
 * apunta a `/`, que manda al panel si la sesión está abierta y al login si no
 * — así el botón nunca lleva a otra pantalla que no se puede abrir.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { Home } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import CamionSinNafta from "@/components/errores/CamionSinNafta";
import { MarcoError, TextoError, AccionesError } from "@/components/errores/MarcoError";
import { RutaBuscada, BotonVolver } from "@/components/errores/AccionesNotFound";

export const metadata: Metadata = {
  title: "Página no encontrada — Don Joaquín",
};

export default function NotFound() {
  return (
    <MarcoError
      ilustracion={<CamionSinNafta className="mx-auto h-auto w-full max-w-[420px]" />}
      etiqueta="Error 404"
      titulo="Esta página no existe"
    >
      <TextoError>
        Nos quedamos sin nafta buscándola. Puede que el link esté viejo, que se haya copiado
        cortado, o que esa pantalla ya no se llame así.
      </TextoError>

      <RutaBuscada />

      <AccionesError>
        <Link
          href="/"
          className={cn(buttonVariants({ variant: "brand", size: "lg" }), "w-full px-4 sm:w-auto")}
        >
          <Home size={16} />
          Ir al inicio
        </Link>
        <BotonVolver />
      </AccionesError>
    </MarcoError>
  );
}
