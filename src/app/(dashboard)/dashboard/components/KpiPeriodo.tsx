import Link from "next/link";
import { Briefcase, Route, Split, DollarSign, Weight, ChevronRight } from "lucide-react";
import type { TotalesPeriodo } from "@/app/(dashboard)/choferes/ranking/lib";
import Sparkline from "./Sparkline";

interface Props {
  totales: TotalesPeriodo;
  periodoLabel: string;
  /**
   * Si es false (dashboard general) la cuarta tarjeta muestra toneladas en vez
   * de facturación: pedido de Bárbara de que los montos no queden a la vista de
   * todos. Los $ solo se ven en /dashboard/completo.
   */
  mostrarFacturacion: boolean;
}

function fmtNum(n: number): string {
  return n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

/** Formato compacto de pesos para tarjetas ($ 1,2 M / $ 350 k / $ 980). */
function fmtMoneyCompact(n: number): string {
  if (n >= 1_000_000) return `$ ${(n / 1_000_000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} M`;
  if (n >= 1_000) return `$ ${(n / 1_000).toLocaleString("es-AR", { maximumFractionDigits: 0 })} k`;
  return `$ ${fmtNum(n)}`;
}

const TONOS = {
  brand: { de: "#0088D1", a: "#004A99", texto: "text-[#0088D1]", linea: "#0088D1" },
  ambar: { de: "#FFB300", a: "#D97706", texto: "text-[#D97706]", linea: "#F59E0B" },
  verde: { de: "#10B981", a: "#059669", texto: "text-[#059669]", linea: "#10B981" },
  violeta: { de: "#8B5CF6", a: "#6D28D9", texto: "text-[#7C3AED]", linea: "#8B5CF6" },
} as const;

/**
 * La fila de arriba del dashboard: los cuatro números del período con su curva
 * de evolución real debajo. Antes convivían dos filas de tarjetas que repetían
 * el mismo total de viajes; ahora es una sola, y cada tarjeta lleva a su
 * desglose por chofer.
 */
export default function KpiPeriodo({ totales, periodoLabel, mostrarFacturacion }: Props) {
  const kmTotal = totales.kmConCarga + totales.kmVacios;
  const pctVacios = kmTotal > 0 ? (totales.kmVacios / kmTotal) * 100 : 0;
  const pesosPorKm = kmTotal > 0 && totales.facturacion > 0 ? totales.facturacion / kmTotal : 0;
  const tnPorViaje = totales.viajes > 0 && totales.toneladas > 0 ? totales.toneladas / totales.viajes : 0;
  const s = totales.serie;

  const cards = [
    {
      id: "viajes",
      label: "Viajes del período",
      value: fmtNum(totales.viajes),
      sub: `${totales.choferesActivos} chofer${totales.choferesActivos === 1 ? "" : "es"} con actividad`,
      icon: Briefcase,
      tono: TONOS.brand,
      serie: s.map((p) => p.viajes),
    },
    {
      id: "km",
      label: "Km del período",
      value: `${fmtNum(kmTotal)} km`,
      sub: kmTotal > 0 ? `${pctVacios.toFixed(0)}% vacíos` : "Sin recorridos",
      icon: Route,
      tono: TONOS.ambar,
      serie: s.map((p) => p.kmConCarga + p.kmVacios),
    },
    {
      id: "vacios",
      label: "Km vacíos del período",
      value: `${fmtNum(totales.kmVacios)} km`,
      sub: kmTotal > 0 ? `${pctVacios.toFixed(0)}% del total recorrido` : "Sin recorridos",
      icon: Split,
      tono: TONOS.verde,
      serie: s.map((p) => p.kmVacios),
    },
    mostrarFacturacion
      ? {
          id: "facturacion",
          label: "Facturación del período",
          value: fmtMoneyCompact(totales.facturacion),
          sub: pesosPorKm > 0 ? `${fmtMoneyCompact(pesosPorKm)} por km` : "Sin facturación cargada",
          icon: DollarSign,
          tono: TONOS.violeta,
          serie: s.map((p) => p.facturacion),
        }
      : {
          id: "toneladas",
          label: "Toneladas del período",
          value: `${fmtNum(totales.toneladas)} t`,
          sub:
            tnPorViaje > 0
              ? `${tnPorViaje.toLocaleString("es-AR", { maximumFractionDigits: 1 })} t promedio por viaje`
              : "Sin tonelaje cargado",
          icon: Weight,
          tono: TONOS.violeta,
          serie: s.map((p) => p.toneladas),
        },
  ];

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-block h-4 w-1 shrink-0 rounded-full bg-primary" />
          <h2 className="text-sm font-bold text-foreground">{periodoLabel}</h2>
        </div>
        <Link
          href="/choferes/ranking"
          className="inline-flex items-center max-md:h-9 text-xs font-semibold text-primary transition-colors hover:text-primary/80 hover:underline"
        >
          Ver por chofer →
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        {cards.map((c) => (
          <Link
            key={c.id}
            href="/choferes/ranking"
            className="group relative flex flex-col overflow-hidden rounded-[12px] border border-border bg-card shadow-[0_2px_10px_rgba(15,23,42,0.04)] transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_10px_24px_-12px_rgba(0,74,153,0.4)]"
          >
            <div className="flex items-start gap-3 p-4 pb-2 sm:gap-3.5 sm:p-5 sm:pb-2.5">
              <span
                className="flex size-10 shrink-0 items-center justify-center rounded-xl text-white shadow-[0_6px_14px_-6px_rgba(15,23,42,0.6)] transition-transform duration-300 group-hover:scale-105 sm:size-11"
                style={{ background: `linear-gradient(135deg, ${c.tono.de} 0%, ${c.tono.a} 100%)` }}
              >
                <c.icon size={19} strokeWidth={2.4} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-extrabold uppercase leading-none tracking-wider text-muted-foreground">
                  {c.label}
                </p>
                {/* El número no se corta nunca: si es largo baja un escalón de
                    tamaño en vez de salirse de la tarjeta. */}
                <p
                  className={`mt-1.5 whitespace-nowrap font-black leading-none tracking-tight ${c.tono.texto} ${
                    c.value.length <= 8 ? "text-[26px] sm:text-[30px]" : c.value.length <= 12 ? "text-[22px] sm:text-[26px]" : "text-lg sm:text-xl"
                  }`}
                >
                  {c.value}
                </p>
                <p className="mt-1.5 text-xs font-semibold leading-snug text-muted-foreground/85">{c.sub}</p>
              </div>
              <ChevronRight
                size={15}
                className="mt-0.5 shrink-0 text-muted-foreground/30 transition-all group-hover:translate-x-0.5 group-hover:text-primary"
              />
            </div>

            <Sparkline
              values={c.serie}
              color={c.tono.linea}
              id={c.id}
              className="mt-auto h-11 w-full transition-transform duration-500 group-hover:scale-y-110 origin-bottom sm:h-12"
            />
          </Link>
        ))}
      </div>
    </section>
  );
}
