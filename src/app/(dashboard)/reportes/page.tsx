import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import { Trophy, Users, Building2, TrendingUp, ChevronRight, Route } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSeccion } from "@/lib/auth";
import { computeRanking, resolverRango } from "@/app/(dashboard)/choferes/ranking/lib";
import { getRotacion } from "@/app/(dashboard)/choferes/rotacion/lib";
import ScoreBadge from "@/app/(dashboard)/choferes/ranking/ScoreBadge";
import { choferSlug } from "@/lib/chofer-slug";
import ReportesHelpButton from "./ReportesHelpButton";

function fmtNum(n: number): string {
  return n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `$ ${(n / 1_000_000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} M`;
  if (n >= 1_000) return `$ ${(n / 1_000).toLocaleString("es-AR", { maximumFractionDigits: 0 })} k`;
  return `$ ${fmtNum(n)}`;
}

type ClienteReporte = {
  cliente: string;
  viajes: number;
  km: number;
  toneladas: number;
  facturacion: number;
  pesos_por_km: number | null;
};

type CoberturaCliente = {
  conCliente: number;
  sinAsignar: number;
  pct: number; // % de viajes con cliente real asignado
};

type ReporteClientesResult = {
  clientes: ClienteReporte[];
  cobertura: CoberturaCliente;
};

// Cliente comodín que los importadores asignan a los viajes sin cliente real
// (ver import-hoja-ruta). No es un cliente comercial: se excluye del reporte por
// cliente y se contabiliza aparte como "sin asignar" para medir la cobertura.
const CLIENTE_PLACEHOLDER = "sin asignar (import)";

async function getReporteClientes(desde: string, hasta: string): Promise<ReporteClientesResult> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("viajes")
    .select("cliente_id, km_con_carga, km_vacios, tonelaje_real, monto_flete, moneda, tipo_cambio, es_vacio, clientes(razon_social)")
    .gte("fecha_viaje", desde)
    .lte("fecha_viaje", hasta)
    .neq("estado", "cancelado"); // los borrados (soft delete) no suman al reporte

  const map = new Map<string, ClienteReporte>();
  let conCliente = 0;
  let sinAsignar = 0;
  for (const v of data ?? []) {
    const cli = Array.isArray(v.clientes) ? v.clientes[0] : v.clientes;
    const nombre = (cli as { razon_social?: string } | null)?.razon_social ?? null;
    const esPlaceholder = !!nombre && nombre.trim().toLowerCase() === CLIENTE_PLACEHOLDER;
    const sinClienteReal = v.cliente_id == null || esPlaceholder;

    // Cobertura: solo viajes que deberían tener cliente comercial. Los vacíos
    // (reposicionamiento) no tienen cliente por naturaleza → no cuentan.
    if (!v.es_vacio) {
      if (sinClienteReal) sinAsignar += 1;
      else conCliente += 1;
    }

    // Tabla por cliente: solo clientes reales (se excluye el comodín de import).
    if (sinClienteReal) continue;

    const key = v.cliente_id as string;
    if (!map.has(key)) {
      map.set(key, { cliente: nombre ?? "Sin cliente", viajes: 0, km: 0, toneladas: 0, facturacion: 0, pesos_por_km: null });
    }
    const r = map.get(key)!;
    const kmCarga = v.km_con_carga ?? 0;
    r.viajes += 1;
    r.km += kmCarga + (v.km_vacios ?? 0);
    r.toneladas += v.tonelaje_real ?? 0;
    const m = v.monto_flete ?? 0;
    if (m) r.facturacion += v.moneda && v.moneda !== "ARS" && v.tipo_cambio ? m * v.tipo_cambio : m;
  }

  const rows = [...map.values()].map((r) => ({
    ...r,
    pesos_por_km: r.km > 0 && r.facturacion > 0 ? r.facturacion / r.km : null,
  }));
  rows.sort((a, b) => b.facturacion - a.facturacion);

  const totalViajes = conCliente + sinAsignar;
  return {
    clientes: rows,
    cobertura: {
      conCliente,
      sinAsignar,
      pct: totalViajes > 0 ? (conCliente / totalViajes) * 100 : 0,
    },
  };
}

const RANGOS: { key: string; label: string }[] = [
  { key: "1m", label: "Este mes" },
  { key: "3m", label: "Últimos 3 meses" },
  { key: "1y", label: "Último año" },
];

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ rango?: string }>;
}) {
  await requireSeccion("reportes", "read");
  const { rango } = await searchParams;
  const periodo = resolverRango({ rango });

  const [ranking, rotacionRes, reporteClientes] = await Promise.all([
    computeRanking(periodo),
    getRotacion(),
    getReporteClientes(periodo.desde, periodo.hasta),
  ]);
  const rotacion = rotacionRes.data;
  const { clientes, cobertura } = reporteClientes;

  const topChoferes = ranking.filter((r) => r.viajes_count > 0).slice(0, 10);

  return (
    <div className="p-8 space-y-6 w-full">
      <PageHeader
        title="Reportes"
        description="Indicadores operativos, de rotación y comerciales"
        action={<ReportesHelpButton />}
      />

      {/* Selector de período */}
      <div className="flex items-center gap-1.5">
        {RANGOS.map((r) => {
          const active = periodo.rango === r.key;
          return (
            <Link
              key={r.key}
              href={`/reportes?rango=${r.key}`}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                active
                  ? "bg-primary text-white"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}
            >
              {r.label}
            </Link>
          );
        })}
        <span className="ml-2 text-xs text-muted-foreground capitalize">{periodo.label}</span>
      </div>

      {/* Reporte: Productividad de choferes */}
      <ReportCard
        icon={Trophy}
        title="Productividad de choferes"
        subtitle="Top 10 por score operativo del período"
        href="/choferes/ranking"
        hrefLabel="Ver ranking completo"
      >
        {topChoferes.length === 0 ? (
          <Empty msg="Sin actividad de choferes en el período." />
        ) : (
          <Tabla
            cols={["#", "Chofer", "Viajes", "Km", "% vacíos", "Facturación", "$/km", "Score"]}
            aligns={["left", "left", "right", "right", "right", "right", "right", "right"]}
          >
            {topChoferes.map((r, i) => (
              <tr key={r.id} className="hover:bg-muted/30 border-t border-border">
                <Td>{i + 1}</Td>
                <Td>
                  <Link href={`/choferes/${choferSlug(r)}?tab=productividad`} className="font-medium text-foreground hover:text-primary">
                    {r.apellido}, {r.nombre}
                  </Link>
                </Td>
                <Td align="right">{r.viajes_count}</Td>
                <Td align="right">{fmtNum(r.km_total)}</Td>
                <Td align="right" className={r.pct_vacios > 30 ? "text-[#EF4444]" : ""}>
                  {r.pct_vacios.toFixed(0)}%
                </Td>
                <Td align="right" className="text-[#10B981] font-medium">{fmtMoney(r.facturacion_total)}</Td>
                <Td align="right">{r.pesos_por_km != null ? fmtMoney(r.pesos_por_km) : "—"}</Td>
                <Td align="right"><ScoreBadge score={r.score} size="sm" /></Td>
              </tr>
            ))}
          </Tabla>
        )}
      </ReportCard>

      {/* Reporte: Km / Facturación por cliente */}
      <ReportCard
        icon={Building2}
        title="Km y facturación por cliente"
        subtitle="Volumen y facturación del período, por cliente"
        href="/clientes"
        hrefLabel="Ver clientes"
      >
        {/* Cobertura de cliente: qué porción de los viajes del período tiene un
            cliente real asignado (vs. el comodín "Sin asignar (import)"). */}
        {cobertura.conCliente + cobertura.sinAsignar > 0 && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 px-5 py-3 border-b border-border bg-muted/20">
            <div className="flex items-baseline gap-1.5">
              <span className="text-[11px] text-muted-foreground/70 uppercase tracking-wide">Cobertura de cliente</span>
              <span
                className={`text-lg font-bold ${
                  cobertura.pct >= 90 ? "text-[#10B981]" : cobertura.pct >= 70 ? "text-[#F59E0B]" : "text-[#EF4444]"
                }`}
              >
                {cobertura.pct.toFixed(0)}%
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground">
              {fmtNum(cobertura.conCliente)} con cliente
              {cobertura.sinAsignar > 0 && (
                <>
                  {" · "}
                  <span className="text-[#F59E0B] font-semibold">{fmtNum(cobertura.sinAsignar)} sin asignar</span>
                </>
              )}
            </span>
          </div>
        )}
        {clientes.length === 0 ? (
          <Empty msg="Sin viajes con cliente en el período." />
        ) : (
          <Tabla
            cols={["Cliente", "Viajes", "Km", "Toneladas", "Facturación", "$/km"]}
            aligns={["left", "right", "right", "right", "right", "right"]}
          >
            {clientes.slice(0, 15).map((c) => (
              <tr key={c.cliente} className="hover:bg-muted/30 border-t border-border">
                <Td>{c.cliente}</Td>
                <Td align="right">{c.viajes}</Td>
                <Td align="right">{fmtNum(c.km)}</Td>
                <Td align="right">{fmtNum(c.toneladas)}</Td>
                <Td align="right" className="text-[#10B981] font-medium">{fmtMoney(c.facturacion)}</Td>
                <Td align="right">{c.pesos_por_km != null ? fmtMoney(c.pesos_por_km) : "—"}</Td>
              </tr>
            ))}
          </Tabla>
        )}
      </ReportCard>

      {/* Reporte: Rotación de choferes (anual) */}
      <ReportCard
        icon={Users}
        title={`Rotación de choferes · ${rotacion.anio}`}
        subtitle="Índice de rotación del año en curso"
        href="/choferes/rotacion"
        hrefLabel="Ver detalle de rotación"
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-5 py-4">
          <MiniKPI label="Dotación actual" value={String(rotacion.dotacion_actual)} icon={Users} />
          <MiniKPI label="Altas del año" value={String(rotacion.altas)} icon={TrendingUp} color="text-[#10B981]" />
          <MiniKPI label="Bajas del año" value={String(rotacion.bajas)} icon={Route} color="text-[#EF4444]" />
          <MiniKPI
            label="Índice de rotación"
            value={`${rotacion.indice_rotacion.toFixed(1)}%`}
            icon={TrendingUp}
            color={rotacion.indice_rotacion > 20 ? "text-[#EF4444]" : "text-foreground"}
          />
        </div>
      </ReportCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponentes de presentación
// ---------------------------------------------------------------------------

function ReportCard({
  icon: Icon,
  title,
  subtitle,
  href,
  hrefLabel,
  children,
}: {
  icon: typeof Trophy;
  title: string;
  subtitle: string;
  href: string;
  hrefLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card rounded-[8px] border border-border shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <Icon size={16} className="text-primary" />
          <div>
            <h2 className="text-foreground text-sm font-bold leading-tight">{title}</h2>
            <p className="text-muted-foreground text-[11px] mt-0.5">{subtitle}</p>
          </div>
        </div>
        <Link
          href={href}
          className="text-xs font-semibold text-primary hover:text-primary/80 hover:underline transition-colors flex items-center gap-0.5 shrink-0"
        >
          {hrefLabel}
          <ChevronRight size={13} />
        </Link>
      </div>
      {children}
    </div>
  );
}

function Tabla({
  cols,
  aligns,
  children,
}: {
  cols: string[];
  aligns: ("left" | "right")[];
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr>
            {cols.map((c, i) => (
              <th
                key={c}
                className={`px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide ${
                  aligns[i] === "right" ? "text-right" : "text-left"
                }`}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Td({
  children,
  align = "left",
  className = "",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <td
      className={`px-4 py-2.5 text-sm text-muted-foreground ${align === "right" ? "text-right font-mono" : ""} ${className}`}
    >
      {children}
    </td>
  );
}

function MiniKPI({
  label,
  value,
  icon: Icon,
  color = "text-foreground",
}: {
  label: string;
  value: string;
  icon: typeof Trophy;
  color?: string;
}) {
  return (
    <div className="rounded-[8px] border border-border bg-card px-4 py-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={13} className="text-muted-foreground/70" />
        <p className="text-[11px] text-muted-foreground/70">{label}</p>
      </div>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="px-5 py-8 text-center text-sm text-muted-foreground">{msg}</div>;
}
