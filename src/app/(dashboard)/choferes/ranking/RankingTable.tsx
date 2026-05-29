"use client";

import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import type { RankingChofer } from "./lib";
import ScoreBadge from "./ScoreBadge";

interface Props {
  ranking: RankingChofer[];
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

export default function RankingTable({ ranking }: Props) {
  const router = useRouter();

  const conActividad = ranking.filter((r) => r.score !== null);
  const sinActividad = ranking.filter((r) => r.score === null);

  return (
    <div className="bg-card rounded-[8px] border border-border shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">
            {conActividad.length} choferes con actividad
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Score calculado en base a km vacíos, apercibimientos y roturas del período
          </p>
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
            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground w-12">#</th>
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
          {ranking.map((r, idx) => {
            const pos = r.score !== null ? conActividad.indexOf(r) + 1 : null;
            return (
              <tr
                key={r.id}
                onClick={() =>
                  router.push(`/choferes/${r.id}?tab=productividad`)
                }
                className="hover:bg-muted/30 cursor-pointer transition-colors"
              >
                <td className="px-6 py-3.5 text-center">
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
              <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground text-sm">
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
  );
}
