import Link from "next/link";
import { Wallet, Landmark, Receipt, type LucideIcon } from "lucide-react";

export type CajaTabId = "diaria" | "grande" | "gastos";

/**
 * Solapas de Caja, todas al mismo nivel: Caja chica · Caja general · Gastos.
 *
 * "Caja chica" es la operativa, acotada al último mes; "Caja general" es la
 * vista de dirección, que unifica el historial completo de las dos cajas
 * (pedido 29/07). Las tres son rutas, así que se navega con enlaces y la activa
 * llega por prop desde el server (sin hooks de cliente).
 */
export default function CajaTabs({
  activa,
  showGrande,
  showGastos,
}: {
  activa: CajaTabId;
  /** La vista general es subsección confidencial (caja_grande): sólo si la tiene. */
  showGrande: boolean;
  /** Gastos depende de la subsección "gastos". */
  showGastos: boolean;
}) {
  const tabs: { id: CajaTabId; label: string; href: string; icon: LucideIcon }[] = [
    { id: "diaria", label: "Caja chica", href: "/caja", icon: Wallet },
    ...(showGrande
      ? [{ id: "grande" as const, label: "Caja general", href: "/caja?caja=grande", icon: Landmark }]
      : []),
    ...(showGastos
      ? [{ id: "gastos" as const, label: "Gastos", href: "/caja/gastos", icon: Receipt }]
      : []),
  ];

  if (tabs.length === 1) return null;

  return (
    <nav
      aria-label="Secciones de caja"
      className="flex items-center gap-1 border-b border-border mb-5"
    >
      {tabs.map((t) => {
        const Icon = t.icon;
        const active = activa === t.id;
        return (
          <Link
            key={t.id}
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
