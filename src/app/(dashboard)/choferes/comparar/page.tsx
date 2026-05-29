import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireArea } from "@/lib/auth";
import PageHeader from "@/components/layout/PageHeader";
import {
  computeRanking,
  resolverRango,
  type RankingChofer,
} from "../ranking/lib";
import ScoreBadge from "../ranking/ScoreBadge";
import ChoferSwap from "./ChoferSwap";

export const dynamic = "force-dynamic";

function fmtNum(n: number) {
  return n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

type Direccion = "higher_better" | "lower_better" | "neutral";

interface Metric {
  label: string;
  a: number;
  b: number;
  format: (n: number) => string;
  direction: Direccion;
  suffix?: string;
  indent?: boolean;
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
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-muted text-muted-foreground">
        =
      </span>
    );
  }
  const aGana = direction === "higher_better" ? diff > 0 : diff < 0;
  const color = aGana
    ? "bg-[#ECFDF5] text-[#064E3B]"
    : "bg-[#FEF2F2] text-[#7F1D1D]";
  const flecha = diff > 0 ? "↑" : "↓";
  const valor = format(Math.abs(diff));
  return (
    <span
      className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[11px] font-semibold ${color}`}
    >
      {flecha} {valor}
      {suffix}
    </span>
  );
}

function MetricRow({ m }: { m: Metric }) {
  return (
    <tr className="border-b border-border last:border-b-0">
      <td
        className={`px-4 py-2.5 text-sm text-muted-foreground ${
          m.indent ? "pl-8 text-xs" : "font-medium"
        }`}
      >
        {m.label}
      </td>
      <td className="px-4 py-2.5 text-right text-sm font-medium text-foreground tabular-nums">
        {m.format(m.a)}
        {m.suffix}
      </td>
      <td className="px-4 py-2.5 text-center">
        <DeltaChip
          a={m.a}
          b={m.b}
          direction={m.direction}
          format={m.format}
          suffix={m.suffix}
        />
      </td>
      <td className="px-4 py-2.5 text-left text-sm font-medium text-foreground tabular-nums">
        {m.format(m.b)}
        {m.suffix}
      </td>
    </tr>
  );
}

function buildMetrics(a: RankingChofer, b: RankingChofer): Metric[] {
  const fInt = (n: number) => fmtNum(n);
  const fPct = (n: number) => n.toFixed(0);
  return [
    {
      label: "Score",
      a: a.score ?? 0,
      b: b.score ?? 0,
      format: fInt,
      direction: "higher_better",
    },
    {
      label: "Viajes",
      a: a.viajes_count,
      b: b.viajes_count,
      format: fInt,
      direction: "higher_better",
    },
    {
      label: "KM totales",
      a: a.km_total,
      b: b.km_total,
      format: fInt,
      direction: "higher_better",
    },
    {
      label: "KM con carga",
      a: a.km_con_carga,
      b: b.km_con_carga,
      format: fInt,
      direction: "higher_better",
      indent: true,
    },
    {
      label: "KM vacíos",
      a: a.km_vacios,
      b: b.km_vacios,
      format: fInt,
      direction: "lower_better",
      indent: true,
    },
    {
      label: "% Vacíos",
      a: a.pct_vacios,
      b: b.pct_vacios,
      format: fPct,
      direction: "lower_better",
      suffix: "%",
    },
    {
      label: "Apercibimientos (total)",
      a: a.apercibimientos_total,
      b: b.apercibimientos_total,
      format: fInt,
      direction: "lower_better",
    },
    {
      label: "Leves",
      a: a.apercibimientos_leves,
      b: b.apercibimientos_leves,
      format: fInt,
      direction: "lower_better",
      indent: true,
    },
    {
      label: "Moderados",
      a: a.apercibimientos_moderados,
      b: b.apercibimientos_moderados,
      format: fInt,
      direction: "lower_better",
      indent: true,
    },
    {
      label: "Graves",
      a: a.apercibimientos_graves,
      b: b.apercibimientos_graves,
      format: fInt,
      direction: "lower_better",
      indent: true,
    },
    {
      label: "Roturas de gomas",
      a: a.roturas_count,
      b: b.roturas_count,
      format: fInt,
      direction: "lower_better",
    },
    {
      label: "Licencias activas",
      a: a.licencias_activas,
      b: b.licencias_activas,
      format: fInt,
      direction: "lower_better",
    },
  ];
}

function ChoferHeader({
  chofer,
  side,
  choferesList,
  otherId,
  periodoQuery,
}: {
  chofer: RankingChofer | null;
  side: "a" | "b";
  choferesList: Array<{ id: string; nombre: string; apellido: string }>;
  otherId: string;
  periodoQuery: string;
}) {
  return (
    <div className="bg-card rounded-[8px] border border-border shadow-sm p-5 space-y-3">
      <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
        Chofer {side.toUpperCase()}
      </div>

      <ChoferSwap
        side={side}
        choferes={choferesList}
        selectedId={chofer?.id ?? ""}
        otherId={otherId}
        periodoQuery={periodoQuery}
      />

      {chofer ? (
        <div className="pt-2">
          <p className="text-lg font-semibold text-foreground leading-tight">
            {chofer.apellido}, {chofer.nombre}
          </p>
          {chofer.localidad && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {chofer.localidad}
            </p>
          )}
          <div className="mt-3 flex items-center gap-2">
            <ScoreBadge score={chofer.score} />
            <Link
              href={`/choferes/${chofer.id}?tab=productividad`}
              className="text-xs font-medium text-primary hover:underline"
            >
              Ver legajo →
            </Link>
          </div>
        </div>
      ) : (
        <div className="pt-2">
          <p className="text-sm text-muted-foreground">
            Elegí un chofer para comparar.
          </p>
        </div>
      )}
    </div>
  );
}

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

  const ranking = await computeRanking({
    desde: periodo.desde,
    hasta: periodo.hasta,
  });

  const choferesList = ranking.map(({ id, nombre, apellido }) => ({
    id,
    nombre,
    apellido,
  }));

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

  const metrics =
    choferA && choferB ? buildMetrics(choferA, choferB) : null;

  return (
    <div className="p-8 space-y-5">
      <PageHeader
        title="Comparador de Choferes"
        description={`Período: ${periodo.label}`}
        action={
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-border bg-background text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <ArrowLeft size={14} />
            Volver al ranking
          </Link>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChoferHeader
          chofer={choferA}
          side="a"
          choferesList={choferesList}
          otherId={bId}
          periodoQuery={periodoQuery}
        />
        <ChoferHeader
          chofer={choferB}
          side="b"
          choferesList={choferesList}
          otherId={aId}
          periodoQuery={periodoQuery}
        />
      </div>

      {metrics ? (
        <div className="bg-card rounded-[8px] border border-border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/40">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Métricas del período · Las flechas indican mejor desempeño
            </p>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Métrica
                </th>
                <th className="px-4 py-2.5 text-right text-[11px] font-medium text-muted-foreground uppercase tracking-wider w-32">
                  Chofer A
                </th>
                <th className="px-4 py-2.5 text-center text-[11px] font-medium text-muted-foreground uppercase tracking-wider w-28">
                  Δ
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider w-32">
                  Chofer B
                </th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((m) => (
                <MetricRow key={m.label} m={m} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-card rounded-[8px] border border-border shadow-sm p-8 text-center">
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
