"use client";

/**
 * Pantalla de "se rompió algo": la que aparece cuando una pantalla se cae en
 * pleno uso.
 *
 * Hasta acá salía la de Next 16 —el triángulo con "This page couldn't load"— que
 * ya hizo perder tiempo: cuando la reportó la oficina (03/08/2026, cargando un
 * legajo) el primer diagnóstico fue "se te cortó internet", y en realidad era una
 * excepción nuestra en pleno render. La pantalla no decía ni de qué lado estaba
 * el problema.
 *
 * Por eso ésta dice tres cosas: que el problema es del sistema y no de quien está
 * del otro lado, que se puede reintentar sin perder nada, y el código del error
 * para que reportarlo sirva de algo (esos crashes son del navegador: en los logs
 * del servidor no queda absolutamente nada).
 */

import { Home, RotateCw } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import CamionRoto from "@/components/errores/CamionRoto";
import {
  MarcoError,
  TextoError,
  DatoError,
  AccionesError,
} from "@/components/errores/MarcoError";

export default function PantallaError({
  reset,
  digest,
}: {
  /** Vuelve a dibujar la pantalla que se cayó, sin recargar todo. */
  reset: () => void;
  /** El código con el que Next identifica el error. No siempre viene. */
  digest?: string;
}) {
  return (
    <MarcoError
      ilustracion={<CamionRoto className="mx-auto h-auto w-full max-w-[420px]" />}
      etiqueta="Error del sistema"
      titulo="Esta pantalla no se pudo abrir"
    >
      <TextoError>
        Se rompió algo de este lado: no es tu conexión ni nada que hayas hecho mal. Probá de nuevo,
        que lo que ya estaba guardado sigue estando.
      </TextoError>

      {digest && (
        <>
          <DatoError>Código: {digest}</DatoError>
          <p className="mt-2 text-xs text-muted-foreground/70">
            Si vuelve a pasar, avisá y pasá ese código: con eso se encuentra qué falló.
          </p>
        </>
      )}

      <AccionesError>
        <button
          type="button"
          onClick={reset}
          className={cn(buttonVariants({ variant: "brand", size: "lg" }), "w-full px-4 sm:w-auto")}
        >
          <RotateCw size={16} />
          Reintentar
        </button>
        {/* Link común y no <Link>: después de un crash, recargar la página entera
            es más confiable que pedirle al sistema roto que navegue solo. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/"
          className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full px-4 sm:w-auto")}
        >
          <Home size={16} />
          Ir al inicio
        </a>
      </AccionesError>
    </MarcoError>
  );
}
