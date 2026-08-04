import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Don Joaquín — Sistema de Gestión Logística",
  description: "Sistema de gestión logística y administrativa para Don Joaquín Hnos. SRL",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
};

// El sistema se usa desde el celular (Julián, 04/08). `viewportFit: cover` deja
// que el contenido llegue al borde en iPhone con notch; el padding real lo pone
// el CSS con env(safe-area-inset-*). NO se limita `maximumScale`: bloquear el
// zoom rompe la accesibilidad, y el zoom automático de iOS al tocar un campo se
// evita con el tamaño de fuente de 16px de globals.css, no capando el pinch.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0F172A",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${inter.variable} h-full`}>
      <body className="h-full antialiased font-[var(--font-inter),sans-serif]">
        {children}
      </body>
    </html>
  );
}
