"use client";

/**
 * Las dos cosas de la pantalla de "página no encontrada" que necesitan el
 * navegador: mostrar la dirección que se intentó abrir y el botón de volver.
 *
 * La dirección se muestra porque casi siempre explica sola qué pasó — un link
 * viejo pegado en un mail, una dirección escrita a mano con un error. Sin verla,
 * el que reporta el problema no tiene qué contar.
 */

import { useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DatoError } from "./MarcoError";

/** La dirección no cambia sola: no hay a qué suscribirse. */
const sinSuscripcion = () => () => {};

/** La dirección que se quiso abrir. Se lee del navegador y se pinta recién del
 *  lado del cliente: el HTML que arma el servidor para un 404 no la conoce, así
 *  que dibujarla antes descuadraría la hidratación. */
export function RutaBuscada() {
  const ruta = useSyncExternalStore(
    sinSuscripcion,
    () => window.location.pathname,
    () => null,
  );

  if (!ruta || ruta === "/") return null;

  return <DatoError>{ruta}</DatoError>;
}

/** Volver a la pantalla anterior. Si se entró directo desde un link pegado no hay
 *  "anterior" a la que volver, así que en ese caso lleva al inicio. */
export function BotonVolver() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push("/");
      }}
      className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full px-4 sm:w-auto")}
    >
      <ArrowLeft size={16} />
      Volver atrás
    </button>
  );
}
