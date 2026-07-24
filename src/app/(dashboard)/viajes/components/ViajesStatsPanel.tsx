"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { MapPin, X, Truck, Receipt, PackageX, CalendarRange, AlertTriangle, type LucideIcon } from "lucide-react";
import ViajesTable, { type FiltroExterno } from "./ViajesTable";
import ViajeStatCard, { type ViajeCardTone } from "./ViajeStatCard";
import PeriodoSelector from "../../choferes/ranking/PeriodoSelector";
import type { RangoKey } from "../../choferes/ranking/lib";
import { type GastoFormData } from "./ViajeGastosPanel";

interface Stats {
  total: number;
  sinFacturar: number;
  vacios: number;
  incompletos: number;
}

interface Props {
  stats: Stats;
  choferId?: string;
  choferNombre?: string | null;
  /** Filtro preseleccionado desde la URL (key de tarjeta: sin_facturar, vacios). */
  filtroInicial?: string;
  /** Datos de formulario de gasto (resueltos en la página) que la tabla pasa al
   *  panel de gastos de cada fila. */
  gastoFormData: GastoFormData;
  /** Período elegido (selector de fechas): scopea las tarjetas y siembra el listado. */
  rango: RangoKey;
  desdePeriodo: string;
  hastaPeriodo: string;
  /** Contenido renderizado entre las tarjetas y el listado (ej. disponibilidad de choferes). */
  children?: ReactNode;
}

interface CardDef {
  key: string;
  /** Etiqueta corta de la tarjeta. */
  kicker: string;
  /** Frase humana debajo del número. */
  sub: string;
  value: number;
  tone: ViajeCardTone;
  icon: LucideIcon;
  facturado: boolean | null;
  esVacio: boolean | null;
  incompleto: boolean | null;
}

export default function ViajesStatsPanel({
  stats,
  choferId,
  choferNombre,
  filtroInicial,
  gastoFormData,
  rango,
  desdePeriodo,
  hastaPeriodo,
  children,
}: Props) {
  // Con "total" el listado arranca sin filtro de fecha; con un período, se siembran
  // los inputs de fecha de la tabla con ese rango (quedan editables para afinar).
  const tableDesde = rango === "total" ? "" : desdePeriodo;
  const tableHasta = rango === "total" ? "" : hastaPeriodo;
  // Tres tarjetas con identidad propia (se quitó el estado operativo — En curso /
  // Pendientes — que ya no se usa). Total · Sin remito · Vueltas en vacío.
  const cards: CardDef[] = [
    {
      key: "todos",
      kicker: "Viajes registrados",
      sub: "Todo el movimiento",
      value: stats.total,
      tone: "brand",
      icon: Truck,
      facturado: null,
      esVacio: null,
      incompleto: null,
    },
    {
      // "Sin remito" excluye los vacíos: solo viajes reales pendientes de facturar.
      key: "sin_facturar",
      kicker: "Sin remito",
      sub: "Esperan su remito",
      value: stats.sinFacturar,
      tone: "error",
      icon: Receipt,
      facturado: false,
      esVacio: false,
      incompleto: null,
    },
    {
      // Les falta origen, destino o chofer (los cargan después).
      key: "incompletos",
      kicker: "Incompletos",
      sub: "Faltan datos",
      value: stats.incompletos,
      tone: "warning",
      icon: AlertTriangle,
      facturado: null,
      esVacio: null,
      incompleto: true,
    },
    {
      key: "vacios",
      kicker: "Vueltas en vacío",
      sub: "Sin carga",
      value: stats.vacios,
      tone: "neutral",
      icon: PackageX,
      facturado: null,
      esVacio: true,
      incompleto: null,
    },
  ];

  // Si la URL trae un filtro (ej. desde el dashboard), lo aplicamos como estado inicial.
  const cardInicial = cards.find((c) => c.key === filtroInicial && c.key !== "todos");

  // Filtro empujado a la tabla al hacer clic en una tarjeta.
  const [filtroExterno, setFiltroExterno] = useState<FiltroExterno | undefined>(
    cardInicial
      ? {
          facturado: cardInicial.facturado,
          esVacio: cardInicial.esVacio,
          incompleto: cardInicial.incompleto,
          nonce: 1,
        }
      : undefined,
  );
  // Filtro actual reportado por la tabla (puede cambiar también desde sus filtros internos).
  const [current, setCurrent] = useState<{
    facturado: boolean | null;
    esVacio: boolean | null;
    incompleto: boolean | null;
  }>({
    facturado: cardInicial?.facturado ?? null,
    esVacio: cardInicial?.esVacio ?? null,
    incompleto: cardInicial?.incompleto ?? null,
  });

  const activeKey =
    current.incompleto === true
      ? "incompletos"
      : current.esVacio === true
        ? "vacios"
        : current.facturado === false
          ? "sin_facturar"
          : current.facturado === null && current.esVacio === null && current.incompleto === null
            ? "todos"
            : null;

  const aplicarFiltro = (
    facturado: boolean | null,
    esVacio: boolean | null,
    incompleto: boolean | null,
  ) => {
    setFiltroExterno((prev) => ({ facturado, esVacio, incompleto, nonce: (prev?.nonce ?? 0) + 1 }));
  };

  const onCardClick = (card: CardDef) => {
    // Volver a hacer clic en la tarjeta activa (salvo "Total") limpia el filtro.
    if (activeKey === card.key && card.key !== "todos") {
      aplicarFiltro(null, null, null);
    } else {
      aplicarFiltro(card.facturado, card.esVacio, card.incompleto);
    }
  };

  const activeCard = cards.find((c) => c.key === activeKey && c.key !== "todos");

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <CalendarRange size={14} className="text-primary" />
          Período de las tarjetas
        </span>
        <PeriodoSelector
          rangoActual={rango}
          desdeActual={desdePeriodo}
          hastaActual={hastaPeriodo}
          incluirTotal
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {cards.map((card) => (
          <ViajeStatCard
            key={card.key}
            kicker={card.kicker}
            value={card.value}
            sub={card.sub}
            tone={card.tone}
            icon={card.icon}
            active={activeKey === card.key}
            onClick={() => onCardClick(card)}
          />
        ))}
      </div>

      {children}

      <div className="bg-card rounded-[8px] border border-border shadow-sm mb-1">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3 flex-wrap">
            <MapPin size={16} className="text-primary" />
            <h2 className="text-foreground text-sm font-semibold">Listado de Viajes</h2>
            {choferNombre && (
              <span className="inline-flex items-center gap-1.5 pl-2 pr-1 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                Filtrado por: {choferNombre}
                <Link
                  href="/viajes"
                  className="flex items-center hover:text-primary/80 transition-colors"
                  aria-label="Limpiar filtro de chofer"
                >
                  <X size={12} />
                </Link>
              </span>
            )}
            {activeCard && (
              <span className="inline-flex items-center gap-1.5 pl-2 pr-1 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                {activeCard.kicker}
                <button
                  type="button"
                  onClick={() => aplicarFiltro(null, null, null)}
                  className="flex items-center hover:text-primary/80 transition-colors"
                  aria-label="Limpiar filtro de tarjeta"
                >
                  <X size={12} />
                </button>
              </span>
            )}
          </div>
        </div>
      </div>

      <ViajesTable
        key={`${rango}-${desdePeriodo}-${hastaPeriodo}`}
        choferId={choferId}
        filtroExterno={filtroExterno}
        onFiltroChange={setCurrent}
        gastoFormData={gastoFormData}
        initialDesde={tableDesde}
        initialHasta={tableHasta}
      />
    </>
  );
}
