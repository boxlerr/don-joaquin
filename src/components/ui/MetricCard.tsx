// Tarjeta de métrica con contexto: además del número grande, muestra de dónde
// sale y hacia dónde va.
//
// La `StatCard` de siempre da un número suelto ("45 vencidos") y ahí termina.
// Esta agrega dos cosas que sí se leen de un vistazo:
//   - `trend`: la evolución real de ese número en los últimos meses;
//   - `breakdown`: el desglose del número al pie (de esos 45, cuántos son de
//     hace más de 90 días).
//
// Reglas de estilo que respeta a propósito: el color va en el ícono y en los
// números, nunca de fondo del bloque; esquinas de 8px; la barra mide UNA sola
// magnitud y se llena con lo que está bien, no con lo que falta.
//
// Importante: `trend` y `breakdown` esperan datos REALES. No hay sparkline
// decorativo — si no hay serie, no se dibuja nada.

import type { LucideIcon } from "lucide-react";

export type MetricTone = "brand" | "success" | "warning" | "error" | "neutral";

const TONE: Record<MetricTone, { fg: string; chip: string; hex: string }> = {
  brand: { fg: "text-[#0088D1]", chip: "bg-[#0088D1]/10", hex: "#0088D1" },
  success: { fg: "text-[#10B981]", chip: "bg-[#10B981]/10", hex: "#10B981" },
  warning: { fg: "text-[#F59E0B]", chip: "bg-[#F59E0B]/10", hex: "#F59E0B" },
  error: { fg: "text-[#EF4444]", chip: "bg-[#EF4444]/10", hex: "#EF4444" },
  neutral: { fg: "text-[#64748B]", chip: "bg-[#64748B]/10", hex: "#64748B" },
};

/** Escritas enteras: Tailwind escanea el código y no arma clases al vuelo. */
const COLS: Record<number, string> = {
  1: "sm:grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-4",
};

export interface MetricBreakdownItem {
  label: string;
  value: string;
  tone?: MetricTone;
}

interface MetricCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  tone?: MetricTone;
  /**
   * Color propio, para las pantallas que ya tienen una paleta por categoría (el
   * resumen del día usa la misma que el mail, así el aviso se reconoce igual en
   * los dos lados). Pisa al `tone`, que sólo tiene cinco colores.
   */
  color?: string;
  /** Nombre accesible completo, cuando el `label` va abreviado para que entre. */
  ariaLabel?: string;
  onClick?: () => void;
  href?: string;
  /** Serie real (un punto por período) + el texto que explica qué cambió. */
  trend?: { points: number[]; caption: string };
  /**
   * Barra de una sola magnitud. `pct` es lo que está BIEN (se llena con lo que
   * queda sano): si se llenara con lo vencido, un legajo al día quedaría vacío y
   * se leería al revés.
   */
  bar?: { pct: number; title: string };
  /** Desglose del número grande, al pie de la tarjeta. */
  breakdown?: MetricBreakdownItem[];
}

/**
 * Sparkline sin librería: son 12 puntos, no hace falta recharts.
 *
 * El id del degradado sale del color y no de `useId` a propósito, así el
 * componente sigue funcionando en un Server Component. Dos tarjetas del mismo
 * color comparten el mismo `<defs>`, que es idéntico: no molesta.
 */
function Sparkline({ points, hex }: { points: number[]; hex: string }) {
  if (points.length < 2) return null;

  const W = 100;
  const H = 26;
  const PAD = 3; // deja aire arriba y abajo: la línea no se pega al borde
  const min = Math.min(...points);
  const max = Math.max(...points);
  // Serie plana (un rol que no se movió en el año): la línea va al medio. Si se
  // normalizara igual que el resto quedaría apoyada abajo y parecería un cero.
  const y = (v: number) =>
    max === min ? H / 2 : H - PAD - ((v - min) / (max - min)) * (H - PAD * 2);
  const x = (i: number) => (i / (points.length - 1)) * W;

  const linea = points.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${linea} L${W},${H} L0,${H} Z`;
  const gradId = `spark-${hex.replace("#", "")}`;
  const ultimo = points[points.length - 1]!;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="h-[26px] w-full"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={hex} stopOpacity="0.18" />
          <stop offset="100%" stopColor={hex} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      {/* `vectorEffect` mantiene el grosor de la línea aunque el viewBox se
          estire de costado (preserveAspectRatio="none"). */}
      <path
        d={linea}
        fill="none"
        stroke={hex}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={W} cy={y(ultimo)} r="2" fill={hex} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "brand",
  color,
  ariaLabel,
  onClick,
  href,
  trend,
  bar,
  breakdown,
}: MetricCardProps) {
  const base = TONE[tone];
  // Con color propio, el ícono y el número se pintan por estilo en vez de por
  // clase: Tailwind escanea el código y no puede armar `text-[#F43F5E]` al vuelo.
  const t = color ? { ...base, fg: "", chip: "", hex: color } : base;
  const estiloColor = color ? { color } : undefined;
  const estiloChip = color ? { backgroundColor: `${color}1A`, color } : undefined;
  const interactive = Boolean(onClick || href);
  const pie = trend || bar || breakdown;

  const contenido = (
    <>
      <div className={`flex items-start gap-3 ${pie ? "mb-3" : ""}`}>
        <span
          className={`grid size-9 sm:size-10 shrink-0 place-items-center rounded-lg ${t.chip} ${t.fg}`}
          style={estiloChip}
        >
          <Icon size={18} strokeWidth={2.2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-muted-foreground leading-tight">
            {label}
          </p>
          <p
            className={`mt-1 text-2xl sm:text-[28px] font-bold leading-none tracking-tight tabular-nums ${t.fg}`}
            style={estiloColor}
          >
            {value}
          </p>
          {sub && <p className="mt-1.5 text-[11px] sm:text-xs leading-snug text-muted-foreground">{sub}</p>}
        </div>
      </div>

      {/* `mt-auto`: el pie se pega abajo. Si no, un subtítulo que envuelve a dos
          líneas empuja la línea de tendencia de ESA tarjeta y la fila queda con
          cinco sparklines a cinco alturas distintas. */}
      {pie && (
        // Con barra no va el filete de arriba: serían dos líneas horizontales
        // pegadas. La barra ya separa.
        <div className={`mt-auto ${bar ? "" : "border-t border-border/70 pt-3"}`}>
          {bar && (
            <div
              className="h-1.5 w-full overflow-hidden rounded-[2px] bg-muted"
              title={bar.title}
              role="img"
              aria-label={bar.title}
            >
              <div
                className="h-full rounded-[2px] transition-[width] duration-500"
                style={{ width: `${Math.max(0, Math.min(100, bar.pct))}%`, backgroundColor: t.hex }}
              />
            </div>
          )}

          {trend && (
            <>
              <Sparkline points={trend.points} hex={t.hex} />
              {/* Sin `truncate`: si no entra en una línea, que envuelva. Un
                  "+7 en 12 me…" no dice nada. */}
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{trend.caption}</p>
            </>
          )}

          {/* En celular la tarjeta mide ~165px: tres columnas dejan 48px por
              etiqueta y "Menos de 30 días" cae en cuatro renglones. Hasta `sm`
              el desglose es una lista (etiqueta a la izquierda, número a la
              derecha) y recién ahí pasa a columnas. */}
          {breakdown && breakdown.length > 0 && (
            <div className={`${bar ? "mt-3" : ""} grid grid-cols-1 gap-x-2 gap-y-1 sm:gap-y-2 ${COLS[breakdown.length] ?? "sm:grid-cols-3"}`}>
              {breakdown.map((b) => (
                <div key={b.label} className="flex min-w-0 items-baseline justify-between gap-2 sm:block">
                  <p className="text-[10px] leading-tight text-muted-foreground">{b.label}</p>
                  <p className={`text-sm font-bold tabular-nums sm:mt-0.5 ${TONE[b.tone ?? "neutral"].fg}`}>
                    {b.value}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );

  const clase = `flex flex-col rounded-[8px] border border-border bg-card p-3.5 sm:p-4 text-left shadow-xs transition-all ${
    interactive ? "cursor-pointer hover:border-primary/50 hover:shadow-md" : ""
  }`;

  if (href) {
    return (
      <a href={href} className={clase} aria-label={ariaLabel}>
        {contenido}
      </a>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={clase} aria-label={ariaLabel}>
        {contenido}
      </button>
    );
  }
  return <div className={clase}>{contenido}</div>;
}
