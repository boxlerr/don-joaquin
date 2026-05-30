import Link from "next/link";
import { ArrowLeft, Trophy, MapPin } from "lucide-react";
import { requireArea } from "@/lib/auth";
import PageHeader from "@/components/layout/PageHeader";
import {
  computeRanking,
  resolverRango,
  type RankingChofer,
} from "../ranking/lib";
import ChoferSwap from "./ChoferSwap";
import { choferSlug } from "@/lib/chofer-slug";

export const dynamic = "force-dynamic";

// ─── helpers ────────────────────────────────────────────────────────────────

function fmtNum(n: number) {
  return n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

function initials(nombre: string, apellido: string) {
  return `${apellido[0] ?? ""}${nombre[0] ?? ""}`.toUpperCase();
}

function scoreColors(score: number | null) {
  if (score === null)
    return { bg: "bg-muted", text: "text-muted-foreground", bar: "#94a3b8" };
  if (score >= 80) return { bg: "bg-[#ECFDF5]", text: "text-[#064E3B]", bar: "#10B981" };
  if (score >= 60) return { bg: "bg-[#FFFBEB]", text: "text-[#78350F]", bar: "#F59E0B" };
  return { bg: "bg-[#FEF2F2]", text: "text-[#7F1D1D]", bar: "#EF4444" };
}

// ─── tipos ──────────────────────────────────────────────────────────────────

type Direccion = "higher_better" | "lower_better" | "neutral";

interface Metric {
  label: string;
  a: number;
  b: number;
  format: (n: number) => string;
  direction: Direccion;
  suffix?: string;
  group?: boolean; // encabezado de grupo
  indent?: boolean;
}

// ─── componentes ────────────────────────────────────────────────────────────

function ScoreBar({ score, color }: { score: number | null; color: string }) {
  if (score === null) return null;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${score}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-bold tabular-nums" style={{ color }}>
        {score}/100
      </span>
    </div>
  );
}

function DeltaChip({
  a,
  b,
  direction,
  format,
  suffix = "",
}: {
  a: number;
  b: number;
  direction: Direccion;
  format: (n: number) => string;
  suffix?: string;
}) {
  const diff = a - b;
  if (diff === 0 || direction === "neutral") {
    return (
      <span className="inline-flex items-center justify-center w-8 h-6 rounded text-[11px] font-semibold bg-muted text-muted-foreground/70">
        =
      </span>
    );
  }
  const aGana = direction === "higher_better" ? diff > 0 : diff < 0;
  const cls = aGana
    ? "bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]"
    : "bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA]";
  const flecha = diff > 0 ? "↑" : "↓";
  return (
    <span
      className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[11px] font-bold ${cls}`}
    >
      {flecha} {format(Math.abs(diff))}
      {suffix}
    </span>
  );
}

function MetricRow({
  m,
  isFirstInGroup,
}: {
  m: Metric;
  isFirstInGroup?: boolean;
}) {
  const diff = m.a - m.b;
  const aWins =
    diff !== 0 &&
    m.direction !== "neutral" &&
    (m.direction === "higher_better" ? diff > 0 : diff < 0);
  const bWins =
    diff !== 0 &&
    m.direction !== "neutral" &&
    (m.direction === "higher_better" ? diff < 0 : diff > 0);

  const aClass = aWins
    ? "text-[#065F46] font-bold"
    : bWins
      ? "text-muted-foreground/60"
      : "text-foreground font-medium";
  const bClass = bWins
    ? "text-[#065F46] font-bold"
    : aWins
      ? "text-muted-foreground/60"
      : "text-foreground font-medium";

  return (
    <tr
      className={`border-b border-border last:border-b-0 ${
        isFirstInGroup ? "border-t-2 border-t-border/60" : ""
      }`}
    >
      <td
        className={`px-5 py-3 text-sm ${
          m.indent
            ? "pl-10 text-xs text-muted-foreground/80"
            : "font-medium text-foreground"
        }`}
      >
        {m.label}
      </td>
      <td className={`px-5 py-3 text-right tabular-nums text-sm ${aClass}`}>
        {aWins && <span className="mr-1 text-[#10B981]">✓</span>}
        {m.format(m.a)}
        {m.suffix}
      </td>
      <td className="px-3 py-3 text-center">
        <DeltaChip
          a={m.a}
          b={m.b}
          direction={m.direction}
          format={m.format}
          suffix={m.suffix}
        />
      </td>
      <td className={`px-5 py-3 text-left tabular-nums text-sm ${bClass}`}>
        {m.format(m.b)}
        {m.suffix}
        {bWins && <span className="ml-1 text-[#10B981]">✓</span>}
      </td>
    </tr>
  );
}

function buildMetrics(a: RankingChofer, b: RankingChofer): Metric[] {
  const fInt = (n: number) => fmtNum(n);
  const fPct = (n: number) => n.toFixed(0);
  return [
    { label: "Score operativo", a: a.score ?? 0, b: b.score ?? 0, format: fInt, direction: "higher_better" },
    { label: "Rendimiento", a: a.viajes_count, b: b.viajes_count, format: fInt, direction: "higher_better", group: true },
    { label: "Viajes", a: a.viajes_count, b: b.viajes_count, format: fInt, direction: "higher_better", indent: true },
    { label: "KM totales", a: a.km_total, b: b.km_total, format: fInt, direction: "higher_better", indent: true },
    { label: "KM con carga", a: a.km_con_carga, b: b.km_con_carga, format: fInt, direction: "higher_better", indent: true },
    { label: "KM vacíos", a: a.km_vacios, b: b.km_vacios, format: fInt, direction: "lower_better", indent: true },
    { label: "% vacíos", a: a.pct_vacios, b: b.pct_vacios, format: fPct, direction: "lower_better", suffix: "%" },
    { label: "Disciplina", a: 0, b: 0, format: fInt, direction: "neutral", group: true },
    { label: "Apercibimientos", a: a.apercibimientos_count, b: b.apercibimientos_count, format: fInt, direction: "lower_better", indent: true },
    { label: "Incidencias", a: 0, b: 0, format: fInt, direction: "neutral", group: true },
    { label: "Roturas de gomas", a: a.roturas_count, b: b.roturas_count, format: fInt, direction: "lower_better", indent: true },
    { label: "Licencias médicas activas", a: a.licencias_activas, b: b.licencias_activas, format: fInt, direction: "lower_better", indent: true },
  ];
}

// Calcula quién ganó cuántas métricas (excluye grupos y empates)
function calcWinner(metrics: Metric[], a: RankingChofer, b: RankingChofer) {
  let aWins = 0, bWins = 0;
  for (const m of metrics) {
    if (m.group || m.direction === "neutral") continue;
    const diff = m.a - m.b;
    if (diff === 0) continue;
    if (m.direction === "higher_better") diff > 0 ? aWins++ : bWins++;
    else diff < 0 ? aWins++ : bWins++;
  }
  const total = aWins + bWins;
  return { aWins, bWins, total };
}

// ─── ChoferCard ─────────────────────────────────────────────────────────────

function ChoferCard({
  chofer,
  side,
  choferesList,
  otherId,
  periodoQuery,
  isWinner,
}: {
  chofer: RankingChofer | null;
  side: "a" | "b";
  choferesList: Array<{ id: string; nombre: string; apellido: string }>;
  otherId: string;
  periodoQuery: string;
  isWinner: boolean;
}) {
  const sc = scoreColors(chofer?.score ?? null);
  const label = side === "a" ? "Chofer A" : "Chofer B";

  return (
    <div
      className={`bg-card rounded-[8px] border shadow-sm overflow-hidden ${
        isWinner ? "border-[#10B981]" : "border-border"
      }`}
    >
      {/* selector */}
      <div className="px-4 pt-4 pb-3 border-b border-border bg-muted/30">
        <p className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground mb-2">
          {label}
        </p>
        <ChoferSwap
          side={side}
          choferes={choferesList}
          selectedId={chofer?.id ?? ""}
          otherId={otherId}
          periodoQuery={periodoQuery}
        />
      </div>

      {/* datos */}
      {chofer ? (
        <div className="px-4 py-4 space-y-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center text-base font-bold shrink-0 ${sc.bg} ${sc.text}`}
            >
              {initials(chofer.nombre, chofer.apellido)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-base font-bold text-foreground leading-tight">
                  {chofer.apellido}, {chofer.nombre}
                </p>
                {isWinner && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#ECFDF5] text-[#065F46] text-[10px] font-bold border border-[#A7F3D0]">
                    <Trophy size={10} /> Ganador
                  </span>
                )}
              </div>
              {chofer.localidad && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <MapPin size={11} /> {chofer.localidad}
                </p>
              )}
            </div>
          </div>

          {/* score bar */}
          <ScoreBar score={chofer.score} color={sc.bar} />

          {/* mini stats */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            {[
              { label: "Viajes", value: String(chofer.viajes_count) },
              { label: "KM totales", value: fmtNum(chofer.km_total) },
              { label: "% Vacíos", value: chofer.viajes_count > 0 ? `${chofer.pct_vacios.toFixed(0)}%` : "—" },
            ].map(({ label, value }) => (
              <div key={label} className="bg-muted/40 rounded-md px-2 py-1.5 text-center">
                <p className="text-[10px] text-muted-foreground/70 font-medium uppercase tracking-wide">{label}</p>
                <p className="text-sm font-bold text-foreground">{value}</p>
              </div>
            ))}
          </div>

          <Link
            href={`/choferes/${choferSlug(chofer)}?tab=productividad`}
            className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
          >
            Ver legajo completo →
          </Link>
        </div>
      ) : (
        <div className="px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            Elegí un chofer del selector de arriba.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── page ────────────────────────────────────────────────────────────────────

export default async function CompararChoferes({
  searchParams,
}: {
  searchParams: Promise<{
    a?: string;
    b?: string;
    rango?: string;
    desde?: string;
    hasta?: string;
  }>;
}) {
  await requireArea("logistica", "read");

  const params = await searchParams;
  const periodo = resolverRango(params);

  const ranking = await computeRanking({ desde: periodo.desde, hasta: periodo.hasta });
  const choferesList = ranking.map(({ id, nombre, apellido }) => ({ id, nombre, apellido }));

  const aId = params.a ?? "";
  const bId = params.b ?? "";
  const choferA = ranking.find((r) => r.id === aId) ?? null;
  const choferB = ranking.find((r) => r.id === bId) ?? null;

  const periodoUrl = new URLSearchParams();
  periodoUrl.set("rango", periodo.rango);
  if (periodo.rango === "custom") {
    periodoUrl.set("desde", periodo.desde);
    periodoUrl.set("hasta", periodo.hasta);
  }
  const periodoQuery = periodoUrl.toString();
  const backHref = `/choferes/ranking?${periodoQuery}`;

  const metrics = choferA && choferB ? buildMetrics(choferA, choferB) : null;
  const winner = metrics && choferA && choferB ? calcWinner(metrics, choferA, choferB) : null;

  const aIsWinner = !!winner && winner.aWins > winner.bWins;
  const bIsWinner = !!winner && winner.bWins > winner.aWins;

  return (
    <div className="p-8 space-y-4 max-w-[1200px]">
      <PageHeader
        title="Comparador de Choferes"
        description={`Período: ${periodo.label}`}
        action={
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-background text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <ArrowLeft size={14} />
            Volver al ranking
          </Link>
        }
      />

      {/* Cards de los dos choferes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChoferCard
          chofer={choferA}
          side="a"
          choferesList={choferesList}
          otherId={bId}
          periodoQuery={periodoQuery}
          isWinner={aIsWinner}
        />
        <ChoferCard
          chofer={choferB}
          side="b"
          choferesList={choferesList}
          otherId={aId}
          periodoQuery={periodoQuery}
          isWinner={bIsWinner}
        />
      </div>

      {/* Banner resumen ganador */}
      {winner && choferA && choferB && (
        <div
          className={`rounded-[8px] border px-5 py-3 flex items-center justify-between ${
            winner.aWins === winner.bWins
              ? "bg-muted/30 border-border"
              : "bg-[#ECFDF5] border-[#A7F3D0]"
          }`}
        >
          <div className="flex items-center gap-2">
            {winner.aWins === winner.bWins ? (
              <p className="text-sm font-medium text-foreground">
                Empate — {winner.aWins} métricas cada uno
              </p>
            ) : (
              <>
                <Trophy size={16} className="text-[#10B981] shrink-0" />
                <p className="text-sm font-semibold text-[#065F46]">
                  {winner.aWins > winner.bWins
                    ? `${choferA.apellido} gana`
                    : `${choferB.apellido} gana`}{" "}
                  <span className="font-bold">
                    {Math.max(winner.aWins, winner.bWins)} de {winner.total}
                  </span>{" "}
                  métricas del período
                </p>
              </>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{winner.aWins}</span>
            <span>vs</span>
            <span className="font-semibold text-foreground">{winner.bWins}</span>
          </div>
        </div>
      )}

      {/* Tabla de métricas */}
      {metrics ? (
        <div className="bg-card rounded-[8px] border border-border shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Métrica
                </th>
                <th className="px-5 py-3 text-right text-[11px] font-semibold text-muted-foreground uppercase tracking-wider w-36">
                  {choferA?.apellido ?? "Chofer A"}
                </th>
                <th className="px-3 py-3 text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wider w-24">
                  Δ
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider w-36">
                  {choferB?.apellido ?? "Chofer B"}
                </th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((m, i) =>
                m.group ? (
                  <tr key={m.label} className={`bg-muted/20 ${i > 0 ? "border-t border-border" : ""}`}>
                    <td
                      colSpan={4}
                      className="px-5 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70"
                    >
                      {m.label}
                    </td>
                  </tr>
                ) : (
                  <MetricRow key={m.label} m={m} />
                )
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-card rounded-[8px] border border-border shadow-sm p-10 text-center">
          <p className="text-sm text-muted-foreground">
            {!choferA && !choferB
              ? "Seleccioná dos choferes para ver la comparación."
              : !choferA
                ? "Falta seleccionar el Chofer A."
                : "Falta seleccionar el Chofer B."}
          </p>
        </div>
      )}
    </div>
  );
}
