import type { Metadata } from "next";
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${inter.variable} h-full`}>
      <body className="h-full antialiased font-[var(--font-inter),sans-serif]">{children}</body>
    </html>
  );
}
