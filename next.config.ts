import type { NextConfig } from "next";

/**
 * El host del Storage, sacado de la env para no clavar el proyecto acá.
 *
 * Hace falta para que Next pueda achicar las fotos que se sacan desde el
 * teléfono: una foto de cámara son 2,6 MB y 3024x4032 px, y el Taller las
 * mostraba enteras para dibujar una miniatura de 112 px. Bajarlas y
 * decodificarlas dejaba el celular trabado varios segundos apenas se abría la
 * pantalla — hasta el punto de que la lista de camiones no respondía al dedo.
 */
const hostDelStorage = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname || null;
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: hostDelStorage
      ? [{ protocol: "https", hostname: hostDelStorage, pathname: "/storage/v1/object/**" }]
      : [],
    // Las URLs del Storage vienen firmadas y vencen a la hora, así que la
    // versión achicada se vuelve a generar cada tanto. Media hora de caché
    // alcanza para que abrir y volver a abrir la pantalla no la rehaga.
    minimumCacheTTL: 1800,
  },
  compiler: {
    // Elimina console.* del bundle de producción, conservando errores y warnings.
    removeConsole:
      process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "6mb",
    },
    // Tree-shaking granular de librerías con barrel exports: solo se incluye
    // en el bundle lo que realmente se importa.
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "framer-motion",
      "@tanstack/react-table",
    ],
  },
  async headers() {
    return [
      {
        // Sistema de uso interno: nada de acá debe aparecer en buscadores.
        // Va como header (y no sólo como <meta>) para que también cubra
        // imágenes, PDFs y respuestas de la API, que no llevan HTML.
        source: "/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive, nosnippet, noimageindex",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
