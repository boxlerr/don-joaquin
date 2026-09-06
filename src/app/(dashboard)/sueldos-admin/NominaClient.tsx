"use client";

// Pestaña "Nómina" de Sueldos: lo que se transfirió el mes, abierto por banco.
//
// Está pensada para el momento en que Bárbara paga: primero el reparto por banco
// —cuánto sale de cada cuenta, que es el número con el que entra a cada home
// banking— y después la lista completa por persona para buscar a uno puntual.
//
// Misma forma que la planilla de admin y la de choferes: encabezado fijo, filas
// compactas y el scroll adentro de la caja, así entran las 79 personas sin
// arrastrar toda la página.

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import BancoChip from "@/components/ui/BancoChip";
import type { NominaMesResumen } from "./nomina-tipos";

const pesos = (n: number) => "$" + Math.round(n).toLocaleString("es-AR");

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const mesLabel = (iso: string) => {
  const [y, m] = iso.split("-");
  return `${MESES[parseInt(m, 10) - 1]} ${y}`;
};

const sinAcentos = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const thCls =
  "h-8 px-2 text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap bg-muted border-b border-border";
const tdCls = "py-1 px-2 border-b border-border/50";
const tfCls =
  "px-2 py-1.5 text-right font-mono text-[13px] tabular-nums whitespace-nowrap bg-muted border-t border-border";

export default function NominaClient({ resumen }: { resumen: NominaMesResumen }) {
  const [busca, setBusca] = useState("");
  const buscaRef = useRef<HTMLInputElement>(null);

  // "/" para buscar, como en el resto del sistema (⌘K es la paleta global).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
      buscaRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filtradas = useMemo(() => {
    const q = sinAcentos(busca.trim());
    if (!q) return resumen.personas;
    return resumen.personas.filter(
      (p) =>
        sinAcentos(p.nombre).includes(q) ||
        p.bancos.some((b) => b.banco && sinAcentos(b.banco).includes(q)),
    );
  }, [resumen.personas, busca]);

  if (!resumen.personas.length) {
    return (
      <div className="rounded-[8px] border border-border bg-card px-6 py-16 text-center text-sm text-muted-foreground shadow-sm">
        <p>No hay nómina cargada para {mesLabel(resumen.mes)}.</p>
        <p className="mt-1 text-xs">
          Se carga desde <span className="text-foreground">Importar Excel</span>, con la planilla de
          importes que llega todos los meses.
          {resumen.mesesCargados.length > 0 && (
            <> Hay nómina en: {resumen.mesesCargados.map(mesLabel).join(", ")}.</>
          )}
        </p>
      </div>
    );
  }

  const diferencia =
    resumen.totalExcel != null ? resumen.totalExcel - resumen.total : null;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {/* Lo que hay que transferir, por cuenta. */}
      <div className="shrink-0 rounded-[8px] border border-border bg-card p-3 shadow-sm">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Por banco
          </h3>
          <p className="text-xs text-muted-foreground">
            {resumen.personas.length} personas ·{" "}
            <span className="font-mono font-semibold text-foreground">{pesos(resumen.total)}</span>
            {resumen.totalEmbargos > 0 && (
              <> · embargos <span className="font-mono">{pesos(resumen.totalEmbargos)}</span></>
            )}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {resumen.bancos.map((b) => (
            <div
              key={b.banco ?? "sin-banco"}
              className="rounded-md border border-border bg-muted/30 px-2.5 py-2"
            >
              <div className="flex h-5 items-center">
                {b.banco ? (
                  <BancoChip nombre={b.banco} />
                ) : (
                  <span className="text-xs text-muted-foreground">Sin banco</span>
                )}
              </div>
              <p className="mt-1 font-mono text-[13px] font-semibold tabular-nums text-foreground">
                {pesos(b.total)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {b.personas} {b.personas === 1 ? "persona" : "personas"}
              </p>
            </div>
          ))}
        </div>
        {diferencia != null && Math.abs(diferencia) > 1 && (
          <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400">
            El Excel declaraba {pesos(resumen.totalExcel!)}: quedaron {pesos(Math.abs(diferencia))} sin
            cargar{resumen.observaciones ? ` (${resumen.observaciones})` : ""}.
          </p>
        )}
      </div>

      {/* Buscador + lista por persona. */}
      <div className="flex min-h-0 flex-1 flex-col rounded-[8px] border border-border bg-card shadow-sm">
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
          <Search size={14} className="shrink-0 text-muted-foreground" />
          <input
            ref={buscaRef}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar persona o banco…  (/)"
            className="h-7 min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          {busca && (
            <button
              type="button"
              onClick={() => setBusca("")}
              className="shrink-0 text-muted-foreground hover:text-foreground"
              aria-label="Limpiar la búsqueda"
            >
              <X size={14} />
            </button>
          )}
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {filtradas.length} de {resumen.personas.length}
          </span>
        </div>

        <div className="min-h-[12rem] flex-1 overflow-auto">
          <table className="w-full min-w-[620px] border-separate border-spacing-0 text-sm">
            <thead className="sticky top-0 z-20">
              <tr>
                <th
                  className={`${thCls} sticky left-0 z-30 text-left shadow-[1px_1px_0_0_rgba(0,0,0,0.08)]`}
                >
                  Persona
                </th>
                <th className={`${thCls} text-left`}>Bancos</th>
                <th className={`${thCls} text-right`}>Embargo</th>
                <th className={`${thCls} pr-4 text-right`}>Transferido</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((p) => (
                <tr key={p.chofer_id} className="transition-colors hover:bg-muted/20">
                  <td
                    className={`${tdCls} sticky left-0 z-10 whitespace-nowrap bg-card text-[13px] font-medium text-foreground shadow-[1px_0_0_0_rgba(0,0,0,0.08)]`}
                  >
                    {p.nombre}
                    {p.egresado && (
                      <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                        egresado
                      </span>
                    )}
                  </td>
                  <td className={tdCls}>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      {p.bancos.map((b, i) => (
                        <span key={`${b.banco ?? "s"}-${i}`} className="inline-flex items-center gap-1.5">
                          {b.banco ? (
                            <BancoChip nombre={b.banco} />
                          ) : (
                            <span className="text-xs text-muted-foreground">Sin banco</span>
                          )}
                          {/* El importe por banco sólo se escribe cuando la
                              persona cobra partido: si cobra todo en uno, sería
                              repetir el total de la última columna. */}
                          {p.bancos.length > 1 && (
                            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                              {pesos(b.importe)}
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className={`${tdCls} text-right font-mono text-[13px] tabular-nums`}>
                    {p.embargo > 0 ? (
                      <span className="text-foreground">{pesos(p.embargo)}</span>
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </td>
                  <td
                    className={`${tdCls} pr-4 text-right font-mono text-[13px] font-semibold tabular-nums text-foreground`}
                  >
                    {pesos(p.total)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 z-20">
              <tr>
                <td
                  className={`${tfCls} sticky left-0 z-30 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground`}
                >
                  Total
                </td>
                <td className={tfCls} />
                <td className={tfCls}>
                  {resumen.totalEmbargos > 0 ? pesos(resumen.totalEmbargos) : "—"}
                </td>
                <td className={`${tfCls} pr-4 font-semibold text-foreground`}>
                  {pesos(filtradas.reduce((s, p) => s + p.total, 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
