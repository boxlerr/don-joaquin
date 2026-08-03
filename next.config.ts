import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
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
