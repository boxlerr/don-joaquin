import type { ReactNode } from "react";

/**
 * El molde de las pantallas de error a página completa (la de página no
 * encontrada y la de "se rompió algo").
 *
 * Las dos dicen lo mismo en el mismo orden: el dibujo, de qué error se trata, qué
 * pasó en una línea, y siempre —siempre— una salida. Están escritas juntas para
 * que sigan pareciéndose entre ellas y al resto del sistema; el 404 negro de Next
 * no se parecía a nada y encima no ofrecía a dónde ir.
 */
export function MarcoError({
  ilustracion,
  etiqueta,
  titulo,
  children,
}: {
  ilustracion: ReactNode;
  /** De qué error se trata, arriba del título: "Error 404". */
  etiqueta: string;
  titulo: string;
  /** La explicación, el código si hay, y los botones. */
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white px-5 py-12">
      <div className="w-full max-w-xl text-center">
        {ilustracion}

        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">
          {etiqueta}
        </p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[#0F172A] sm:text-3xl">
          {titulo}
        </h1>

        {children}
      </div>

      <p className="mt-12 text-[13px] font-medium text-neutral-400">
        Sistema de uso interno — <span className="text-[#0088D1]">Don Joaquín Hnos. SRL</span>
      </p>
    </main>
  );
}

/** El párrafo que explica qué pasó. */
export function TextoError({ children }: { children: ReactNode }) {
  return (
    <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">{children}</p>
  );
}

/** Un dato suelto para leer o copiar: la dirección que no existe, el código del error. */
export function DatoError({ children }: { children: ReactNode }) {
  return (
    <p className="mt-5 flex justify-center">
      <span className="max-w-full truncate rounded-md border border-border bg-muted/50 px-3 py-1.5 font-mono text-[13px] text-muted-foreground">
        {children}
      </span>
    </p>
  );
}

/** Los botones: en el celular uno abajo del otro y a lo ancho, con el dedo. */
export function AccionesError({ children }: { children: ReactNode }) {
  return (
    <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">{children}</div>
  );
}
