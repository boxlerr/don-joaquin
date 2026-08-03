import type { MetadataRoute } from "next";

/**
 * OJO: acá NO va `disallow: "/"`.
 *
 * Parece lo intuitivo, pero es contraproducente: bloquear el rastreo hace que
 * Google nunca vuelva a leer la página y, por lo tanto, nunca vea el `noindex`
 * que la saca del buscador. El resultado queda listado igual, sin título ni
 * descripción, y para siempre.
 *
 * La desindexación real la hacen el header `X-Robots-Tag` (next.config.ts) y
 * el `<meta robots>` del layout raíz. Para que surtan efecto, el crawler tiene
 * que poder entrar y leerlos.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/" }],
  };
}
