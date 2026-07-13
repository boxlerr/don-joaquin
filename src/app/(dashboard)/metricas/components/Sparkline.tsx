"use client";

// Mini-gráfico de tendencia (SVG puro, sin librerías) para las tarjetas KPI.
// Marca el último punto y pinta el área con un degradado sutil.

export default function Sparkline({
  valores,
  width = 96,
  height = 28,
  className,
}: {
  /** Serie ascendente en el tiempo; los null se saltean. */
  valores: (number | null)[];
  width?: number;
  height?: number;
  className?: string;
}) {
  const puntos = valores
    .map((v, i) => ({ v, i }))
    .filter((p): p is { v: number; i: number } => p.v != null);
  if (puntos.length < 2) return null;

  const min = Math.min(...puntos.map((p) => p.v));
  const max = Math.max(...puntos.map((p) => p.v));
  const span = max - min || 1;
  const n = valores.length - 1 || 1;
  const pad = 3;

  const x = (i: number) => pad + (i / n) * (width - pad * 2);
  const y = (v: number) => pad + (1 - (v - min) / span) * (height - pad * 2);

  const path = puntos.map((p, idx) => `${idx === 0 ? "M" : "L"}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const last = puntos[puntos.length - 1];
  const area = `${path} L${x(last.i).toFixed(1)},${height - 1} L${x(puntos[0].i).toFixed(1)},${height - 1} Z`;
  const gid = `spark-${Math.round(min * 100)}-${Math.round(max * 100)}-${puntos.length}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(last.i)} cy={y(last.v)} r="2.2" fill="currentColor" />
    </svg>
  );
}
