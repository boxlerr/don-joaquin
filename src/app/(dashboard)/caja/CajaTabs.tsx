"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wallet, Receipt, type LucideIcon } from "lucide-react";

type Tab = { href: string; label: string; icon: LucideIcon };

const TABS: Tab[] = [
  { href: "/caja", label: "Movimientos", icon: Wallet },
  { href: "/caja/gastos", label: "Gastos", icon: Receipt },
];

/**
 * Navegación entre las pantallas de Caja. Gastos dejó de ser una sección propia
 * del sidebar (es un tipo de egreso de la caja) y pasó a ser una solapa de acá.
 * Mismo patrón que ConfigTabs: son enlaces de ruta, así que usa un landmark de
 * navegación con aria-current — no el patrón ARIA de tabs.
 *
 * Si el usuario no tiene la subsección "gastos" no se muestra nada: la pantalla
 * queda igual que antes.
 */
export default function CajaTabs({ showGastos }: { showGastos: boolean }) {
  const pathname = usePathname();

  if (!showGastos) return null;

  return (
    <nav
      aria-label="Secciones de caja"
      className="flex items-center gap-1 border-b border-border mb-5"
    >
      {TABS.map((t) => {
        const Icon = t.icon;
        const active = t.href === "/caja" ? pathname === "/caja" : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              active ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon size={15} />
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
