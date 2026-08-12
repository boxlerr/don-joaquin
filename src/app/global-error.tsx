"use client";

/**
 * El último recurso: lo que se dibuja cuando se cae el armado de la página entera
 * y ya no queda nada del sistema en pie, ni siquiera el layout.
 *
 * Ésta es la pantalla que hasta ahora mostraba "This page couldn't load" (el
 * global-error propio de Next 16) y que en la oficina se leyó como un problema de
 * internet. Como reemplaza al layout, tiene que traer su propio `<html>`, su
 * `<body>` y los estilos: acá no llegó a correr nada de `layout.tsx`.
 */

import "./globals.css";
import PantallaError from "@/components/errores/PantallaError";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es" className="h-full">
      <body className="h-full antialiased">
        {/* Sin layout no hay metadata: si no, la pestaña queda con la dirección cruda. */}
        <title>Error — Don Joaquín</title>
        <PantallaError reset={reset} digest={error.digest} />
      </body>
    </html>
  );
}
