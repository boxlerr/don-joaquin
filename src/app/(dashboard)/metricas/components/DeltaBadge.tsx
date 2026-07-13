"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";

/** Badge de variación: verde si mejora, rojo si empeora (según si subir es bueno). */
export default function DeltaBadge({ valor, subirEsBueno, etiqueta, puntos }: {
  valor: number | null;
  subirEsBueno: boolean;
  etiqueta: string;
  /** true → la variación se muestra en puntos porcentuales (pp), no en %. */
  puntos?: boolean;
}) {
  if (valor == null) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/60" title={`Sin datos de ${etiqueta}`}>
        <Minus size={10} /> {etiqueta}: s/d
      </span>
    );
  }
  const mejora = subirEsBueno ? valor >= 0 : valor <= 0;
  const Icon = valor >= 0 ? TrendingUp : TrendingDown;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap ${
        mejora ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-red-500/10 text-red-600 dark:text-red-400"
      }`}
      title={`vs ${etiqueta}`}
    >
      <Icon size={10} />
      {valor >= 0 ? "+" : ""}
      {valor.toLocaleString("es-AR", { maximumFractionDigits: 1 })}
      {puntos ? " pp" : "%"} {etiqueta}
    </span>
  );
}
