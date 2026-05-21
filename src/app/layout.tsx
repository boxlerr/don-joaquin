import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider, THEME_STORAGE_KEY } from "@/components/layout/ThemeProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Don Joaquín — Sistema de Gestión Logística",
  description: "Sistema de gestión logística y administrativa para Don Joaquín Hnos. SRL",
};

const themeInitScript = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");var d=t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches);var e=document.documentElement;if(d){e.classList.add("dark");e.style.colorScheme="dark";}else{e.style.colorScheme="light";}}catch(_){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="h-full antialiased font-[var(--font-inter),sans-serif]">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
