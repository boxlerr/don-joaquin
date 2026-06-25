"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { MapPin, X } from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import ViajesTable, { type FiltroExterno } from "./ViajesTable";
import { type GastoFormData } from "./ViajeGastosPanel";

interface Stats {
  total: number;
  enCurso: number;
  pendientes: number;
  sinFacturar: number;
  pendienteCobro: number;
  vacios: number;
}

interface Props {
  stats: Stats;
  choferId?: string;
  choferNombre?: string | null;
  /** Filtro preseleccionado desde la URL (key de tarjeta: en_curso, pendiente, sin_facturar, vacios). */
  filtroInicial?: string;
  /** Datos de formulario de gasto (resueltos en la página) que la tabla pasa al
   *  panel de gastos de cada fila. */
  gastoFormData: GastoFormData;
  /** Contenido renderizado entre las tarjetas y el listado (ej. disponibilidad de choferes). */
  children?: ReactNode;
}

type CardColor = "brand" | "success" | "warning" | "error" | "neutral";

interface CardDef {
  key: string;
  label: string;
  value: number;
  color: CardColor;
  sub?: string;
  estado: string;
  facturado: boolean | null;
  esVacio: boolean | null;
  cobro?: "" | "pendiente" | "cobrado";
}

export default function ViajesStatsPanel({ stats, choferId, choferNombre, filtroInicial, gastoFormData, children }: Props) {
  const cards: CardDef[] = [
    { key: "todos", label: "Total viajes", value: stats.total, color: "brand", estado: "", facturado: null, esVacio: null },
    { key: "en_curso", label: "En curso", value: stats.enCurso, color: "success", estado: "en_curso", facturado: null, esVacio: null },
    { key: "pendiente", label: "Pendientes", value: stats.pendientes, color: "warning", estado: "pendiente", facturado: null, esVacio: null },
    // "Sin facturar" excluye los vacíos: solo viajes reales pendientes de facturar.
    { key: "sin_facturar", label: "Sin facturar", value: stats.sinFacturar, color: "error", sub: "Finalizados", estado: "", facturado: false, esVacio: false },
    // "Pendiente de cobro": facturados y aún sin cobrar (siguiente paso del ciclo).
    { key: "pendiente_cobro", label: "Pendiente de cobro", value: stats.pendienteCobro, color: "warning", sub: "Facturados sin cobrar", estado: "", facturado: null, esVacio: null, cobro: "pendiente" },
    { key: "vacios", label: "Viajes vacíos", value: stats.vacios, color: "neutral", sub: "Sin carga", estado: "", facturado: null, esVacio: true },
  ];

  // Si la URL trae un filtro (ej. desde el dashboard o el deep-link de Caja
  // "pendiente_cobro"), lo aplicamos como estado inicial.
  const cardInicial = cards.find((c) => c.key === filtroInicial && c.key !== "todos");

  // Filtro empujado a la tabla al hacer clic en una tarjeta.
  const [filtroExterno, setFiltroExterno] = useState<FiltroExterno | undefined>(
    cardInicial
      ? {
          estado: cardInicial.estado,
          facturado: cardInicial.facturado,
          esVacio: cardInicial.esVacio,
          cobro: cardInicial.cobro ?? "",
          nonce: 1,
        }
      : undefined,
  );
  // Filtro actual reportado por la tabla (puede cambiar también desde sus filtros internos).
  const [current, setCurrent] = useState<{
    estado: string;
    facturado: boolean | null;
    esVacio: boolean | null;
    cobro: "" | "pendiente" | "cobrado";
  }>({
    estado: cardInicial?.estado ?? "",
    facturado: cardInicial?.facturado ?? null,
    esVacio: cardInicial?.esVacio ?? null,
    cobro: cardInicial?.cobro ?? "",
  });

  const activeKey =
    current.cobro === "pendiente"
      ? "pendiente_cobro"
      : current.esVacio === true
        ? "vacios"
        : current.facturado === false
          ? "sin_facturar"
          : current.estado === "en_curso"
            ? "en_curso"
            : current.estado === "pendiente"
              ? "pendiente"
              : current.estado === "" && current.facturado === null && current.esVacio === null && !current.cobro
                ? "todos"
                : null;

  const aplicarFiltro = (
    estado: string,
    facturado: boolean | null,
    esVacio: boolean | null,
    cobro: "" | "pendiente" | "cobrado" = "",
  ) => {
    setFiltroExterno((prev) => ({ estado, facturado, esVacio, cobro, nonce: (prev?.nonce ?? 0) + 1 }));
  };

  const onCardClick = (card: CardDef) => {
    // Volver a hacer clic en la tarjeta activa (salvo "Total") limpia el filtro.
    if (activeKey === card.key && card.key !== "todos") {
      aplicarFiltro("", null, null, "");
    } else {
      aplicarFiltro(card.estado, card.facturado, card.esVacio, card.cobro ?? "");
    }
  };

  const activeCard = cards.find((c) => c.key === activeKey && c.key !== "todos");

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {cards.map((card) => (
          <StatCard
            key={card.key}
            label={card.label}
            value={String(card.value)}
            sub={card.sub}
            color={card.color}
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
                {activeCard.label}
                <button
                  type="button"
                  onClick={() => aplicarFiltro("", null, null)}
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

      <ViajesTable choferId={choferId} filtroExterno={filtroExterno} onFiltroChange={setCurrent} gastoFormData={gastoFormData} />
    </>
  );
}
