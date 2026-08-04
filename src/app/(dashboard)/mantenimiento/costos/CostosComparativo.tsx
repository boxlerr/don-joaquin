"use client";

// Cuadro de doble entrada: una fila por proveedor, una columna por mes. Es la
// pregunta que la tabla mensual no puede contestar — "¿por qué marzo salió $12M
// más que febrero?" — y que en una lista plana de 92 filas no se ve.

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, Minus, TrendingDown, TrendingUp } from "lucide-react";
import Sparkline from "@/app/(dashboard)/metricas/components/Sparkline";
import { ars, mesCorto, mesLabel, porcentaje, variacion } from "./formato";
import type { CostoRepRep } from "./actions";

const thCls =
  "h-8 px-2 text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap bg-muted border-b border-border";
const tdCls = "py-1 border-b border-border/50";
const tfCls =
  "px-2 py-1.5 text-right font-mono text-[13px] tabular-nums whitespace-nowrap bg-muted border-t border-border";
const numCls = "text-right font-mono text-[13px] tabular-nums whitespace-nowrap";
const fijaTh = "sticky left-0 z-30 bg-muted shadow-[1px_0_0_0_rgba(0,0,0,0.08)]";
const fijaTd = "sticky left-0 z-10 bg-card shadow-[1px_0_0_0_rgba(0,0,0,0.08)]";

const RANGOS = [
  { meses: 3, label: "3 meses" },
  { meses: 6, label: "6 meses" },
  { meses: 12, label: "12 meses" },
  { meses: 0, label: "Todo" },
] as const;

type Orden = { col: "proveedor" | "total"; dir: "asc" | "desc" };

export default function CostosComparativo({
  rows,
  onVerProveedor,
  onCargarMes,
}: {
  /** Todas las filas de todos los meses. */
  rows: CostoRepRep[];
  onVerProveedor: (proveedor: string) => void;
  /** Saltar a cargar ese mes desde una celda vacía. */
  onCargarMes: (mesISO: string) => void;
}) {
  // Alfabético por defecto: el orden por importe se pide clickeando Total.
  const [orden, setOrden] = useState<Orden>({ col: "proveedor", dir: "asc" });
  const [rango, setRango] = useState<number>(12);

  const mesesTodos = useMemo(
    () => [...new Set(rows.map((r) => r.mes))].sort(),
    [rows],
  );
  const meses = useMemo(
    () => (rango > 0 ? mesesTodos.slice(-rango) : mesesTodos),
    [mesesTodos, rango],
  );

  // Índice plano proveedor|mes: con 24 meses × 200 proveedores son 4.800 celdas
  // y buscar linealmente en cada una se nota.
  const celdas = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(`${r.proveedor}|${r.mes}`, Number(r.facturado_total));
    return m;
  }, [rows]);

  const proveedores = useMemo(() => {
    const dentro = new Set(meses);
    const acc = new Map<string, number>();
    for (const r of rows) {
      if (!dentro.has(r.mes)) continue;
      acc.set(r.proveedor, (acc.get(r.proveedor) ?? 0) + Number(r.facturado_total));
    }
    const lista = [...acc.entries()].map(([proveedor, total]) => ({ proveedor, total }));
    const f = orden.dir === "asc" ? 1 : -1;
    return lista.sort((a, b) =>
      orden.col === "proveedor"
        ? f * a.proveedor.localeCompare(b.proveedor, "es")
        : f * (a.total - b.total),
    );
  }, [rows, meses, orden]);

  const totalPorMes = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.mes, (m.get(r.mes) ?? 0) + Number(r.facturado_total));
    return m;
  }, [rows]);

  const totalGeneral = useMemo(
    () => meses.reduce((a, m) => a + (totalPorMes.get(m) ?? 0), 0),
    [meses, totalPorMes],
  );

  // Bandas de año arriba de los meses: "ene feb ene feb" sin el año es ilegible.
  const bandasAnio = useMemo(() => {
    const out: { anio: string; cantidad: number }[] = [];
    for (const m of meses) {
      const anio = m.slice(0, 4);
      const ultima = out[out.length - 1];
      if (ultima && ultima.anio === anio) ultima.cantidad += 1;
      else out.push({ anio, cantidad: 1 });
    }
    return out;
  }, [meses]);

  const toggle = (col: Orden["col"]) =>
    setOrden((o) =>
      o.col === col
        ? { col, dir: o.dir === "desc" ? "asc" : "desc" }
        : { col, dir: col === "proveedor" ? "asc" : "desc" },
    );
  const flecha = (col: Orden["col"]) =>
    orden.col === col ? (
      orden.dir === "desc" ? <ArrowDown size={11} /> : <ArrowUp size={11} />
    ) : (
      <ArrowUpDown size={11} className="opacity-30" />
    );

  if (mesesTodos.length === 0) {
    return (
      <div className="rounded-[8px] border border-border bg-card py-16 text-center text-sm text-muted-foreground">
        Todavía no hay meses cargados para comparar.
      </div>
    );
  }

  const ultimo = meses[meses.length - 1];
  const penultimo = meses[meses.length - 2];

  return (
    <div className="bg-card rounded-[8px] border border-border shadow-sm">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5 border-b border-border">
        <div className="flex items-baseline gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Facturado
          </span>
          <span className="font-mono text-base font-bold text-foreground tabular-nums">
            {ars(totalGeneral)}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {meses.length} {meses.length === 1 ? "mes" : "meses"} · {proveedores.length} proveedores
          </span>
        </div>
        <div className="ml-auto inline-flex rounded-lg bg-muted p-1">
          {RANGOS.filter((r) => r.meses === 0 || r.meses < mesesTodos.length).map((r) => (
            <button
              key={r.label}
              type="button"
              onClick={() => setRango(r.meses)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                rango === r.meses
                  ? "bg-card text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-auto max-h-[calc(100dvh-22rem)] min-h-[15rem]">
        <table className="w-full text-sm border-separate border-spacing-0">
          <thead className="sticky top-0 z-20">
            <tr>
              <th rowSpan={2} className={`${thCls} ${fijaTh} text-left pl-4 min-w-[14rem] align-bottom`}>
                <button
                  type="button"
                  onClick={() => toggle("proveedor")}
                  className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${orden.col === "proveedor" ? "text-foreground" : ""}`}
                >
                  Proveedor {flecha("proveedor")}
                </button>
              </th>
              {bandasAnio.map((b) => (
                <th
                  key={b.anio}
                  colSpan={b.cantidad}
                  className={`${thCls} text-center border-l border-border/40`}
                >
                  {b.anio}
                </th>
              ))}
              <th rowSpan={2} className={`${thCls} text-right align-bottom border-l border-border/40`}>
                <button
                  type="button"
                  onClick={() => toggle("total")}
                  className={`inline-flex items-center gap-1 ml-auto hover:text-foreground transition-colors ${orden.col === "total" ? "text-foreground" : ""}`}
                >
                  Total {flecha("total")}
                </button>
              </th>
              <th rowSpan={2} className={`${thCls} text-right align-bottom`}>
                Último mes
              </th>
              <th rowSpan={2} className={`${thCls} text-center align-bottom`}>
                Tendencia
              </th>
            </tr>
            <tr>
              {meses.map((m, i) => (
                <th
                  key={m}
                  className={`${thCls} text-right ${i > 0 && m.slice(0, 4) !== meses[i - 1].slice(0, 4) ? "border-l-2 border-border" : "border-l border-border/40"}`}
                >
                  {mesCorto(m).split(" ")[0]}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {proveedores.map((p) => {
              const serie = meses.map((m) => celdas.get(`${p.proveedor}|${m}`) ?? null);
              const actual = celdas.get(`${p.proveedor}|${ultimo}`) ?? null;
              const previo = penultimo ? celdas.get(`${p.proveedor}|${penultimo}`) : undefined;
              const varPct = actual != null ? variacion(actual, previo ?? undefined) : null;
              // Banda muerta: un +0,02% pintado de rojo no dice nada.
              const muerta = varPct === null || Math.abs(varPct) < 0.05;
              const sube = varPct !== null && varPct > 0;
              const Icono = muerta ? Minus : sube ? TrendingUp : TrendingDown;
              // Es un costo: subir es malo.
              const tono = muerta
                ? "text-muted-foreground"
                : sube
                  ? "text-[#EF4444]"
                  : "text-[#10B981]";
              return (
                <tr key={p.proveedor} className="hover:bg-muted/20 transition-colors">
                  <td className={`${tdCls} ${fijaTd} pl-4 pr-2 min-w-[14rem]`}>
                    <button
                      type="button"
                      onClick={() => onVerProveedor(p.proveedor)}
                      className="inline-flex items-center gap-1 text-left text-[13px] font-medium text-foreground hover:text-primary"
                    >
                      {p.proveedor}
                      <ChevronRight size={12} className="text-muted-foreground/40 shrink-0" />
                    </button>
                  </td>
                  {meses.map((m, i) => {
                    const v = celdas.get(`${p.proveedor}|${m}`);
                    const borde =
                      i > 0 && m.slice(0, 4) !== meses[i - 1].slice(0, 4)
                        ? "border-l-2 border-border"
                        : "border-l border-border/40";
                    return (
                      <td key={m} className={`${tdCls} px-2 ${numCls} ${borde}`}>
                        {v === undefined ? (
                          <button
                            type="button"
                            onClick={() => onCargarMes(m)}
                            title={`${p.proveedor} no tiene costos en ${mesLabel(m)}`}
                            className="text-muted-foreground/25 hover:text-primary"
                          >
                            ·
                          </button>
                        ) : (
                          <span className={v < 0 ? "text-[#F59E0B]" : "text-foreground/80"}>
                            {ars(v)}
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td className={`${tdCls} px-2 ${numCls} font-semibold text-foreground border-l border-border/40`}>
                    {ars(p.total)}
                  </td>
                  <td className={`${tdCls} px-2 ${numCls}`}>
                    <span className={`inline-flex items-center gap-1 ${tono}`}>
                      <Icono size={11} />
                      {varPct === null ? "—" : porcentaje(Math.abs(varPct))}
                    </span>
                  </td>
                  <td className={`${tdCls} px-2 text-center`}>
                    <Sparkline valores={serie} width={72} height={24} className="inline-block" />
                  </td>
                </tr>
              );
            })}
          </tbody>

          <tfoot className="sticky bottom-0 z-20">
            <tr>
              <td
                className={`${tfCls} ${fijaTd} !bg-muted z-30 pl-4 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground`}
              >
                Total del mes
              </td>
              {meses.map((m, i) => (
                <td
                  key={m}
                  className={`${tfCls} text-foreground ${i > 0 && m.slice(0, 4) !== meses[i - 1].slice(0, 4) ? "border-l-2 border-border" : "border-l border-border/40"}`}
                >
                  {ars(totalPorMes.get(m) ?? 0)}
                </td>
              ))}
              <td className={`${tfCls} font-black text-foreground border-l border-border/40`}>
                {ars(totalGeneral)}
              </td>
              <td className={tfCls} />
              <td className={tfCls} />
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="px-4 py-2 text-[11px] text-muted-foreground border-t border-border">
        Cada fila es un proveedor y cada columna un mes. Tocá el nombre para ver su historia
        completa, o un punto para cargar ese mes.
      </p>
    </div>
  );
}
