"use client";

import { useEffect } from "react";

/**
 * Abre el diálogo de impresión apenas la página está lista de verdad.
 *
 * El disparo a ciegas con un setTimeout alcanzaba para una tabla de texto, pero
 * el legajo trae la foto del chofer y el logo desde otro origen: si el diálogo
 * abre antes de que bajen, el PDF sale con los huecos vacíos y no hay forma de
 * darse cuenta hasta verlo impreso. Acá se espera a las fuentes y a las
 * imágenes, con un tope por si alguna nunca carga.
 *
 * `title` cambia el título del documento, que es el nombre que Chrome propone
 * al guardar como PDF ("Legajo - Acosta, Pablo Maximo.pdf" en vez de "localhost").
 */
export default function PrintTrigger({
  title,
  esperaMaximaMs = 3000,
}: {
  title?: string;
  esperaMaximaMs?: number;
}) {
  useEffect(() => {
    let cancelado = false;
    const tituloPrevio = document.title;
    if (title) document.title = title;

    const listo = Promise.all([
      document.fonts?.ready ?? Promise.resolve(),
      ...Array.from(document.images).map((img) =>
        img.complete ? Promise.resolve() : img.decode().catch(() => undefined),
      ),
    ]);

    // Si algo queda colgado, se imprime igual: mejor un PDF con una imagen
    // faltante que una pestaña que nunca abre el diálogo.
    const tope = new Promise((r) => setTimeout(r, esperaMaximaMs));

    Promise.race([listo, tope]).then(() => {
      if (!cancelado) window.print();
    });

    return () => {
      cancelado = true;
      if (title) document.title = tituloPrevio;
    };
  }, [title, esperaMaximaMs]);

  return null;
}
