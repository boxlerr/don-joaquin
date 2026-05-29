"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, GitCompare, X } from "lucide-react";
import type { RankingChofer } from "./lib";
import ScoreBadge from "./ScoreBadge";
import ScoreInfoButton from "./ScoreInfoButton";

interface Props {
  ranking: RankingChofer[];
  periodoQuery: string;
}

function fmtNum(n: number) {
  return n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

function PctBadge({ pct, viajes }: { pct: number; viajes: number }) {
  if (viajes === 0) return <span className="text-muted-foreground text-sm">—</span>;
  const color =
    pct > 40
      ? "text-[#EF4444]"
      : pct > 25
        ? "text-[#F59E0B]"
        : "text-[#10B981]";
  return <span className={`text-sm font-medium ${color}`}>{pct.toFixed(0)}%</span>;
}

function Medalla({ pos }: { pos: number }) {
  if (pos === 1) return <span className="text-base">🥇</span>;
  if (pos === 2) return <span className="text-base">🥈</span>;
  if (pos === 3) return <span className="text-base">🥉</span>;
  return (
    <span className="text-sm text-muted-foreground w-5 text-center inline-block">
      {pos}
    </span>
  );
}

export default function RankingTable({ ranking, periodoQuery }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);

  const toggleSelected = (id: string) => {
    setSelected((curr) => {
      if (curr.includes(id)) return curr.filter((x) => x !== id);
      if (curr.length >= 2) return [curr[1], id]; // FIFO: descarta el más viejo
      return [...curr, id];
    });
  };

  const limpiar = () => setSelected([]);

  const comparar = () => {
    if (selected.length !== 2) return;
    const params = new URLSearchParams(periodoQuery);
    params.set("a", selected[0]);
    params.set("b", selected[1]);
    router.push(`/choferes/comparar?${params.toString()}`);
  };

  const conActividad = ranking.filter((r) => r.score !== null);
  const sinActividad = ranking.filter((r) => r.score === null);

  const choferesSeleccionados = selected
    .map((id) => ranking.find((r) => r.id === id))
    .filter((r): r is RankingChofer => Boolean(r));

  return (
    <>
      <div className="bg-card rounded-[8px] border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">
              {conActividad.length} choferes con actividad
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xs text-muted-foreground">
                Score calculado en base a km vacíos, apercibimientos y roturas del período · Tildá 2 para comparar
              </p>
              <ScoreInfoButton />
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#10B981] inline-block" />
              ≥ 80 Bueno
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#F59E0B] inline-block" />
              60–79 Regular
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#EF4444] inline-block" />
              &lt; 60 Bajo
            </span>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-4 py-3 w-10"></th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground w-12">#</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Chofer</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">Score</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Viajes</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">KM totales</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">% Vacíos</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">Apercib.</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">Roturas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {ranking.map((r) => {
              const pos = r.score !== null ? conActividad.indexOf(r) + 1 : null;
              const isSelected = selected.includes(r.id);
              return (
                <tr
                  key={r.id}
                  onClick={() =>
                    router.push(`/choferes/${r.id}?tab=productividad`)
                  }
                  className={`hover:bg-muted/30 cursor-pointer transition-colors ${
                    isSelected ? "bg-primary/5" : ""
                  }`}
                >
                  <td
                    className="px-4 py-3.5 text-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelected(r.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                      aria-label={`Seleccionar ${r.apellido}, ${r.nombre} para comparar`}
                    />
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    {pos !== null ? (
                      <Medalla pos={pos} />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="font-medium text-foreground leading-tight">
                      {r.apellido}, {r.nombre}
                    </p>
                    {r.localidad && (
                      <p className="text-xs text-muted-foreground mt-0.5">{r.localidad}</p>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <ScoreBadge score={r.score} />
                  </td>
                  <td className="px-4 py-3.5 text-right text-muted-foreground">
                    {r.viajes_count > 0 ? r.viajes_count : <span className="text-muted-foreground/50">0</span>}
                  </td>
                  <td className="px-4 py-3.5 text-right text-muted-foreground">
                    {r.km_total > 0 ? fmtNum(r.km_total) : <span className="text-muted-foreground/50">—</span>}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <PctBadge pct={r.pct_vacios} viajes={r.viajes_count} />
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    {r.apercibimientos_total > 0 ? (
                      <span
                        className={`inline-flex items-center gap-1 font-medium ${
                          r.apercibimientos_graves > 0
                            ? "text-[#EF4444]"
                            : "text-[#F59E0B]"
                        }`}
                      >
                        {r.apercibimientos_graves > 0 && <AlertTriangle size={12} />}
                        {r.apercibimientos_total}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    {r.roturas_count > 0 ? (
                      <span className="text-[#EF4444] font-medium">{r.roturas_count}</span>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>
                </tr>
              );
            })}

            {ranking.length === 0 && (
              <tr>
                <td colSpan={9} className="px-6 py-12 text-center text-muted-foreground text-sm">
                  No hay choferes activos registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {sinActividad.length > 0 && (
          <div className="px-6 py-3 border-t border-border bg-muted/20">
            <p className="text-xs text-muted-foreground">
              {sinActividad.length} choferes sin viajes en el período:{" "}
              {sinActividad.map((r) => `${r.apellido}, ${r.nombre}`).join(" · ")}
            </p>
          </div>
        )}
      </div>

      {selected.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-card border border-border rounded-full shadow-lg px-4 py-2 flex items-center gap-3">
          <GitCompare size={16} className="text-primary" />
          <span className="text-sm text-foreground">
            {selected.length === 1 ? (
              <>
                <strong>{choferesSeleccionados[0]?.apellido}</strong> seleccionado · elegí otro
              </>
            ) : (
              <>
                <strong>{choferesSeleccionados[0]?.apellido}</strong>
                <span className="text-muted-foreground"> vs </span>
                <strong>{choferesSeleccionados[1]?.apellido}</strong>
              </>
            )}
          </span>
          <button
            type="button"
            onClick={limpiar}
            className="text-muted-foreground hover:text-foreground p-1 rounded transition-colors"
            aria-label="Limpiar selección"
          >
            <X size={14} />
          </button>
          <button
            type="button"
            onClick={comparar}
            disabled={selected.length !== 2}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Comparar
          </button>
        </div>
      )}
    </>
  );
}
