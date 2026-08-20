// Curva chica de evolución para las tarjetas del dashboard. Es SVG dibujado en
// el server desde los datos reales del período: no entra recharts, no se manda
// JS al navegador y la tarjeta pinta en el primer render.

interface Props {
  /** Un valor por tramo del período (ver `PuntoSerie` en ranking/lib). */
  values: number[];
  /** Color de la línea; el relleno usa el mismo con opacidad. */
  color: string;
  /** Único por tarjeta: los `<linearGradient>` se referencian por id. */
  id: string;
  className?: string;
}

const W = 100;
const H = 40;
const PAD = 4;

/**
 * Spline cardinal con tensión baja: la línea sale redondeada como en el diseño,
 * sin los picos duros de unir los puntos con rectas.
 */
function curva(pts: [number, number][]): string {
  if (pts.length < 2) return "";
  let d = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  const T = 0.2;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) * T;
    const c1y = p1[1] + (p2[1] - p0[1]) * T;
    const c2x = p2[0] - (p3[0] - p1[0]) * T;
    const c2y = p2[1] - (p3[1] - p1[1]) * T;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return d;
}

export default function Sparkline({ values, color, id, className = "" }: Props) {
  // Con menos de dos tramos no hay curva que dibujar (período de un solo día).
  const vals = values.length >= 2 ? values : null;
  if (!vals) return null;

  const max = Math.max(...vals);
  const min = Math.min(...vals);
  const span = max - min || 1;
  // Si todos los tramos valen lo mismo (incluido "todo cero"), la línea va al
  // medio en vez de pegarse abajo: se lee como "sin variación", no como cero.
  const plano = max === min;

  const pts: [number, number][] = vals.map((v, i) => [
    (i / (vals.length - 1)) * W,
    plano ? H / 2 : H - PAD - ((v - min) / span) * (H - PAD * 2),
  ]);

  const linea = curva(pts);
  const area = `${linea} L ${W} ${H} L 0 ${H} Z`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={className}
      aria-hidden
      focusable="false"
    >
      <defs>
        <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#spark-${id})`} />
      <path
        d={linea}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
