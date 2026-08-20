import Link from "next/link";
import { Trophy, ChevronRight } from "lucide-react";
import type { RankingChofer } from "@/app/(dashboard)/choferes/ranking/lib";
import ScoreBadge from "@/app/(dashboard)/choferes/ranking/ScoreBadge";
import AvatarPersona from "@/components/ui/AvatarPersona";
import { choferSlug } from "@/lib/chofer-slug";

function fmtNum(n: number) {
  return n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

/** Pesos compactos para la línea de detalle del chofer ($ 1,2 M / $ 350 k). */
function fmtMoneyCompact(n: number) {
  if (n >= 1_000_000) return `$ ${(n / 1_000_000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} M`;
  if (n >= 1_000) return `$ ${(n / 1_000).toLocaleString("es-AR", { maximumFractionDigits: 0 })} k`;
  return `$ ${fmtNum(n)}`;
}

interface ListProps {
  items: RankingChofer[];
  title: string;
  subtitle: string;
  icon: typeof Trophy;
  accent: "emerald" | "rose";
  emptyText: string;
  /**
   * Mostrar el "· $X" facturado por chofer. Default false: en el dashboard
   * general no van montos (los ve solo dirección en /dashboard/completo).
   */
  mostrarFacturacion?: boolean;
  /** Numera del 1 al 5 (el podio). En "atención requerida" no tiene sentido. */
  conPuesto?: boolean;
}

/**
 * Lista de choferes del ranking. Se usa dos veces en el dashboard —el podio del
 * mes y los que necesitan atención— en lugares distintos de la grilla, por eso
 * cada una se coloca por su cuenta en vez de venir de a pares.
 */
export default function ChoferList({
  items,
  title,
  subtitle,
  icon: Icon,
  accent,
  emptyText,
  mostrarFacturacion = false,
  conPuesto = false,
}: ListProps) {
  const iconColor = accent === "emerald" ? "text-[#10B981]" : "text-[#EF4444]";

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[12px] border border-border bg-card shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3.5 sm:px-5 sm:py-4">
        <div className="flex min-w-0 items-center gap-2">
          <Icon size={16} className={`shrink-0 ${iconColor}`} />
          <div className="min-w-0">
            <h2 className="text-sm font-bold leading-tight text-foreground">{title}</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <Link
          href="/choferes/ranking"
          className="inline-flex shrink-0 items-center max-md:h-9 text-xs font-semibold text-primary transition-colors hover:text-primary/80 hover:underline"
        >
          Ver todo →
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-4 py-8 text-center text-xs text-muted-foreground sm:px-5">{emptyText}</div>
      ) : (
        <ul className="flex flex-1 flex-col divide-y divide-border">
          {items.map((r, idx) => (
            <li key={r.id} className="flex-1">
              <Link
                href={`/choferes/${choferSlug(r)}?tab=productividad`}
                className="group flex h-full items-center gap-2.5 px-3 py-2.5 transition-colors hover:bg-muted/30 sm:gap-3 sm:px-4"
              >
                {conPuesto && (
                  // El puesto va como medalla: el 1 se distingue del resto de
                  // un vistazo, que es lo único que se mira en un top 5.
                  <span
                    className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${
                      idx === 0
                        ? "bg-[#FFB300] text-white shadow-[0_2px_6px_-1px_rgba(255,179,0,0.7)]"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {idx + 1}
                  </span>
                )}
                <AvatarPersona name={`${r.apellido}, ${r.nombre}`} rol="chofer" size={30} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold leading-tight text-foreground">
                    {r.apellido}, {r.nombre}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {r.viajes_count} {r.viajes_count === 1 ? "viaje" : "viajes"} ·{" "}
                    {fmtNum(r.km_total)} km · {r.pct_vacios.toFixed(0)}% vacíos
                    {mostrarFacturacion && r.facturacion_total > 0 && (
                      <span className="font-medium text-[#10B981]">
                        {" "}· {fmtMoneyCompact(r.facturacion_total)}
                      </span>
                    )}
                  </p>
                </div>
                <span className="shrink-0">
                  <ScoreBadge score={r.score} size="sm" />
                </span>
                <ChevronRight
                  size={14}
                  className="shrink-0 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-muted-foreground"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
