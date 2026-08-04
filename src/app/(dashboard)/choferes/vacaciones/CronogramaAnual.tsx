"use client";

import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import type { VacacionesPeriodo } from "./lib";
import { umbralDeMes, type UmbralConfig } from "./umbral";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const DOW = ["L", "M", "M", "J", "V", "S", "D"];

function diaSemana(anio: number, mes: number, dia: number): string {
  return new Date(anio, mes, dia).toLocaleDateString("es-AR", { weekday: "long" });
}

interface Props {
  periodos: VacacionesPeriodo[];
  anio: number;
  umbralConfig: UmbralConfig;
  activos: number;
}

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Vista anual: 12 mini-calendarios con los días pintados según cuánta gente está
 * de vacaciones. El rojo NO sale de un número fijo sino del máximo configurado
 * para ESE mes: en diciembre y enero se toman muchos juntos y eso es lo normal,
 * así que pintarlos de rojo como una anomalía sólo hacía ruido.
 */
export default function CronogramaAnual({ periodos, anio, umbralConfig, activos }: Props) {
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

  // El color va contra el máximo del mes, no contra un número fijo.
  const tono = (n: number, tope: number) => {
    if (n <= 0) return "bg-transparent text-muted-foreground/40";
    if (n > tope) return "bg-[#DC2626] text-white"; // se pasa del máximo del mes
    const carga = n / Math.max(1, tope);
    if (carga <= 0.34) return "bg-[#10B981]/25 text-[#065F46]";
    if (carga <= 0.67) return "bg-[#10B981]/55 text-white";
    return "bg-[#059669] text-white"; // al límite pero todavía dentro
  };

  return (
    <TooltipProvider delay={120}>
      {/* Leyenda: explica qué muestra el calendario */}
      <div className="flex flex-wrap items-center gap-x-3 sm:gap-x-4 gap-y-1.5 px-3 sm:px-4 pt-4 text-[11px] text-muted-foreground">
        <span className="font-medium text-foreground">Cuánta gente está de vacaciones cada día:</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-[2px] bg-[#10B981]/25" /> pocos</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-[2px] bg-[#10B981]/55" /> varios</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-[2px] bg-[#059669]" /> al límite del mes</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-[2px] bg-[#DC2626]" /> se pasa del máximo</span>
        <span className="text-muted-foreground/70">· el máximo se configura por mes, así diciembre y enero no salen todos en rojo</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 p-3 sm:p-4">
        {MESES.map((mes, mi) => {
          const primero = new Date(anio, mi, 1);
          const offset = (primero.getDay() + 6) % 7; // 0 = lunes
          const diasMes = new Date(anio, mi + 1, 0).getDate();
          const personasMes = new Set<string>();
          let picoMes = 0;
          for (let d = 1; d <= diasMes; d++) {
            const delDia = porDia.get(iso(anio, mi, d)) ?? [];
            delDia.forEach((n) => personasMes.add(n));
            if (delDia.length > picoMes) picoMes = delDia.length;
          }
          const topeMes = umbralDeMes(umbralConfig, mi + 1, activos);
          const excede = picoMes > topeMes;
          const celdas: (number | null)[] = [
            ...Array.from({ length: offset }, () => null),
            ...Array.from({ length: diasMes }, (_, i) => i + 1),
          ];
          return (
            <div key={mes} className="rounded-[8px] border border-border bg-card p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">{mes}</span>
                <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span>{personasMes.size} pers.</span>
                  <span
                    className={excede ? "font-medium text-[#DC2626]" : "text-muted-foreground/70"}
                    title={`Día más cargado del mes: ${picoMes} de vacaciones. Máximo configurado para ${mes}: ${topeMes}.`}
                  >
                    pico {picoMes}/{topeMes}
                  </span>
                </span>
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {DOW.map((d, i) => (
                  <div key={i} className="text-center text-[9px] font-semibold text-muted-foreground/60 pb-0.5">{d}</div>
                ))}
                {celdas.map((d, i) => {
                  if (d === null) return <div key={i} />;
                  const nombres = porDia.get(iso(anio, mi, d)) ?? [];
                  const n = nombres.length;
                  const cls = `aspect-square rounded-[2px] flex items-center justify-center text-[9px] font-medium ${tono(n, topeMes)} ${n > 0 ? "cursor-default" : ""}`;
                  if (n === 0) return <div key={i} className={cls}>{d}</div>;
                  return (
                    <Tooltip key={i}>
                      <TooltipTrigger render={<div className={cls}>{d}</div>} />
                      <TooltipContent side="top" className="block max-w-[260px] text-left p-0 overflow-hidden">
                        <div className="px-3 py-1.5 border-b border-background/15 bg-background/5">
                          <div className="font-semibold">
                            {n} {n === 1 ? "persona" : "personas"} de vacaciones
                            {n > topeMes && <span className="ml-1 font-normal">· se pasa del máximo ({topeMes})</span>}
                          </div>
                          <div className="mt-0.5 text-[10px] capitalize opacity-70">
                            {diaSemana(anio, mi, d)} {d} de {mes}
                          </div>
                        </div>
                        <ul className="max-h-[220px] space-y-0.5 overflow-y-auto px-3 py-1.5">
                          {[...nombres].sort().map((nom, j) => (
                            <li key={j} className="flex items-center gap-1.5">
                              <span className="inline-block w-1 h-1 rounded-full bg-background/50 shrink-0" />
                              {nom}
                            </li>
                          ))}
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
