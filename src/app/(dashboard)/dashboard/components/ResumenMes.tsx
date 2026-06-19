import { Briefcase, Route, DollarSign, ChevronRight } from "lucide-react";
import type { RankingChofer } from "@/app/(dashboard)/choferes/ranking/lib";

interface Props {
  ranking: RankingChofer[];
  /** Etiqueta legible del mes en curso (ej. "junio 2026"). */
  periodoLabel: string;
}

function fmtNum(n: number): string {
  return n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

/** Formato compacto de pesos para cards ($ 1,2 M / $ 350 k / $ 980). */
function fmtMoneyCompact(n: number): string {
  if (n >= 1_000_000) return `$ ${(n / 1_000_000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} M`;
  if (n >= 1_000) return `$ ${(n / 1_000).toLocaleString("es-AR", { maximumFractionDigits: 0 })} k`;
  return `$ ${fmtNum(n)}`;
}

/**
 * Fila "Resumen del mes en curso": cards en vivo de viajes hechos, km y
 * facturación del mes, agregadas desde el ranking del período (mismo cálculo
 * que /choferes/ranking, para que los números coincidan). Cada card lleva al
 * desglose por chofer.
 */
export default function ResumenMes({ ranking, periodoLabel }: Props) {
  const activos = ranking.filter((r) => r.viajes_count > 0);
  const viajesMes = activos.reduce((s, r) => s + r.viajes_count, 0);
  const kmMes = activos.reduce((s, r) => s + r.km_total, 0);
  const kmVaciosMes = activos.reduce((s, r) => s + r.km_vacios, 0);
  const facturacionMes = activos.reduce((s, r) => s + r.facturacion_total, 0);
  const pctVacios = kmMes > 0 ? (kmVaciosMes / kmMes) * 100 : 0;
  const pesosPorKm = kmMes > 0 && facturacionMes > 0 ? facturacionMes / kmMes : 0;

  const cards = [
    {
      label: "Viajes del mes",
      value: fmtNum(viajesMes),
      sub: `${activos.length} chofer${activos.length === 1 ? "" : "es"} con actividad`,
      icon: Briefcase,
      accent: "brand" as const,
    },
    {
      label: "Km del mes",
      value: `${fmtNum(kmMes)} km`,
      sub: kmMes > 0 ? `${pctVacios.toFixed(0)}% vacíos` : "Sin recorridos",
      icon: Route,
      accent: "warning" as const,
    },
    {
      label: "Facturación del mes",
      value: fmtMoneyCompact(facturacionMes),
      sub: pesosPorKm > 0 ? `${fmtMoneyCompact(pesosPorKm)}/km` : "Sin facturación cargada",
      icon: DollarSign,
      accent: "success" as const,
    },
  ];

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-block w-1 h-4 rounded-full bg-primary" />
          <h2 className="text-sm font-bold text-foreground">
            Mes en curso · {periodoLabel}
          </h2>
        </div>
        <a
          href="/choferes/ranking"
          className="text-xs font-semibold text-primary hover:text-primary/80 hover:underline transition-colors"
        >
          Ver por chofer →
        </a>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map((c) => (
          <ResumenCard key={c.label} {...c} />
        ))}
      </div>
    </section>
  );
}

const ACCENTS = {
  brand: { from: "from-[#0088D1]", to: "to-[#004A99]", text: "text-primary" },
  warning: { from: "from-[#FFB300]", to: "to-[#D97706]", text: "text-[#D97706] dark:text-amber-300" },
  success: { from: "from-[#10B981]", to: "to-[#059669]", text: "text-[#10B981]" },
};

function ResumenCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  icon: typeof Briefcase;
  accent: keyof typeof ACCENTS;
}) {
  const a = ACCENTS[accent];
  const valueSizeClass = value.length <= 8 ? "text-3xl" : value.length <= 12 ? "text-2xl" : "text-xl";

  return (
    <a
      href="/choferes/ranking"
      className="relative overflow-hidden bg-card rounded-[8px] border border-border p-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)] dark:shadow-none transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 hover:border-primary/50 group flex items-center gap-4 cursor-pointer"
    >
      <div
        className={`w-12 h-12 rounded-full bg-gradient-to-br ${a.from} ${a.to} flex items-center justify-center text-white shrink-0 shadow-[0_4px_10px_rgba(0,0,0,0.05)] transition-transform duration-300 group-hover:scale-110`}
      >
        <Icon size={20} strokeWidth={2.5} />
      </div>
      <div className="space-y-1 min-w-0 flex-1 z-10">
        <p className="text-muted-foreground text-[10px] font-extrabold uppercase tracking-wider leading-none">
          {label}
        </p>
        <p className={`${valueSizeClass} font-black tracking-tight ${a.text} whitespace-nowrap leading-none`}>
          {value}
        </p>
        <p className="text-muted-foreground/80 text-xs font-semibold leading-none">{sub}</p>
      </div>
      <ChevronRight
        size={16}
        className="text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0 z-10"
      />
    </a>
  );
}
