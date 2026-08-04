"use client";

import type { LucideIcon } from "lucide-react";

// Tarjeta de estadística del listado de viajes — diseño "Ruta": medallón con
// ícono, número grande, copy humano y una línea de ruta punteada abajo (guiño
// camionero). Es un filtro clickeable; el estado activo enciende el ring y la
// ruta. Reemplaza al StatCard genérico solo en /viajes (no toca el resto).

export type ViajeCardTone = "brand" | "error" | "neutral" | "warning";

const TONE: Record<
  ViajeCardTone,
  { num: string; ico: string; med: string; hoverBorder: string; ring: string; road: string }
> = {
  brand: {
    num: "text-[#004A99]",
    ico: "text-[#0088D1]",
    med: "bg-[#0088D1]/12",
    hoverBorder: "hover:border-[#0088D1]/40",
    ring: "ring-[#0088D1]/70",
    road: "#0088D1",
  },
  warning: {
    num: "text-[#B45309]",
    ico: "text-[#D97706]",
    med: "bg-[#F59E0B]/14",
    hoverBorder: "hover:border-[#F59E0B]/40",
    ring: "ring-[#F59E0B]/60",
    road: "#F59E0B",
  },
  error: {
    num: "text-[#DC2626]",
    ico: "text-[#EF4444]",
    med: "bg-[#EF4444]/12",
    hoverBorder: "hover:border-[#EF4444]/40",
    ring: "ring-[#EF4444]/60",
    road: "#EF4444",
  },
  neutral: {
    num: "text-[#475569]",
    ico: "text-[#64748B]",
    med: "bg-[#64748B]/14",
    hoverBorder: "hover:border-[#64748B]/40",
    ring: "ring-[#64748B]/50",
    road: "#64748B",
  },
};

interface Props {
  /** Etiqueta corta arriba (ej. "Sin remito"). */
  kicker: string;
  value: number;
  /** Frase humana debajo del número (ej. "Esperan su remito"). */
  sub?: string;
  tone: ViajeCardTone;
  icon: LucideIcon;
  active?: boolean;
  onClick?: () => void;
}

export default function ViajeStatCard({ kicker, value, sub, tone, icon: Icon, active, onClick }: Props) {
  const t = TONE[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`group relative overflow-hidden text-left bg-card border rounded-xl px-3 pt-2.5 pb-3.5 sm:px-4 sm:pt-3 sm:pb-4
        shadow-[0_1px_2px_rgba(2,40,80,0.04)] transition-all duration-200
        hover:-translate-y-[2px] hover:shadow-[0_10px_22px_rgba(2,40,80,0.09)]
        ${active ? `ring-2 ring-offset-1 ring-offset-background border-transparent ${t.ring}` : `border-border ${t.hoverBorder}`}`}
    >
      {/* Encabezado: medallón + etiqueta */}
      <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5">
        <span
          className={`flex items-center justify-center size-7 sm:size-8 rounded-lg ${t.med} ${t.ico} shrink-0 transition-transform duration-200 group-hover:scale-105`}
        >
          <Icon size={15} strokeWidth={2.2} />
        </span>
        <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground leading-tight">
          {kicker}
        </span>
      </div>

      {/* Número */}
      <div className={`text-2xl sm:text-[28px] leading-none font-black tracking-tight tabular-nums ${t.num}`}>
        {value.toLocaleString("es-AR")}
      </div>

      {sub && <div className="mt-1 text-[11px] sm:text-[12px] font-semibold text-muted-foreground">{sub}</div>}

      {/* Línea de ruta punteada (guiño camionero) */}
      <span
        className="pointer-events-none absolute inset-x-0 bottom-0 h-2"
        style={{ color: t.road }}
        aria-hidden
      >
        <span
          className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[3px] opacity-[0.14]"
          style={{ background: "currentColor" }}
        />
        <span
          className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[2px] opacity-55 transition-opacity duration-200 group-hover:opacity-90"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, currentColor 0 8px, transparent 8px 14px)",
          }}
        />
      </span>
    </button>
  );
}
