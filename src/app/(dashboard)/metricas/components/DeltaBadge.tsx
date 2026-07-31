"use client";

// Variación vs otro mes. Texto plano con flecha: sin pastilla ni fondo de
// color — en una grilla de 8 tarjetas, 16 píldoras pastel compiten con los
// números y marean. El color va solo en la flecha y el número.

import { ArrowUpRight, ArrowDownRight } from "lucide-react";

export default function DeltaBadge({ valor, subirEsBueno, etiqueta, puntos, neutro }: {
  valor: number | null;
  subirEsBueno: boolean;
  etiqueta: string;
  /** true → la variación se muestra en puntos porcentuales (pp), no en %. */
  puntos?: boolean;
  /** true → sin verde ni rojo: la métrica no tiene una dirección "buena". */
  neutro?: boolean;
}) {
  if (valor == null) {
    return (
      <span className="text-[11px] text-muted-foreground/50 whitespace-nowrap" title={`Sin datos de ${etiqueta}`}>
        {etiqueta} s/d
      </span>
    );
  }
  const mejora = subirEsBueno ? valor >= 0 : valor <= 0;
  const Icon = valor >= 0 ? ArrowUpRight : ArrowDownRight;
  // El color dice si el movimiento es bueno o malo, NO si el número es
  // positivo: subir un costo es rojo aunque el signo sea +. Se explica en el
  // tooltip porque en la tarjeta no hay lugar y confundía.
  const porQue = neutro
    ? "esta métrica no tiene una dirección mejor ni peor"
    : subirEsBueno
      ? `subir es mejor → ${mejora ? "mejoró" : "empeoró"}`
      : `subir es peor → ${mejora ? "mejoró" : "empeoró"}`;
  return (
    <span
      className="inline-flex items-baseline gap-1 text-[11px] whitespace-nowrap"
      title={`vs ${etiqueta}: ${porQue}`}
    >
      <span
        className={`inline-flex items-center gap-0.5 font-medium tabular-nums ${
          neutro
            ? "text-foreground/70"
            : mejora
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-red-600 dark:text-red-400"
        }`}
      >
        <Icon size={11} className="shrink-0 self-center" />
        {valor >= 0 ? "+" : ""}
        {valor.toLocaleString("es-AR", { maximumFractionDigits: 1 })}
        {puntos ? " pp" : "%"}
      </span>
      <span className="text-muted-foreground">{etiqueta}</span>
    </span>
  );
}
