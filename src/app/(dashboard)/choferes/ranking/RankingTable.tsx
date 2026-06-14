"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  GitCompare,
  X,
  Search,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  Users,
  Award,
  DollarSign,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import type { RankingChofer } from "./lib";
import ScoreBadge from "./ScoreBadge";
import ScoreInfoButton from "./ScoreInfoButton";
import { choferSlug } from "@/lib/chofer-slug";

interface Props {
  ranking: RankingChofer[];
  periodoQuery: string;
}

// Columnas por las que se puede ordenar la tabla.
type SortKey =
  | "score"
  | "viajes_count"
  | "km_total"
  | "facturacion_total"
  | "pesos_por_km"
  | "pct_vacios"
  | "apercibimientos_count"
  | "roturas_count"
  | "taller_count";

function fmtNum(n: number) {
  return n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

// Monto compacto para celdas estrechas: $1,2M / $850k / $320.
function fmtMoneda(n: number) {
  if (n <= 0) return "—";
  if (n >= 1_000_000)
    return `$${(n / 1_000_000).toLocaleString("es-AR", { maximumFractionDigits: 1 })}M`;
  if (n >= 1_000)
    return `$${(n / 1_000).toLocaleString("es-AR", { maximumFractionDigits: 0 })}k`;
  return `$${n.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
}

function initials(nombre: string, apellido: string) {
  return `${apellido[0] ?? ""}${nombre[0] ?? ""}`.toUpperCase();
}

function avatarColors(score: number | null) {
  if (score === null) return { bg: "bg-muted", text: "text-muted-foreground" };
  if (score >= 80) return { bg: "bg-[#ECFDF5]", text: "text-[#064E3B]" };
  if (score >= 60) return { bg: "bg-[#FFFBEB]", text: "text-[#78350F]" };
  return { bg: "bg-[#FEF2F2]", text: "text-[#7F1D1D]" };
}

function rowBorderColor(score: number | null) {
  if (score === null) return "border-l-transparent";
  if (score >= 80) return "border-l-[#10B981]";
  if (score >= 60) return "border-l-[#F59E0B]";
  return "border-l-[#EF4444]";
}

function ScoreBar({ score }: { score: number | null }) {
  if (score === null) return <ScoreBadge score={null} />;
  const color = score >= 80 ? "#10B981" : score >= 60 ? "#F59E0B" : "#EF4444";
  return (
    <div className="flex items-center gap-2.5 w-full max-w-[140px]">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${score}%`, backgroundColor: color }}
        />
      </div>
      <span
        className="text-sm font-bold tabular-nums w-7 text-right"
        style={{ color }}
      >
        {score}
      </span>
    </div>
  );
}

function Medalla({ pos }: { pos: number }) {
  if (pos === 1) return <span className="text-base leading-none">🥇</span>;
  if (pos === 2) return <span className="text-base leading-none">🥈</span>;
  if (pos === 3) return <span className="text-base leading-none">🥉</span>;
  return (
    <span className="text-xs text-muted-foreground tabular-nums font-medium w-5 text-center inline-block">
      {pos}
    </span>
  );
}

function PctBadge({ pct, viajes }: { pct: number; viajes: number }) {
  if (viajes === 0)
    return <span className="text-muted-foreground/40 text-sm">—</span>;
  const color =
    pct > 40
      ? "text-[#EF4444]"
      : pct > 25
        ? "text-[#F59E0B]"
        : "text-[#10B981]";
  return (
    <span className={`text-sm font-medium tabular-nums ${color}`}>
      {pct.toFixed(0)}%
    </span>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <div className="bg-card border border-border rounded-[8px] px-5 py-4 flex items-center gap-4">
      <div
        className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${color}`}
      >
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          {label}
        </p>
        <p className="text-2xl font-bold text-foreground leading-tight">{value}</p>
        {sub && (
          <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
        )}
      </div>
    </div>
  );
}

function SortableTh({
  label,
  col,
  sortKey,
  sortDir,
  onSort,
  align = "right",
  className = "",
}: {
  label: string;
  col: SortKey;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (k: SortKey) => void;
  align?: "left" | "right" | "center";
  className?: string;
}) {
  const active = sortKey === col;
  const alignTh =
    align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  return (
    <th className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-wider ${alignTh} ${className}`}>
      <button
        type="button"
        onClick={() => onSort(col)}
        title="Ordenar por esta columna"
        className={`inline-flex items-center gap-1 uppercase tracking-wider transition-colors ${
          active ? "text-primary" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <span>{label}</span>
        {active && (sortDir === "desc" ? <ArrowDown size={11} /> : <ArrowUp size={11} />)}
      </button>
    </th>
  );
}

export default function RankingTable({ ranking, periodoQuery }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [sinActividadOpen, setSinActividadOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const conActividad = useMemo(
    () => ranking.filter((r) => r.score !== null),
    [ranking]
  );
  const sinActividad = useMemo(
    () => ranking.filter((r) => r.score === null),
    [ranking]
  );

  const avgScore = useMemo(() => {
    if (conActividad.length === 0) return null;
    const sum = conActividad.reduce((a, r) => a + (r.score ?? 0), 0);
    return Math.round(sum / conActividad.length);
  }, [conActividad]);

  // topChofer = mejor score, independiente del orden visible elegido.
  const topChofer = conActividad[0] ?? null;

  const facturacionTotal = useMemo(
    () => conActividad.reduce((a, r) => a + r.facturacion_total, 0),
    [conActividad]
  );

  const sortedActivos = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...conActividad].sort((a, b) => {
      const va = a[sortKey] ?? 0;
      const vb = b[sortKey] ?? 0;
      if (va === vb) return (b.score ?? 0) - (a.score ?? 0); // desempate por score
      return va < vb ? -dir : dir;
    });
  }, [conActividad, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc"); // primer click: mayor arriba
    }
  };

  // Las medallas solo tienen sentido con el orden por score descendente.
  const mostrarMedallas = sortKey === "score" && sortDir === "desc";

  const filteredActivos = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sortedActivos;
    return sortedActivos.filter(
      (r) =>
        r.nombre.toLowerCase().includes(q) ||
        r.apellido.toLowerCase().includes(q) ||
        (r.localidad ?? "").toLowerCase().includes(q)
    );
  }, [sortedActivos, query]);

  const filteredSinActividad = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sinActividad;
    return sinActividad.filter(
      (r) =>
        r.nombre.toLowerCase().includes(q) ||
        r.apellido.toLowerCase().includes(q) ||
        (r.localidad ?? "").toLowerCase().includes(q)
    );
  }, [sinActividad, query]);

  const toggleSelected = (id: string) => {
    setSelected((curr) => {
      if (curr.includes(id)) return curr.filter((x) => x !== id);
      if (curr.length >= 2) return [curr[1], id];
      return [...curr, id];
    });
  };

  const comparar = () => {
    if (selected.length !== 2) return;
    const params = new URLSearchParams(periodoQuery);
    params.set("a", selected[0]);
    params.set("b", selected[1]);
    router.push(`/choferes/comparar?${params.toString()}`);
  };

  const choferesSeleccionados = selected
    .map((id) => ranking.find((r) => r.id === id))
    .filter((r): r is RankingChofer => Boolean(r));

  const noData = conActividad.length === 0;

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={Users}
          label="Con actividad"
          value={String(conActividad.length)}
          sub={`de ${ranking.length} choferes en planilla`}
          color="bg-[#E1F5FE] text-primary"
        />
        <StatCard
          icon={DollarSign}
          label="Facturación período"
          value={fmtMoneda(facturacionTotal)}
          sub={facturacionTotal > 0 ? "Suma de fletes (ARS)" : "Sin fletes cargados"}
          color="bg-[#ECFDF5] text-[#064E3B]"
        />
        <StatCard
          icon={TrendingUp}
          label="Score promedio"
          value={avgScore !== null ? String(avgScore) : "—"}
          sub={avgScore !== null ? (avgScore >= 80 ? "Rendimiento bueno" : avgScore >= 60 ? "Rendimiento regular" : "Rendimiento bajo") : "Sin datos en el período"}
          color={
            avgScore === null
              ? "bg-muted text-muted-foreground"
              : avgScore >= 80
                ? "bg-[#ECFDF5] text-[#064E3B]"
                : avgScore >= 60
                  ? "bg-[#FFFBEB] text-[#78350F]"
                  : "bg-[#FEF2F2] text-[#7F1D1D]"
          }
        />
        <StatCard
          icon={Award}
          label="Mejor score"
          value={topChofer ? String(topChofer.score) : "—"}
          sub={topChofer ? `${topChofer.apellido}, ${topChofer.nombre}` : "Sin datos en el período"}
          color={
            topChofer
              ? "bg-[#ECFDF5] text-[#064E3B]"
              : "bg-muted text-muted-foreground"
          }
        />
      </div>

      {/* Tabla principal */}
      <div className="bg-card rounded-[8px] border border-border shadow-sm overflow-hidden">
        {/* Header de la tabla */}
        <div className="px-5 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {conActividad.length} choferes con actividad
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xs text-muted-foreground">
                Score por conducta (km vacíos, apercibimientos, roturas, taller). Facturación y $/km miden productividad. Tocá una columna para ordenar · Tildá 2 para comparar
              </p>
              <ScoreInfoButton />
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Leyenda */}
            <div className="hidden lg:flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#10B981] inline-block" />
                ≥ 80
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#F59E0B] inline-block" />
                60–79
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#EF4444] inline-block" />
                &lt; 60
              </span>
            </div>
            {/* Búsqueda */}
            <div className="relative">
              <Search
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 pointer-events-none"
              />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar chofer..."
                className="pl-8 pr-3 h-8 w-44 rounded-lg border border-border bg-muted/40 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
          </div>
        </div>

        {noData && !query ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <div className="w-12 h-12 rounded-full bg-muted/60 flex items-center justify-center mb-3">
              <TrendingUp size={20} className="text-muted-foreground/50" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              Sin viajes en este período
            </p>
            <p className="text-xs text-muted-foreground max-w-xs">
              El ranking se calcula automáticamente cuando se carguen hojas de ruta para este período.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="w-10 px-3 py-3" />
                <th className="w-10 px-2 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  #
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Chofer
                </th>
                <SortableTh label="Score" col="score" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="left" className="min-w-[160px]" />
                <SortableTh label="Viajes" col="viajes_count" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="KM totales" col="km_total" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="Facturación" col="facturacion_total" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="$ / km" col="pesos_por_km" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="% Vacíos" col="pct_vacios" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="center" />
                <SortableTh label="Apercib." col="apercibimientos_count" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="center" />
                <SortableTh label="Roturas" col="roturas_count" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="center" />
                <SortableTh label="Taller" col="taller_count" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="center" className="pr-5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredActivos.map((r) => {
                const pos = sortedActivos.indexOf(r) + 1;
                const isSelected = selected.includes(r.id);
                const av = avatarColors(r.score);
                const borderColor = rowBorderColor(r.score);
                return (
                  <tr
                    key={r.id}
                    onClick={() => router.push(`/choferes/${choferSlug(r)}?tab=productividad`)}
                    className={`group cursor-pointer transition-colors border-l-[3px] ${borderColor} ${
                      isSelected
                        ? "bg-primary/5 hover:bg-primary/8"
                        : "hover:bg-muted/40"
                    }`}
                  >
                    {/* Checkbox */}
                    <td
                      className="px-3 py-3.5 text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelected(r.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                        aria-label={`Seleccionar ${r.apellido} para comparar`}
                      />
                    </td>
                    {/* Posición */}
                    <td className="px-2 py-3.5 text-center">
                      {mostrarMedallas ? (
                        <Medalla pos={pos} />
                      ) : (
                        <span className="text-xs text-muted-foreground tabular-nums font-medium w-5 text-center inline-block">
                          {pos}
                        </span>
                      )}
                    </td>
                    {/* Nombre + avatar */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${av.bg} ${av.text}`}
                        >
                          {initials(r.nombre, r.apellido)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground leading-tight truncate group-hover:text-primary transition-colors">
                            {r.apellido}, {r.nombre}
                          </p>
                          {r.localidad && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              {r.localidad}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    {/* Score bar */}
                    <td className="px-4 py-3.5">
                      <ScoreBar score={r.score} />
                    </td>
                    {/* Viajes */}
                    <td className="px-4 py-3.5 text-right tabular-nums text-muted-foreground">
                      {r.viajes_count > 0 ? (
                        <span className="font-medium text-foreground">{r.viajes_count}</span>
                      ) : (
                        <span className="text-muted-foreground/40">0</span>
                      )}
                    </td>
                    {/* KM */}
                    <td className="px-4 py-3.5 text-right tabular-nums text-muted-foreground">
                      {r.km_total > 0 ? fmtNum(r.km_total) : <span className="text-muted-foreground/40">—</span>}
                    </td>
                    {/* Facturación */}
                    <td className="px-4 py-3.5 text-right tabular-nums">
                      {r.facturacion_total > 0 ? (
                        <span className="font-semibold text-foreground">{fmtMoneda(r.facturacion_total)}</span>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </td>
                    {/* $/km */}
                    <td className="px-4 py-3.5 text-right tabular-nums text-muted-foreground">
                      {r.pesos_por_km != null ? (
                        `$${fmtNum(r.pesos_por_km)}`
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </td>
                    {/* % Vacíos */}
                    <td className="px-4 py-3.5 text-center">
                      <PctBadge pct={r.pct_vacios} viajes={r.viajes_count} />
                    </td>
                    {/* Apercibimientos */}
                    <td className="px-4 py-3.5 text-center">
                      {r.apercibimientos_count > 0 ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-[#F59E0B]">
                          {r.apercibimientos_count}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </td>
                    {/* Roturas */}
                    <td className="px-4 py-3.5 text-center">
                      {r.roturas_count > 0 ? (
                        <span className="text-[#EF4444] font-semibold">
                          {r.roturas_count}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </td>
                    {/* Visitas al taller */}
                    <td className="px-4 py-3.5 text-center pr-5">
                      {r.taller_count > 0 ? (
                        <span className="text-[#F59E0B] font-semibold">
                          {r.taller_count}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {/* Sin resultados de búsqueda */}
              {filteredActivos.length === 0 && filteredSinActividad.length === 0 && query && (
                <tr>
                  <td colSpan={12} className="px-6 py-10 text-center">
                    <p className="text-sm text-muted-foreground">
                      Sin coincidencias para &ldquo;{query}&rdquo;
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {/* Sección sin actividad — colapsable */}
        {(sinActividad.length > 0) && (
          <div className="border-t border-border">
            <button
              type="button"
              onClick={() => setSinActividadOpen((v) => !v)}
              className="w-full flex items-center justify-between px-5 py-3 text-xs text-muted-foreground hover:bg-muted/30 transition-colors"
            >
              <span className="flex items-center gap-2">
                {sinActividadOpen ? (
                  <ChevronDown size={13} />
                ) : (
                  <ChevronRight size={13} />
                )}
                <span className="font-medium">
                  {filteredSinActividad.length > 0 || !query
                    ? `${sinActividad.length} choferes sin viajes en el período`
                    : `${sinActividad.length} choferes sin actividad (ocultos por el filtro)`}
                </span>
              </span>
              <span className="text-[11px] text-muted-foreground/60">
                {sinActividadOpen ? "ocultar" : "mostrar"}
              </span>
            </button>

            {sinActividadOpen && (
              <div className="px-5 pb-4 pt-1">
                <div className="flex flex-wrap gap-2">
                  {filteredSinActividad.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => router.push(`/choferes/${choferSlug(r)}`)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/60 hover:bg-muted text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <span className="w-5 h-5 rounded-full bg-muted-foreground/10 flex items-center justify-center text-[10px] font-semibold">
                        {initials(r.nombre, r.apellido)}
                      </span>
                      {r.apellido}, {r.nombre}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating compare bar */}
      {selected.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-card border border-border rounded-full shadow-lg px-4 py-2 flex items-center gap-3">
          <GitCompare size={16} className="text-primary shrink-0" />
          <span className="text-sm text-foreground whitespace-nowrap">
            {selected.length === 1 ? (
              <>
                <strong>{choferesSeleccionados[0]?.apellido}</strong>
                <span className="text-muted-foreground"> · elegí otro para comparar</span>
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
            onClick={() => setSelected([])}
            className="text-muted-foreground hover:text-foreground p-1 rounded transition-colors"
            aria-label="Limpiar selección"
          >
            <X size={14} />
          </button>
          <button
            type="button"
            onClick={comparar}
            disabled={selected.length !== 2}
            className="inline-flex items-center gap-1.5 h-8 px-4 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Comparar
          </button>
        </div>
      )}
    </>
  );
}
