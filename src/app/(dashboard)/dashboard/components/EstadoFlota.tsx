import Link from "next/link";
import { Truck } from "lucide-react";

interface Props {
  /** Cantidad de camiones por estado, tal cual están en la tabla `camiones`. */
  porEstado: { activo: number; en_mantenimiento: number; inactivo: number; baja: number };
}

const SEGMENTOS = [
  { key: "activo", label: "En servicio", color: "#0088D1" },
  { key: "en_mantenimiento", label: "En mantenimiento", color: "#F59E0B" },
  { key: "inactivo", label: "Inactivos", color: "#94A3B8" },
  { key: "baja", label: "De baja", color: "#CBD5E1" },
] as const;

// Radio elegido para que la circunferencia mida exactamente 100: así cada
// `stroke-dasharray` es directamente el porcentaje y no hay que multiplicar.
const R = 15.915494;

/**
 * La torta de la flota. Es SVG dibujado en el server desde el estado real de
 * cada unidad — sin recharts y sin JS en el navegador, que para cuatro números
 * no se justifica.
 */
export default function EstadoFlota({ porEstado }: Props) {
  const total = SEGMENTOS.reduce((acc, s) => acc + porEstado[s.key], 0);

  // Se dibuja arrancando arriba (las 12) y girando en sentido horario. El
  // círculo de SVG empieza a las 3, así que el desplazamiento arranca en 25 (un
  // cuarto de vuelta) y va restando lo ya dibujado.
  const arcos: { key: string; label: string; color: string; pct: number; offset: number }[] = [];
  let acumulado = 0;
  for (const seg of SEGMENTOS) {
    const n = porEstado[seg.key];
    if (n <= 0) continue;
    const pct = total > 0 ? (n / total) * 100 : 0;
    arcos.push({ key: seg.key, label: seg.label, color: seg.color, pct, offset: 25 - acumulado });
    acumulado += pct;
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-[12px] border border-border bg-card shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3.5 sm:px-5 sm:py-4">
        <div className="flex items-center gap-2">
          <Truck size={16} className="text-primary" />
          <h2 className="text-sm font-bold text-foreground">Estado de la flota</h2>
        </div>
        <Link
          href="/camiones"
          className="inline-flex shrink-0 items-center max-md:h-9 text-xs font-semibold text-primary transition-colors hover:text-primary/80 hover:underline"
        >
          Ver flota →
        </Link>
      </div>

      {total === 0 ? (
        <p className="px-4 py-8 text-center text-xs text-muted-foreground sm:px-5">
          No hay camiones cargados todavía.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-4 p-4 sm:gap-5 sm:p-5">
          <div className="relative shrink-0">
            <svg viewBox="0 0 42 42" className="size-[116px] sm:size-[128px]" role="img" aria-label={`${total} unidades en total`}>
              <circle cx="21" cy="21" r={R} fill="none" stroke="#F1F5F9" strokeWidth="4.2" />
              {arcos.map((a) => (
                <circle
                  key={a.key}
                  cx="21"
                  cy="21"
                  r={R}
                  fill="none"
                  stroke={a.color}
                  strokeWidth="4.2"
                  strokeLinecap="butt"
                  strokeDasharray={`${a.pct.toFixed(3)} ${(100 - a.pct).toFixed(3)}`}
                  strokeDashoffset={a.offset.toFixed(3)}
                />
              ))}
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-black leading-none tracking-tight text-foreground tabular-nums">
                {total}
              </span>
              <span className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Unidades
              </span>
            </div>
          </div>

          <ul className="min-w-[150px] flex-1 space-y-2">
            {SEGMENTOS.map((s) => {
              const n = porEstado[s.key];
              const pct = total > 0 ? (n / total) * 100 : 0;
              return (
                <li key={s.key} className="flex items-center gap-2.5">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: s.color }}
                    aria-hidden
                  />
                  <span className="flex-1 truncate text-[13px] font-medium text-foreground">{s.label}</span>
                  <span className="shrink-0 text-[13px] font-extrabold tabular-nums text-foreground">{n}</span>
                  <span className="w-9 shrink-0 text-right text-[11px] font-semibold tabular-nums text-muted-foreground">
                    {pct.toFixed(0)}%
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
