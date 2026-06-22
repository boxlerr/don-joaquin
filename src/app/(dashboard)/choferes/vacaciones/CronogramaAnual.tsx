"use client";

import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import type { VacacionesPeriodo } from "./lib";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const DOW = ["L", "M", "M", "J", "V", "S", "D"];

interface Props {
  periodos: VacacionesPeriodo[];
  anio: number;
}

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Vista anual: 12 mini-calendarios con los días pintados según cuánta gente
 * está de vacaciones. Al pasar el mouse por un día se ven los nombres. */
export default function CronogramaAnual({ periodos, anio }: Props) {
  // Mapa día -> nombres de los que están de vacaciones ese día.
  const porDia = new Map<string, string[]>();
  for (const p of periodos) {
    const desde = p.fecha_inicio < `${anio}-01-01` ? `${anio}-01-01` : p.fecha_inicio;
    const hasta = p.fecha_fin > `${anio}-12-31` ? `${anio}-12-31` : p.fecha_fin;
    if (desde > hasta) continue;
    const d0 = new Date(desde + "T00:00:00");
    const d1 = new Date(hasta + "T00:00:00");
    for (let d = new Date(d0); d <= d1; d.setDate(d.getDate() + 1)) {
      const key = iso(d.getFullYear(), d.getMonth(), d.getDate());
      const arr = porDia.get(key) ?? [];
      arr.push(`${p.apellido}, ${p.nombre}`);
      porDia.set(key, arr);
    }
  }

  const tono = (n: number) => {
    if (n <= 0) return "bg-transparent text-muted-foreground/40";
    if (n === 1) return "bg-[#10B981]/30 text-[#065F46]";
    if (n <= 3) return "bg-[#10B981]/60 text-white";
    if (n <= 5) return "bg-[#10B981]/90 text-white";
    return "bg-[#EF4444]/80 text-white"; // pico: muchos juntos
  };

  return (
    <TooltipProvider delay={120}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
        {MESES.map((mes, mi) => {
          const primero = new Date(anio, mi, 1);
          const offset = (primero.getDay() + 6) % 7; // 0 = lunes
          const diasMes = new Date(anio, mi + 1, 0).getDate();
          const personasMes = new Set<string>();
          for (let d = 1; d <= diasMes; d++) {
            (porDia.get(iso(anio, mi, d)) ?? []).forEach((n) => personasMes.add(n));
          }
          const celdas: (number | null)[] = [
            ...Array.from({ length: offset }, () => null),
            ...Array.from({ length: diasMes }, (_, i) => i + 1),
          ];
          return (
            <div key={mes} className="rounded-[8px] border border-border bg-card p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-foreground">{mes}</span>
                <span className="text-[11px] text-muted-foreground">{personasMes.size} pers.</span>
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {DOW.map((d, i) => (
                  <div key={i} className="text-center text-[9px] font-semibold text-muted-foreground/60 pb-0.5">{d}</div>
                ))}
                {celdas.map((d, i) => {
                  if (d === null) return <div key={i} />;
                  const nombres = porDia.get(iso(anio, mi, d)) ?? [];
                  const n = nombres.length;
                  const cls = `aspect-square rounded-[2px] flex items-center justify-center text-[9px] font-medium ${tono(n)} ${n > 0 ? "cursor-default" : ""}`;
                  if (n === 0) return <div key={i} className={cls}>{d}</div>;
                  return (
                    <Tooltip key={i}>
                      <TooltipTrigger render={<div className={cls}>{d}</div>} />
                      <TooltipContent side="top" className="max-w-[240px] text-left">
                        <div className="font-semibold mb-1">
                          {d} de {mes} · {n} de vacaciones
                        </div>
                        <ul className="space-y-0.5">
                          {nombres.slice(0, 8).map((nom, j) => (
                            <li key={j}>{nom}</li>
                          ))}
                          {n > 8 && <li className="opacity-70">… y {n - 8} más</li>}
                        </ul>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
