"use client";

/**
 * Red de contención de todo el sistema: si una pantalla se cae mientras se usa,
 * en vez del error crudo de Next aparece la pantalla de "se rompió algo".
 *
 * Atrapa lo que se rompe adentro de cualquier pantalla. Lo que se rompe MÁS
 * afuera todavía (el armado de la página entera) lo atrapa `global-error.tsx`.
 */

import PantallaError from "@/components/errores/PantallaError";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <PantallaError reset={reset} digest={error.digest} />;
}
