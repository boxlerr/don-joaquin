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
      className="mb-5 inline-flex items-center gap-1 rounded-xl border border-border bg-muted/40 p-1"
    >
      {tabs.map((t) => {
        const Icon = t.icon;
        const active = activa === t.id;
        return (
          <Link
            key={t.id}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
              active
                ? "bg-card text-primary shadow-[0_1px_2px_rgba(15,23,42,0.06)]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon size={15} className={active ? "" : "opacity-70"} />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
