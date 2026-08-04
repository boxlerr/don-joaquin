"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, SlidersHorizontal, type LucideIcon } from "lucide-react";

type Tab = { href: string; label: string; icon: LucideIcon };

const TABS: Tab[] = [
  { href: "/configuracion", label: "General", icon: SlidersHorizontal },
  { href: "/configuracion/notificaciones", label: "Notificaciones", icon: Bell },
];

/**
 * Navegación entre las subsecciones de Configuración, dentro de la misma
 * pantalla (además del sidebar). Son enlaces de ruta, así que usa un landmark
 * de navegación con aria-current — no el patrón ARIA de tabs.
 */
export default function ConfigTabs() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Secciones de configuración"
      className="flex items-center gap-1 border-b border-border -mt-2 overflow-x-auto"
    >
      {TABS.map((t) => {
        const Icon = t.icon;
        const active =
          t.href === "/configuracion"
            ? pathname === "/configuracion"
            : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`relative flex shrink-0 items-center gap-2 whitespace-nowrap px-3 sm:px-4 py-3 sm:py-2.5 text-sm font-medium transition-colors ${
              active ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon size={15} className="shrink-0" />
            {t.label}
            {active && (
              <span className="absolute bottom-[-1px] left-0 right-0 h-0.5 rounded-full bg-[#0088D1]" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
