import Link from "next/link";
import { Trophy, TriangleAlert, ChevronRight } from "lucide-react";
import type { RankingChofer } from "@/app/(dashboard)/choferes/ranking/lib";
import ScoreBadge from "@/app/(dashboard)/choferes/ranking/ScoreBadge";
import { choferSlug } from "@/lib/chofer-slug";

interface Props {
  top: RankingChofer[];
  bottom: RankingChofer[];
}

function fmtNum(n: number) {
  return n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

/** Pesos compactos para la línea de detalle del chofer ($ 1,2 M / $ 350 k). */
function fmtMoneyCompact(n: number) {
  if (n >= 1_000_000) return `$ ${(n / 1_000_000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} M`;
  if (n >= 1_000) return `$ ${(n / 1_000).toLocaleString("es-AR", { maximumFractionDigits: 0 })} k`;
  return `$ ${fmtNum(n)}`;
}

export default function TopBottomChoferes({ top, bottom }: Props) {
  const sinDatos = top.length === 0 && bottom.length === 0;

  if (sinDatos) {
    return (
      <div className="bg-card rounded-[8px] border border-border shadow-sm p-6">
        <div className="flex items-center gap-2 mb-1">
          <Trophy size={16} className="text-amber-500" />
          <h2 className="text-foreground text-sm font-bold">Ranking del mes</h2>
        </div>
        <p className="text-muted-foreground text-xs">
          Aún no hay choferes con actividad este mes. Cargá viajes para ver el ranking.
        </p>
        <Link
          href="/viajes"
          className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 hover:underline transition-colors"
        >
          Registrar viajes →
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ChoferList
        items={top}
        title="Top 5 del mes"
        subtitle="Mejor score operativo"
        icon={Trophy}
        accent="emerald"
        emptyText="Sin choferes con actividad este mes."
      />
      <ChoferList
        items={bottom}
        title="Atención requerida"
        subtitle="5 con score más bajo"
        icon={TriangleAlert}
        accent="rose"
        emptyText="No hay choferes con score bajo este mes."
      />
    </div>
  );
}

interface ListProps {
  items: RankingChofer[];
  title: string;
  subtitle: string;
  icon: typeof Trophy;
  accent: "emerald" | "rose";
  emptyText: string;
}

function ChoferList({ items, title, subtitle, icon: Icon, accent, emptyText }: ListProps) {
  const iconColor =
    accent === "emerald"
      ? "text-[#10B981]"
      : "text-[#EF4444]";

  return (
    <div className="bg-card rounded-[8px] border border-border shadow-sm flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Icon size={16} className={iconColor} />
          <div>
            <h2 className="text-foreground text-sm font-bold leading-tight">{title}</h2>
            <p className="text-muted-foreground text-[11px] mt-0.5">{subtitle}</p>
          </div>
        </div>
        <Link
          href="/choferes/ranking"
          className="text-xs font-semibold text-primary hover:text-primary/80 hover:underline transition-colors shrink-0"
        >
          Ver todo →
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="px-5 py-8 text-center text-muted-foreground text-xs">
          {emptyText}
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((r, idx) => (
            <li key={r.id}>
              <Link
                href={`/choferes/${choferSlug(r)}?tab=productividad`}
                className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors group"
              >
                <span className="w-5 text-center text-sm font-semibold text-muted-foreground">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground text-sm leading-tight truncate">
                    {r.apellido}, {r.nombre}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {r.viajes_count} {r.viajes_count === 1 ? "viaje" : "viajes"} ·{" "}
                    {fmtNum(r.km_total)} km · {r.pct_vacios.toFixed(0)}% vacíos
                    {r.facturacion_total > 0 && (
                      <span className="text-[#10B981] font-medium">
                        {" "}· {fmtMoneyCompact(r.facturacion_total)}
                      </span>
                    )}
                  </p>
                </div>
                <ScoreBadge score={r.score} size="sm" />
                <ChevronRight
                  size={14}
                  className="text-muted-foreground/40 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all shrink-0"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
