import type { ReactNode } from "react";
import Link from "next/link";
import { Briefcase, Route, DollarSign, ChevronRight } from "lucide-react";
import type { TotalesPeriodo } from "@/app/(dashboard)/choferes/ranking/lib";

interface Props {
  /** Totales del período sobre TODOS los viajes (coincide con "Total" de /viajes). */
  totales: TotalesPeriodo;
  /** Etiqueta legible del período (ej. "Últimos 3 meses · abr – jun"). */
  periodoLabel: string;
  /** Selector de período (client component) renderizado en el encabezado. */
  periodoSelector?: ReactNode;
  /**
   * Si es false (dashboard general) la card de facturación se reemplaza por
   * "Km vacíos del período": pedido de Bárbara de que los montos no queden
   * a la vista de todos. Los $ solo se ven en /dashboard/completo.
   */
  mostrarFacturacion: boolean;
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
 * facturación (o km vacíos, según `mostrarFacturacion`) del mes, agregadas
 * desde el ranking del período (mismo cálculo que /choferes/ranking, para que
 * los números coincidan). Cada card lleva al desglose por chofer.
 */
export default function ResumenMes({ totales, periodoLabel, periodoSelector, mostrarFacturacion }: Props) {
  const viajesMes = totales.viajes;
  const kmMes = totales.kmConCarga + totales.kmVacios;
  const kmVaciosMes = totales.kmVacios;
  const facturacionMes = totales.facturacion;
  const choferesConActividad = totales.choferesActivos;
  const pctVacios = kmMes > 0 ? (kmVaciosMes / kmMes) * 100 : 0;
  const pesosPorKm = kmMes > 0 && facturacionMes > 0 ? facturacionMes / kmMes : 0;

  const cards = [
    {
      label: "Viajes del período",
      value: fmtNum(viajesMes),
      sub: `${choferesConActividad} chofer${choferesConActividad === 1 ? "" : "es"} con actividad`,
      icon: Briefcase,
      accent: "brand" as const,
    },
    {
      label: "Km del período",
      value: `${fmtNum(kmMes)} km`,
      sub: kmMes > 0 ? `${pctVacios.toFixed(0)}% vacíos` : "Sin recorridos",
      icon: Route,
      accent: "warning" as const,
    },
    // Tercera card: facturación solo en /dashboard/completo; en el dashboard
    // general va km vacíos, que es el dato operativo que sí puede ver cualquiera.
    mostrarFacturacion
      ? {
          label: "Facturación del período",
          value: fmtMoneyCompact(facturacionMes),
          sub: pesosPorKm > 0 ? `${fmtMoneyCompact(pesosPorKm)}/km` : "Sin facturación cargada",
          icon: DollarSign,
          accent: "success" as const,
        }
      : {
          label: "Km vacíos del período",
          value: `${fmtNum(kmVaciosMes)} km`,
          sub: kmMes > 0 ? `${pctVacios.toFixed(0)}% del total recorrido` : "Sin recorridos",
          icon: Route,
          accent: "success" as const,
        },
  ];

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="inline-block w-1 h-4 rounded-full bg-primary" />
          <h2 className="text-sm font-bold text-foreground">{periodoLabel}</h2>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {periodoSelector}
          <Link
            href="/choferes/ranking"
            className="text-xs font-semibold text-primary hover:text-primary/80 hover:underline transition-colors"
          >
            Ver por chofer →
          </Link>
        </div>
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
  warning: { from: "from-[#FFB300]", to: "to-[#D97706]", text: "text-[#D97706]" },
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
    <Link
      href="/choferes/ranking"
      className="relative overflow-hidden bg-card rounded-[8px] border border-border p-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 hover:border-primary/50 group flex items-center gap-4 cursor-pointer"
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
    </Link>
  );
}
