"use client";

// Vista anual: el año completo de un vistazo.
//
// Arriba, una matriz de empleados × meses: cada mes son cinco bloques que se
// encienden según cuántos días de vacaciones tiene esa persona ese mes. Sirve
// para leer en diagonal quién se toma todo en diciembre y quién no se tomó nada.
//
// Abajo, tres paneles que responden lo que se pregunta al planificar el año:
// cómo se reparte la carga mes a mes, qué meses están más cargados y cuándo
// vienen los picos.

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Info, Plus, Users } from "lucide-react";
import AvatarPersona from "@/components/ui/AvatarPersona";
import { choferSlug } from "@/lib/chofer-slug";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import type { VacacionesPeriodo } from "./lib";
import { nombreCorto } from "./CronogramaGrid";

const MES_LARGO = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const MES_CORTO = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const FILAS_VISIBLES = 7;
/**
 * Cada mes se dibuja con cuatro bloques, uno por semana: días 1–7, 8–14, 15–21 y
 * 22 en adelante. Antes eran cinco bloques que sólo medían "intensidad" y no
 * querían decir nada; así, además de cuánto, se ve CUÁNDO dentro del mes.
 */
const SEMANAS_MES = 4;
const semanaDelMes = (dia: number) => Math.min(SEMANAS_MES - 1, Math.floor((dia - 1) / 7));

/**
 * Escalones de días de vacaciones por persona y por mes. Son cortes absolutos,
 * no un umbral configurable: describen lo que pasó, no lo que se permite.
 */
const NIVELES = [
  { hasta: 0, label: "Sin vacaciones", color: "#E2E8F0" },
  { hasta: 5, label: "Pocos (1-5)", color: "#86EFAC" },
  { hasta: 10, label: "Varios (6-10)", color: "#22C55E" },
  { hasta: 20, label: "Muchos (11-20)", color: "#F59E0B" },
  { hasta: Infinity, label: "Muy muchos (20+)", color: "#EF4444" },
] as const;

function nivelDe(dias: number) {
  return NIVELES.find((n) => dias <= n.hasta)!;
}

function fecha(iso: string): Date {
  return new Date(iso + "T00:00:00");
}

interface Props {
  periodos: VacacionesPeriodo[];
  anio: number;
  hoyISO: string;
  /** chofer_id → URL de la foto. */
  fotos: Map<string, string>;
  /** chofer_id → área, para la silueta del avatar. */
  sectores: Map<string, string>;
  /**
   * Abrir el calendario de un mes. Todo lo que se ve acá es un resumen: el
   * lugar donde se hace algo con eso es el mes concreto, así que cada número,
   * barra y celda lleva ahí.
   */
  onVerMes: (mes: number) => void;
}

export default function CronogramaAnual({ periodos, anio, hoyISO, fotos, sectores, onVerMes }: Props) {
  const [verTodos, setVerTodos] = useState(false);
  const [verPicos, setVerPicos] = useState(false);

  // --- Días de vacaciones por persona/mes, por mes y por día ----------------
  const porPersona = new Map<
    string,
    {
      id: string;
      nombre: string;
      apellido: string;
      meses: number[];
      /** Por mes, qué semanas (0–3) tiene con vacaciones. */
      semanas: boolean[][];
      total: number;
    }
  >();
  const diasPorMes = Array.from({ length: 12 }, () => 0);
  const personasPorDia = new Map<string, Set<string>>();

  for (const p of periodos) {
    const desde = p.fecha_inicio < `${anio}-01-01` ? `${anio}-01-01` : p.fecha_inicio;
    const hasta = p.fecha_fin > `${anio}-12-31` ? `${anio}-12-31` : p.fecha_fin;
    if (desde > hasta) continue;
    let fila = porPersona.get(p.chofer_id);
    if (!fila) {
      fila = {
        id: p.chofer_id,
        nombre: p.nombre,
        apellido: p.apellido,
        meses: Array.from({ length: 12 }, () => 0),
        semanas: Array.from({ length: 12 }, () => Array.from({ length: SEMANAS_MES }, () => false)),
        total: 0,
      };
      porPersona.set(p.chofer_id, fila);
    }
    for (let d = fecha(desde); d <= fecha(hasta); d.setDate(d.getDate() + 1)) {
      const mes = d.getMonth();
      fila.meses[mes] = (fila.meses[mes] ?? 0) + 1;
      fila.semanas[mes]![semanaDelMes(d.getDate())] = true;
      fila.total += 1;
      diasPorMes[mes] = (diasPorMes[mes] ?? 0) + 1;
      const key = `${d.getFullYear()}-${String(mes + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const set = personasPorDia.get(key) ?? new Set<string>();
      set.add(p.chofer_id);
      personasPorDia.set(key, set);
    }
  }

  // Primero los que más días se toman en el año: son los que explican la carga.
  const filas = [...porPersona.values()].sort(
    (a, b) => b.total - a.total || a.apellido.localeCompare(b.apellido),
  );
  const visibles = verTodos ? filas : filas.slice(0, FILAS_VISIBLES);
  const ocultas = filas.length - visibles.length;

  // --- Carga por mes --------------------------------------------------------
  const maxDiasMes = Math.max(1, ...diasPorMes);
  const cargaMeses = diasPorMes
    .map((dias, mes) => {
      const diasDelMes = new Date(anio, mes + 1, 0).getDate();
      return { mes, dias, promedio: dias / diasDelMes };
    })
    .filter((m) => m.dias > 0)
    .sort((a, b) => b.promedio - a.promedio);
  const maxPromedio = Math.max(0.001, ...cargaMeses.map((m) => m.promedio));
  const mesPico = cargaMeses[0];

  /** Etiqueta de carga, relativa al mes más cargado del propio año. */
  const etiquetaCarga = (promedio: number) => {
    const r = promedio / maxPromedio;
    if (r >= 0.85) return { texto: "Muy alta", color: "#DC2626" };
    if (r >= 0.6) return { texto: "Alta", color: "#EA580C" };
    if (r >= 0.35) return { texto: "Media", color: "#CA8A04" };
    return { texto: "Baja", color: "#059669" };
  };

  // --- Próximos picos: tramos seguidos con más gente afuera -----------------
  // Se agrupan los días consecutivos que comparten "mucha" ocupación para no
  // listar 30 días sueltos; de cada tramo interesa cuánta gente llega a faltar.
  const picos = (() => {
    const dias = [...personasPorDia.entries()]
      .filter(([d]) => d >= hoyISO)
      .sort(([a], [b]) => a.localeCompare(b));
    if (dias.length === 0) return [];
    const piso = Math.max(2, Math.round(Math.max(...dias.map(([, s]) => s.size)) * 0.5));
    const tramos: { desde: string; hasta: string; pico: number }[] = [];
    for (const [d, set] of dias) {
      if (set.size < piso) continue;
      const ultimo = tramos[tramos.length - 1];
      const seguido =
        ultimo && Math.round((fecha(d).getTime() - fecha(ultimo.hasta).getTime()) / 86_400_000) <= 2;
      if (seguido) {
        ultimo.hasta = d;
        ultimo.pico = Math.max(ultimo.pico, set.size);
      } else {
        tramos.push({ desde: d, hasta: d, pico: set.size });
      }
    }
    return tramos.sort((a, b) => b.pico - a.pico || a.desde.localeCompare(b.desde));
  })();
  const picosVisibles = verPicos ? picos : picos.slice(0, 3);
  // Los picos se comparan entre ellos, no contra la carga mensual: mezclando las
  // dos escalas (personas por día vs. personas de golpe) todos daban "Baja".
  const maxPico = Math.max(1, ...picos.map((p) => p.pico));
  const etiquetaPico = (pico: number) => {
    const r = pico / maxPico;
    if (r >= 0.85) return { texto: "Muy alta", color: "#DC2626" };
    if (r >= 0.6) return { texto: "Alta", color: "#EA580C" };
    if (r >= 0.35) return { texto: "Media", color: "#CA8A04" };
    return { texto: "Baja", color: "#059669" };
  };

  const fmtTramo = (desde: string, hasta: string) => {
    const a = fecha(desde);
    const b = fecha(hasta);
    const mesA = MES_CORTO[a.getMonth()]!;
    const mesB = MES_CORTO[b.getMonth()]!;
    return a.getMonth() === b.getMonth()
      ? `${a.getDate()} - ${b.getDate()} ${mesA}`
      : `${a.getDate()} ${mesA} - ${b.getDate()} ${mesB}`;
  };

  if (filas.length === 0) {
    return (
      <div className="rounded-[8px] border border-border bg-card px-5 py-10 text-center text-sm text-muted-foreground shadow-sm">
        No hay vacaciones cargadas en {anio} para este filtro.
      </div>
    );
  }

  return (
    <TooltipProvider delay={120}>
      <div className="space-y-3">
        {/* --- Matriz empleados × meses ---------------------------------- */}
        <div className="overflow-hidden rounded-[8px] border border-border bg-card shadow-sm">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-border px-4 py-3">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              Vista anual por mes
              <Tooltip>
                <TooltipTrigger
                  render={<Info size={13} className="cursor-help text-muted-foreground/50" />}
                />
                <TooltipContent side="right" className="block max-w-[260px] text-left leading-snug">
                  Cada mes son cuatro bloques, uno por semana (días 1–7, 8–14, 15–21 y 22 en
                  adelante): se pinta la semana en la que la persona está de vacaciones, y el color
                  dice cuántos días son en total ese mes.
                </TooltipContent>
              </Tooltip>
            </h3>
            <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              {NIVELES.map((n) => (
                <span key={n.label} className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-full" style={{ backgroundColor: n.color }} />
                  {n.label}
                </span>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[58rem] table-fixed border-collapse text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="sticky left-0 z-10 w-[15rem] bg-card px-4 py-2 text-left text-[12px] font-medium text-muted-foreground">
                    Empleado
                  </th>
                  {MES_CORTO.map((m, mes) => (
                    <th key={m} className="px-1 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => onVerMes(mes)}
                        title={`Ver ${MES_LARGO[mes]} día por día`}
                        className="rounded px-1.5 py-0.5 text-[12px] font-medium text-muted-foreground hover:bg-muted hover:text-primary"
                      >
                        {m}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibles.map((f) => (
                  <tr key={f.id} className="border-b border-border/60 last:border-b-0 hover:bg-muted/20">
                    <td className="sticky left-0 z-10 w-[15rem] bg-card px-4 py-1.5 shadow-[1px_0_0_0_rgba(0,0,0,0.06)]">
                      <Link
                        href={`/choferes/${choferSlug(f)}?tab=vacaciones`}
                        title={`${f.apellido}, ${f.nombre} · ${f.total} días en ${anio}`}
                        className="flex items-center gap-2 text-[13px] font-medium text-foreground hover:text-primary"
                      >
                        <AvatarPersona
                          name={`${f.nombre} ${f.apellido}`}
                          src={fotos.get(f.id) ?? undefined}
                          size={24}
                          rol={sectores.get(f.id)}
                          className="shrink-0"
                        />
                        <span className="truncate leading-tight" title={`${f.apellido}, ${f.nombre}`}>
                          {nombreCorto(f.apellido, f.nombre)}
                        </span>
                      </Link>
                    </td>
                    {f.meses.map((dias, mes) => {
                      const nivel = nivelDe(dias);
                      const semanas = f.semanas[mes]!;
                      return (
                        <td key={mes} className="px-1 py-2">
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <button
                                  type="button"
                                  onClick={() => onVerMes(mes)}
                                  title={`Ver ${MES_LARGO[mes]} día por día`}
                                  className="flex w-full gap-[3px] rounded py-1 hover:bg-muted/60">
                                  {semanas.map((conVacaciones, i) => (
                                    <span
                                      key={i}
                                      className="h-[14px] min-w-[9px] flex-1 rounded-[3px]"
                                      style={{ backgroundColor: conVacaciones ? nivel.color : "#E2E8F0" }}
                                    />
                                  ))}
                                </button>
                              }
                            />
                            <TooltipContent side="top" className="block text-left leading-snug">
                              {dias === 0
                                ? `Sin vacaciones en ${MES_LARGO[mes]}`
                                : `${dias} día${dias !== 1 ? "s" : ""} de vacaciones en ${MES_LARGO[mes]} · semana${
                                    semanas.filter(Boolean).length !== 1 ? "s" : ""
                                  } ${semanas.map((v, i) => (v ? i + 1 : null)).filter(Boolean).join(", ")} del mes`}
                            </TooltipContent>
                          </Tooltip>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {(ocultas > 0 || verTodos) && (
            <button
              type="button"
              onClick={() => setVerTodos((v) => !v)}
              className="inline-flex w-full items-center gap-1.5 border-t border-border px-4 py-2.5 text-left text-[13px] text-muted-foreground hover:text-primary"
            >
              <Plus size={14} />
              {verTodos ? "Ver menos" : `${ocultas} empleado${ocultas !== 1 ? "s" : ""} más`}
            </button>
          )}
        </div>

        {/* --- Tres paneles ---------------------------------------------- */}
        <div className="grid gap-3 lg:grid-cols-3">
          {/* Carga por mes */}
          <div className="rounded-[8px] border border-border bg-card p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground">Carga de vacaciones por mes</h3>
            <div className="mt-4 flex gap-2">
              {/* Eje: sin una referencia numérica, las barras sólo dicen cuál es
                  más alta, no de cuánto estamos hablando. */}
              <div className="flex h-32 w-7 shrink-0 flex-col justify-between text-right text-[9px] tabular-nums text-muted-foreground">
                <span>{maxDiasMes}</span>
                <span>{Math.round(maxDiasMes / 2)}</span>
                <span>0</span>
              </div>
              <div className="flex h-32 flex-1 items-end gap-1.5">
              {diasPorMes.map((dias, mes) => {
                const alto = Math.max(2, (dias / maxDiasMes) * 100);
                const nivel = etiquetaCarga(dias / new Date(anio, mes + 1, 0).getDate());
                return (
                  <Tooltip key={mes}>
                    <TooltipTrigger
                      render={
                        <button
                          type="button"
                          onClick={() => onVerMes(mes)}
                          aria-label={`Ver ${MES_LARGO[mes]}`}
                          className="w-full flex-1 rounded-[3px] transition-[filter] hover:brightness-90"
                          style={{
                            height: `${alto}%`,
                            backgroundColor: dias === 0 ? "#E2E8F0" : nivel.color,
                          }}
                        />
                      }
                    />
                    <TooltipContent side="top" className="block text-left leading-snug">
                      {MES_LARGO[mes]}: {dias} días-persona de vacaciones
                    </TooltipContent>
                  </Tooltip>
                );
              })}
              </div>
            </div>
            <div className="mt-1.5 flex gap-1.5 pl-9">
              {MES_CORTO.map((m) => (
                <span key={m} className="flex-1 text-center text-[9px] text-muted-foreground">
                  {m}
                </span>
              ))}
            </div>
            {mesPico && (
              <p className="mt-3 border-t border-border pt-2.5 text-[12px] leading-snug text-muted-foreground">
                <button
                  type="button"
                  onClick={() => onVerMes(mesPico.mes)}
                  className="font-medium text-foreground underline decoration-dotted underline-offset-2 hover:text-primary"
                >
                  {MES_LARGO[mesPico.mes]}
                </button>{" "}
                es el mes con
                más vacaciones del año: {mesPico.dias} días-persona, un promedio de{" "}
                {mesPico.promedio.toFixed(1)} personas afuera por día.
              </p>
            )}
          </div>

          {/* Meses con mayor carga */}
          <div className="rounded-[8px] border border-border bg-card p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground">Meses con mayor carga</h3>
            <ul className="mt-3 space-y-2.5">
              {cargaMeses.slice(0, 5).map((m) => {
                const nivel = etiquetaCarga(m.promedio);
                return (
                  <li key={m.mes}>
                    <button
                      type="button"
                      onClick={() => onVerMes(m.mes)}
                      title={`Ver ${MES_LARGO[m.mes]} día por día`}
                      className="flex w-full items-center gap-2 rounded-[4px] px-1 py-0.5 text-left text-[12px] hover:bg-muted/60"
                    >
                    <span className="w-[4.5rem] shrink-0 text-foreground">{MES_LARGO[m.mes]}</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-[2px] bg-muted">
                      <span
                        className="block h-full rounded-[2px]"
                        style={{
                          width: `${(m.promedio / maxPromedio) * 100}%`,
                          backgroundColor: nivel.color,
                        }}
                      />
                    </span>
                    <span className="w-[4.5rem] shrink-0 text-right tabular-nums text-muted-foreground">
                      {m.promedio.toFixed(1)} p/día
                    </span>
                    <span className="w-14 shrink-0 text-right font-medium" style={{ color: nivel.color }}>
                      {nivel.texto}
                    </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Próximos picos */}
          <div className="flex flex-col rounded-[8px] border border-border bg-card p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground">Próximos picos de vacaciones</h3>
            <ul className="mt-3 flex-1 space-y-2">
              {picosVisibles.map((p) => {
                const nivel = etiquetaPico(p.pico);
                return (
                  <li key={p.desde}>
                    <button
                      type="button"
                      onClick={() => onVerMes(fecha(p.desde).getMonth())}
                      title={`Ver ${MES_LARGO[fecha(p.desde).getMonth()]} día por día`}
                      className="flex w-full flex-wrap items-center gap-x-2 gap-y-0.5 rounded-[6px] border border-border px-2.5 py-2 text-left text-[12px] hover:border-primary/40 hover:bg-muted/40"
                    >
                    <span className="shrink-0 font-medium tabular-nums" style={{ color: nivel.color }}>
                      {fmtTramo(p.desde, p.hasta)}
                    </span>
                    <span className="min-w-0 flex-1 text-muted-foreground">
                      Carga esperada {nivel.texto.toLowerCase()}
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-muted-foreground">
                      hasta {p.pico} personas <Users size={12} />
                    </span>
                    </button>
                  </li>
                );
              })}
              {picos.length === 0 && (
                <li className="text-[12px] text-muted-foreground">
                  No quedan tramos con mucha gente afuera en lo que resta de {anio}.
                </li>
              )}
            </ul>
            {picos.length > 3 && (
              <button
                type="button"
                onClick={() => setVerPicos((v) => !v)}
                className="mt-3 inline-flex items-center gap-1 self-start text-[12px] text-muted-foreground hover:text-primary"
              >
                {verPicos ? "Ver menos" : "Ver todos los picos"} <ChevronRight size={13} />
              </button>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
