"use client";

// Tabla estilo Excel de una métrica: mismas columnas que la planilla que
// exportamos (y que la familia ya conoce), con orden por columna, fila de
// TOTALES pinned abajo, ranking y click en la fila → drawer del chofer.

import { useMemo, useState } from "react";
import { ArrowUp, ArrowDown, ChevronsUpDown } from "lucide-react";
import type { MetricaChofer } from "../actions";
import type { MetricaDef } from "./metricas-def";
import { flotaLabel } from "./metricas-def";
import { money, numAr, pct } from "./format";

type Col = {
  key: string;
  header: string;
  align: "l" | "r";
  fmt: (c: MetricaChofer) => string;
  sortVal: (c: MetricaChofer) => number | string | null;
  total?: (rows: MetricaChofer[]) => string;
  /** Columna principal de la métrica (recibe el punto de color por cuartil). */
  principal?: boolean;
  /** Ocultable en pantallas chicas. */
  secundaria?: boolean;
};

const sum = (rows: MetricaChofer[], f: (c: MetricaChofer) => number) => rows.reduce((s, c) => s + f(c), 0);

const colChofer: Col = {
  key: "nombre", header: "Chofer", align: "l",
  fmt: (c) => c.nombre,
  sortVal: (c) => c.nombre,
  total: () => "TOTALES",
};
const colFlota: Col = {
  key: "flota", header: "Flota", align: "l",
  fmt: (c) => flotaLabel(c),
  sortVal: (c) => flotaLabel(c),
  total: () => "",
};
const colKm: Col = {
  key: "km", header: "KM", align: "r",
  fmt: (c) => numAr(c.km),
  sortVal: (c) => c.km,
  total: (rows) => numAr(sum(rows, (c) => c.km)),
};
const colFact: Col = {
  key: "facturacion", header: "Facturación", align: "r",
  fmt: (c) => money(c.facturacion),
  sortVal: (c) => c.facturacion,
  total: (rows) => money(sum(rows, (c) => c.facturacion)),
};

function columnasDe(def: MetricaDef): Col[] {
  switch (def.id) {
    case "factkm":
      return [colChofer, colFlota, colKm, colFact, {
        key: "factkm", header: "$/km", align: "r", principal: true,
        fmt: (c) => money(def.valorChofer(c), 0),
        sortVal: (c) => def.valorChofer(c),
        total: (rows) => {
          const km = sum(rows, (c) => c.km);
          return km > 0 ? money(sum(rows, (c) => c.facturacion) / km, 2) : "—";
        },
      }];
    case "vacios":
      return [colChofer, colFlota, colKm, {
        key: "kmVacios", header: "KM vacíos", align: "r",
        fmt: (c) => numAr(c.kmVacios),
        sortVal: (c) => c.kmVacios,
        total: (rows) => numAr(sum(rows, (c) => c.kmVacios)),
      }, {
        key: "pctVacios", header: "% vacíos", align: "r", principal: true,
        fmt: (c) => pct(def.valorChofer(c), 2),
        sortVal: (c) => def.valorChofer(c),
        total: (rows) => {
          const km = sum(rows, (c) => c.km);
          return km > 0 ? pct((sum(rows, (c) => c.kmVacios) / km) * 100, 2) : "—";
        },
      }];
    case "km100":
      return [colChofer, colFlota, colKm, {
        key: "km100", header: "KM al 100", align: "r",
        fmt: (c) => numAr(c.km100),
        sortVal: (c) => c.km100,
        total: (rows) => numAr(sum(rows, (c) => c.km100)),
      }, {
        key: "pct100", header: "% al 100", align: "r", principal: true,
        fmt: (c) => pct(def.valorChofer(c), 2),
        sortVal: (c) => def.valorChofer(c),
        total: (rows) => {
          const km = sum(rows, (c) => c.km);
          return km > 0 ? pct((sum(rows, (c) => c.km100) / km) * 100, 2) : "—";
        },
      }];
    case "toneladas":
      return [colChofer, colFlota, colKm, {
        key: "ton", header: "Ton. promedio", align: "r", principal: true,
        fmt: (c) => numAr(def.valorChofer(c), 2),
        sortVal: (c) => def.valorChofer(c),
        total: (rows) => {
          const con = rows.filter((c) => c.toneladas > 0);
          return con.length ? numAr(sum(con, (c) => c.toneladas) / con.length, 2) : "—";
        },
      }];
    case "sueldo":
      return [colChofer, colFlota, colFact, {
        key: "sueldoTotal", header: "Sueldo total", align: "r",
        fmt: (c) => money(c.sueldoTotal),
        sortVal: (c) => c.sueldoTotal,
        total: (rows) => money(sum(rows, (c) => c.sueldoTotal)),
      }, {
        key: "sueldoNeto", header: "Sueldo neto", align: "r", secundaria: true,
        fmt: (c) => money(c.sueldoNeto),
        sortVal: (c) => c.sueldoNeto,
        total: (rows) => money(sum(rows, (c) => c.sueldoNeto)),
      }, {
        key: "pctSueldo", header: "% s/fact", align: "r", principal: true,
        fmt: (c) => pct(def.valorChofer(c), 2),
        sortVal: (c) => def.valorChofer(c),
        total: (rows) => {
          const f = sum(rows, (c) => c.facturacion);
          return f > 0 ? pct((sum(rows, (c) => c.sueldoTotal) / f) * 100, 2) : "—";
        },
      }, {
        key: "retenciones", header: "Retenciones", align: "r", secundaria: true,
        fmt: (c) => (c.retenciones == null ? "—" : money(c.retenciones)),
        sortVal: (c) => c.retenciones,
        total: (rows) => money(sum(rows, (c) => c.retenciones ?? 0)),
      }, {
        key: "adelantos", header: "Adelantos", align: "r", secundaria: true,
        fmt: (c) => (c.adelantos == null ? "—" : money(c.adelantos)),
        sortVal: (c) => c.adelantos,
        total: (rows) => money(sum(rows, (c) => c.adelantos ?? 0)),
      }, {
        key: "devolPrestamo", header: "Devol. prést.", align: "r", secundaria: true,
        fmt: (c) => (c.devolPrestamo == null ? "—" : money(c.devolPrestamo)),
        sortVal: (c) => c.devolPrestamo,
        total: (rows) => money(sum(rows, (c) => c.devolPrestamo ?? 0)),
      }, {
        key: "embargo", header: "Embargo jud.", align: "r", secundaria: true,
        fmt: (c) => (c.embargoJudicial == null ? "—" : money(c.embargoJudicial)),
        sortVal: (c) => c.embargoJudicial,
        total: (rows) => money(sum(rows, (c) => c.embargoJudicial ?? 0)),
      }, {
        key: "aguinaldo", header: "Aguinaldo", align: "r", secundaria: true,
        fmt: (c) => (c.aguinaldo == null ? "—" : money(c.aguinaldo)),
        sortVal: (c) => c.aguinaldo,
        total: (rows) => money(sum(rows, (c) => c.aguinaldo ?? 0)),
      }];
  }
}

/** Punto de color por cuartil en la columna principal (sutil, no arcoíris). */
function cuartilDot(posicion: number, total: number): string {
  if (total < 4) return "bg-muted-foreground/30";
  const q = posicion / total;
  if (q <= 0.25) return "bg-emerald-500";
  if (q >= 0.75) return "bg-red-400";
  return "bg-muted-foreground/30";
}

export default function MetricaTable({
  def, choferes, mostrarFlota, onChofer, comparacion,
}: {
  def: MetricaDef;
  choferes: MetricaChofer[];
  /** true cuando la vista mezcla flotas ("Todas"). */
  mostrarFlota: boolean;
  onChofer: (c: MetricaChofer) => void;
  /** Mes de comparación: agrega columnas "[métrica] mes" y "Δ". */
  comparacion?: { etiqueta: string; choferes: MetricaChofer[] } | null;
}) {
  const cols = useMemo(
    () => columnasDe(def).filter((c) => mostrarFlota || c.key !== "flota"),
    [def, mostrarFlota],
  );

  // Valor de la métrica en el mes comparado, por nombre y por choferId (el
  // modo en vivo nombra distinto que las planillas).
  const cmpPorNombre = useMemo(() => {
    if (!comparacion) return null;
    const m = new Map<string, number | null>();
    for (const c of comparacion.choferes) {
      const v = def.valorChofer(c);
      m.set(c.nombre, v);
      if (c.choferId && !m.has(c.choferId)) m.set(c.choferId, v);
    }
    return m;
  }, [comparacion, def]);

  // Orden inicial: la columna principal, del mejor al peor.
  const principal = cols.find((c) => c.principal)!;
  const [sortKey, setSortKey] = useState(principal.key);
  const [sortAsc, setSortAsc] = useState(def.mejorMenos);

  const filas = useMemo(() => {
    const col = cols.find((c) => c.key === sortKey) ?? principal;
    const copia = [...choferes];
    copia.sort((a, b) => {
      const va = col.sortVal(a);
      const vb = col.sortVal(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1; // nulls al fondo siempre
      if (vb == null) return -1;
      const cmp = typeof va === "string" || typeof vb === "string"
        ? String(va).localeCompare(String(vb), "es")
        : (va as number) - (vb as number);
      return sortAsc ? cmp : -cmp;
    });
    return copia;
  }, [choferes, cols, sortKey, sortAsc, principal]);

  // Ranking del mejor al peor según la métrica (independiente del orden visible).
  const rankPorNombre = useMemo(() => {
    const orden = [...choferes]
      .filter((c) => def.valorChofer(c) != null)
      .sort((a, b) => {
        const va = def.valorChofer(a)!;
        const vb = def.valorChofer(b)!;
        return def.mejorMenos ? va - vb : vb - va;
      });
    return new Map(orden.map((c, i) => [c.nombre + c.flota, i]));
  }, [choferes, def]);

  const clickHeader = (key: string) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      const col = cols.find((c) => c.key === key);
      // Por defecto: texto asc, números desc (salvo la principal en métricas "menos es mejor").
      setSortAsc(col?.align === "l" ? true : col?.principal ? def.mejorMenos : false);
    }
  };

  if (!filas.length) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Sin choferes para los filtros elegidos.</p>;
  }

  const conValor = filas.filter((c) => def.valorChofer(c) != null).length;

  return (
    // Tabla de consulta densa (mismas columnas que el Excel): en celular
    // scrollea de costado y la columna del chofer queda fija a la izquierda
    // para no perder de vista de quién es cada número.
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-sm min-w-[560px]">
        <thead className="sticky top-0 z-10">
          <tr className="bg-muted/80 backdrop-blur text-xs text-muted-foreground border-b border-border">
            <th className="py-2 pl-3 pr-1 text-left font-medium w-8">#</th>
            {cols.map((col) => (
              <th
                key={col.key}
                aria-sort={sortKey === col.key ? (sortAsc ? "ascending" : "descending") : undefined}
                className={`py-2 px-3 font-medium ${col.align === "r" ? "text-right" : "text-left"} ${col.secundaria ? "hidden lg:table-cell" : ""} ${col.key === "nombre" ? "sticky left-0 z-20 bg-muted shadow-[1px_0_0_var(--border)]" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => clickHeader(col.key)}
                  title="Ordenar por esta columna"
                  className="inline-flex items-center gap-1 select-none hover:text-foreground transition-colors rounded focus-visible:outline-2 focus-visible:outline-primary"
                >
                  {col.header}
                  {sortKey === col.key
                    ? (sortAsc ? <ArrowUp size={11} /> : <ArrowDown size={11} />)
                    : <ChevronsUpDown size={11} className="opacity-40" />}
                </button>
              </th>
            ))}
            {cmpPorNombre && comparacion && (
              <>
                <th className="py-2 px-3 font-medium text-right whitespace-nowrap text-violet-700">
                  {comparacion.etiqueta}
                </th>
                <th className="py-2 px-3 font-medium text-right text-violet-700">Δ</th>
              </>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {filas.map((c, i) => {
            const rank = rankPorNombre.get(c.nombre + c.flota);
            return (
              <tr
                key={c.nombre + c.flota}
                onClick={() => onChofer(c)}
                className={`cursor-pointer transition-colors hover:bg-primary/5 ${i % 2 ? "bg-muted/20" : ""}`}
                title={`Ver detalle de ${c.nombre}`}
              >
                <td className="py-1.5 pl-3 pr-1 font-mono text-[11px] text-muted-foreground max-md:py-2.5">
                  {rank != null ? rank + 1 : "—"}
                </td>
                {cols.map((col) => (
                  <td
                    key={col.key}
                    className={`py-1.5 px-3 max-md:py-2.5 ${col.align === "r" ? "text-right font-mono tabular-nums" : "text-left"} ${col.secundaria ? "hidden lg:table-cell" : ""} ${col.key === "nombre" ? `sticky left-0 z-10 shadow-[1px_0_0_var(--border)] ${i % 2 ? "bg-background" : "bg-card"}` : ""}`}
                  >
                    {col.key === "nombre" ? (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onChofer(c); }}
                        title={`Ver detalle de ${c.nombre}`}
                        className="inline-flex max-w-[8.5rem] items-center gap-1.5 font-medium text-foreground rounded focus-visible:outline-2 focus-visible:outline-primary hover:text-primary sm:max-w-none"
                      >
                        {col.principal == null && rank != null && (
                          <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${cuartilDot(rank, conValor)}`} />
                        )}
                        {c.ingresoParcial && <span title="Entró/salió a mitad de mes" className="shrink-0 text-muted-foreground">◐</span>}
                        <span className="truncate">{c.nombre}</span>
                      </button>
                    ) : (
                      col.fmt(c)
                    )}
                  </td>
                ))}
                {cmpPorNombre && (() => {
                  const vCmp = cmpPorNombre.get(c.nombre) ?? (c.choferId ? cmpPorNombre.get(c.choferId) : null) ?? null;
                  const vAct = def.valorChofer(c);
                  const diff = vAct != null && vCmp != null
                    ? def.enPuntos ? vAct - vCmp : vCmp !== 0 ? ((vAct / vCmp) - 1) * 100 : null
                    : null;
                  const mejor = diff != null && (def.mejorMenos ? diff <= 0 : diff >= 0);
                  return (
                    <>
                      <td className="py-1.5 px-3 text-right font-mono tabular-nums text-violet-700">{def.fmt(vCmp)}</td>
                      <td className={`py-1.5 px-3 text-right font-mono tabular-nums text-xs ${diff == null ? "text-muted-foreground/50" : mejor ? "text-emerald-600" : "text-red-500"}`}>
                        {diff == null ? "—" : `${diff >= 0 ? "+" : ""}${diff.toLocaleString("es-AR", { maximumFractionDigits: 1 })}${def.enPuntos ? " pp" : "%"}`}
                      </td>
                    </>
                  );
                })()}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-border bg-muted/60 font-semibold text-foreground">
            <td className="py-2 pl-3 pr-1" />
            {cols.map((col) => (
              <td
                key={col.key}
                className={`py-2 px-3 ${col.align === "r" ? "text-right font-mono tabular-nums" : "text-left"} ${col.secundaria ? "hidden lg:table-cell" : ""} ${col.key === "nombre" ? "sticky left-0 z-10 bg-muted shadow-[1px_0_0_var(--border)]" : ""}`}
              >
                {col.total ? col.total(filas) : ""}
              </td>
            ))}
            {cmpPorNombre && <><td className="py-2 px-3" /><td className="py-2 px-3" /></>}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
