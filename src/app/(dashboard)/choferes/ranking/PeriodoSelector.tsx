"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Calendar, Check } from "lucide-react";
import type { RangoKey } from "./lib";

interface Props {
  rangoActual: RangoKey;
  desdeActual: string;
  hastaActual: string;
  /** Agrega el chip "Total" (histórico completo). */
  incluirTotal?: boolean;
}

const CHIPS: Array<{ key: RangoKey; label: string }> = [
  { key: "1m", label: "Último mes" },
  { key: "3m", label: "3 meses" },
  { key: "1y", label: "1 año" },
];

export default function PeriodoSelector({
  rangoActual,
  desdeActual,
  hastaActual,
  incluirTotal,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [desde, setDesde] = useState(desdeActual);
  const [hasta, setHasta] = useState(hastaActual);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronización intencional al cambiar props/abrir (carga o reset de estado)
    setDesde(desdeActual);
    setHasta(hastaActual);
  }, [desdeActual, hastaActual]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const irA = (rango: RangoKey, extra?: { desde: string; hasta: string }) => {
    const params = new URLSearchParams();
    params.set("rango", rango);
    if (rango === "custom" && extra) {
      params.set("desde", extra.desde);
      params.set("hasta", extra.hasta);
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const onChipClick = (rango: RangoKey) => {
    setOpen(false);
    irA(rango);
  };

  const onCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!desde || !hasta || desde > hasta) return;
    setOpen(false);
    irA("custom", { desde, hasta });
  };

  const customActivo = rangoActual === "custom";
  const customInvalido = !desde || !hasta || desde > hasta;
  const chips = incluirTotal
    ? [...CHIPS, { key: "total" as RangoKey, label: "Total" }]
    : CHIPS;

  return (
    <div className="flex items-center gap-1.5">
      {chips.map((chip) => {
        const activo = rangoActual === chip.key;
        return (
          <button
            key={chip.key}
            type="button"
            onClick={() => onChipClick(chip.key)}
            className={`inline-flex items-center h-8 px-3 rounded-lg text-sm font-medium transition-colors ${
              activo
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {chip.label}
          </button>
        );
      })}

      <div className="relative" ref={popRef}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-sm font-medium transition-colors ${
            customActivo
              ? "bg-primary text-primary-foreground"
              : "border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Calendar size={14} />
          Custom
        </button>

        {open && (
          <form
            onSubmit={onCustomSubmit}
            className="absolute right-0 top-full mt-2 z-30 w-72 bg-card border border-border rounded-lg shadow-md p-3 space-y-2.5"
          >
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Desde
              </label>
              <input
                type="date"
                value={desde}
                max={hasta || undefined}
                onChange={(e) => setDesde(e.target.value)}
                className="w-full h-8 px-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Hasta
              </label>
              <input
                type="date"
                value={hasta}
                min={desde || undefined}
                onChange={(e) => setHasta(e.target.value)}
                className="w-full h-8 px-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                required
              />
            </div>
            <button
              type="submit"
              disabled={customInvalido}
              className="w-full inline-flex items-center justify-center gap-1.5 h-8 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Check size={14} />
              Aplicar
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
