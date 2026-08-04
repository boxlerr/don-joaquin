"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  FileText,
  Download,
  CheckCircle2,
  Calendar,
  Hash,
  Truck,
  Search,
  Layers,
  TrendingUp,
  Loader2,
  ExternalLink,
  X,
  Filter,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/EmptyState";
import { getDmYpfPdfUrlAction, type DmYpfRow } from "./dm-actions";
import { coincideBusqueda } from "@/lib/texto";

// ---------------------------------------------------------------------------
// Helpers de formato
// ---------------------------------------------------------------------------

function formatFecha(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("T")[0].split("-");
  return `${d}/${m}/${y}`;
}

function formatPeriodoCorto(desde: string, hasta: string): string {
  // "1-15 abr 2026"
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const [, mD, dD] = desde.split("T")[0].split("-");
  const [yH, mH, dH] = hasta.split("T")[0].split("-");
  const mesH = meses[parseInt(mH, 10) - 1];
  if (mD === mH) {
    return `${parseInt(dD, 10)}-${parseInt(dH, 10)} ${mesH} ${yH}`;
  }
  const mesD = meses[parseInt(mD, 10) - 1];
  return `${parseInt(dD, 10)} ${mesD} → ${parseInt(dH, 10)} ${mesH} ${yH}`;
}

/** Formatea ARS sin prefijo $ — el componente lo agrega aparte para que no se duplique. */
function formatARS(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Formato compacto para totales grandes: 176,87M / 1.234M */
function formatARSCompact(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString("es-AR", { maximumFractionDigits: 2 })}M`;
  if (n >= 1_000) return `${(n / 1_000).toLocaleString("es-AR", { maximumFractionDigits: 1 })}K`;
  return n.toLocaleString("es-AR");
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export default function DmYpfListClient({
  dms,
  embedded = false,
}: {
  dms: DmYpfRow[];
  /** Cuando es true, no renderiza el header con título — el wrapper ya lo muestra. */
  embedded?: boolean;
}) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [, startTransition] = useTransition();

  const hayFiltros = !!busqueda || !!fechaDesde || !!fechaHasta;
  const limpiarFiltros = () => {
    setBusqueda("");
    setFechaDesde("");
    setFechaHasta("");
  };

  const handleDescargar = (dm: DmYpfRow) => {
    setDownloadingId(dm.id);
    setDownloadError(null);
    startTransition(async () => {
      const res = await getDmYpfPdfUrlAction(dm.id);
      setDownloadingId(null);
      if (res.error || !res.url) {
        setDownloadError(res.error ?? "No se pudo abrir el PDF");
        return;
      }
      window.open(res.url, "_blank", "noopener,noreferrer");
    });
  };

  // Stats agregados para el header
  const stats = useMemo(() => {
    const totalARS = dms.reduce(
      (acc, dm) => acc + (dm.total_certificado_ars ?? 0),
      0,
    );
    const totalViajes = dms.reduce((acc, dm) => acc + dm.viajes_count, 0);
    const promedioPorViaje = totalViajes > 0 ? totalARS / totalViajes : 0;
    const ultimoPeriodo =
      dms.length > 0
        ? formatPeriodoCorto(dms[0].periodo_desde, dms[0].periodo_hasta)
        : null;
    const ultimaImportacion =
      dms.length > 0 ? formatFecha(dms[0].importado_en) : null;
    return {
      totalARS,
      totalViajes,
      promedioPorViaje,
      ultimoPeriodo,
      ultimaImportacion,
    };
  }, [dms]);

  // Filtrado por búsqueda (período, solpe, pedido, solicitante) + rango de fechas.
  // Para el rango, un DM "cae dentro" si su período se solapa con [fechaDesde, fechaHasta].
  const dmsFiltrados = useMemo(() => {
    return dms.filter((dm) => {
      // La búsqueda ignora acentos y mayúsculas: "sanchez" encuentra "Sánchez".
      // Se compara contra todos los campos unidos, igual que antes.
      if (
        !coincideBusqueda(
          [
            formatFecha(dm.periodo_desde),
            formatFecha(dm.periodo_hasta),
            dm.numero_solpe,
            dm.numero_pedido,
            dm.contrato_sap,
            dm.solicitante,
          ].join(" "),
          busqueda,
        )
      )
        return false;
      // Rango de fechas: solapamiento entre el período del DM y [fechaDesde, fechaHasta]
      const dmDesde = dm.periodo_desde.split("T")[0];
      const dmHasta = dm.periodo_hasta.split("T")[0];
      if (fechaDesde && dmHasta < fechaDesde) return false;
      if (fechaHasta && dmDesde > fechaHasta) return false;
      return true;
    });
  }, [dms, busqueda, fechaDesde, fechaHasta]);

  return (
    <div className="space-y-5">
      {/* Header (oculto cuando embedded — el wrapper lo muestra arriba) */}
      {!embedded && (
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-foreground text-xl font-bold">
              Documentos de Medición — YPF
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Cada DM es la papeleta quincenal firmada por YPF que certifica las
              toneladas y el total a facturar.
            </p>
          </div>
          <Link
            href="/viajes"
            prefetch
            className="inline-flex w-full items-center justify-center gap-1.5 h-10 sm:h-9 px-4 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:bg-[#0277BD] transition-colors shadow-sm sm:w-auto"
          >
            <FileText size={14} />
            Importar nuevo DM
          </Link>
        </div>
      )}

      {/* Bloque de estadísticas — solo si hay DMs */}
      {dms.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="DMs cargados"
            value={dms.length.toString()}
            icon={<FileText size={16} />}
            iconBg="bg-[#E1F5FE]"
            iconColor="text-primary"
          />
          <StatCard
            label="Total facturado"
            value={`$ ${formatARSCompact(stats.totalARS)}`}
            sub={`$ ${formatARS(stats.totalARS)}`}
            icon={<TrendingUp size={16} />}
            iconBg="bg-[#ECFDF5]"
            iconColor="text-[#10B981]"
          />
          <StatCard
            label="Viajes vinculados"
            value={stats.totalViajes.toString()}
            icon={<Truck size={16} />}
            iconBg="bg-[#FEF3C7]"
            iconColor="text-[#92400E]"
          />
          <StatCard
            label="Último período"
            value={stats.ultimoPeriodo ?? "—"}
            sub={
              stats.ultimaImportacion
                ? `Importado ${stats.ultimaImportacion}`
                : undefined
            }
            icon={<Calendar size={16} />}
            iconBg="bg-[#F3E8FF]"
            iconColor="text-[#6B21A8]"
          />
        </div>
      )}

      {/* Toolbar: búsqueda + rango de fechas + import (cuando embedded) */}
      <div className="bg-card border border-border rounded-[8px] p-3 flex items-end gap-2 sm:gap-3 flex-wrap">
        <div className="w-full sm:w-auto sm:flex-1 sm:min-w-[220px] sm:max-w-md">
          <label className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground/80 block mb-1">
            Búsqueda
          </label>
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 pointer-events-none"
            />
            <Input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Período, Solpe, Pedido, Solicitante…"
              className="h-9 pl-9 text-sm"
              disabled={dms.length === 0}
            />
          </div>
        </div>

        {/* Desde/hasta son dos campos cortos: pueden ir lado a lado también en
            el celular, cada uno a la mitad del ancho. */}
        <div className="flex w-full items-end gap-2 sm:w-auto sm:gap-1.5">
          <div className="flex-1 sm:flex-none">
            <label className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground/80 block mb-1">
              Desde
            </label>
            <Input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="h-9 w-full sm:w-40 text-sm"
              disabled={dms.length === 0}
              aria-label="Período desde"
            />
          </div>
          <div className="flex-1 sm:flex-none">
            <label className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground/80 block mb-1">
              Hasta
            </label>
            <Input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="h-9 w-full sm:w-40 text-sm"
              disabled={dms.length === 0}
              aria-label="Período hasta"
            />
          </div>
        </div>

        {hayFiltros && (
          <button
            type="button"
            onClick={limpiarFiltros}
            className="inline-flex items-center justify-center gap-1 h-10 sm:h-9 px-3 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted border border-border transition-colors"
            title="Limpiar filtros"
          >
            <X size={12} />
            Limpiar
          </button>
        )}

        {embedded && (
          <Link
            href="/viajes"
            prefetch
            className="inline-flex w-full items-center justify-center gap-1.5 h-10 sm:h-9 px-4 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:bg-[#0277BD] transition-colors shadow-sm sm:w-auto sm:ml-auto"
          >
            <FileText size={14} />
            Importar PDF de YPF
          </Link>
        )}
      </div>

      {/* Mini-resumen de filtros activos */}
      {hayFiltros && (
        <p className="text-xs text-muted-foreground -mt-2 flex items-center gap-1.5">
          <Filter size={11} />
          Mostrando <strong className="text-foreground">{dmsFiltrados.length}</strong> de {dms.length} DMs
        </p>
      )}

      {/* Mensaje de error de descarga (banner) */}
      {downloadError && (
        <div className="bg-[#FEF2F2] border border-[#FECACA] text-[#7F1D1D] text-sm rounded-lg px-3 py-2">
          {downloadError}
        </div>
      )}

      {/* Listado de DMs como tarjetas */}
      {dms.length === 0 ? (
        <div className="bg-card rounded-[8px] border border-dashed border-border py-14 px-5 text-center">
          <EmptyState
            icon={Layers}
            message="Todavía no hay DMs cargados"
          />
          <p className="text-xs text-muted-foreground/70 mt-1">
            Importá el primer PDF de YPF desde{" "}
            <Link
              href="/viajes"
              prefetch
              className="text-primary font-semibold hover:underline"
            >
              Viajes → Importar PDF de YPF
            </Link>{" "}
            para verlo acá.
          </p>
        </div>
      ) : dmsFiltrados.length === 0 ? (
        <div className="bg-card rounded-[8px] border border-border py-10 px-5 text-center text-sm text-muted-foreground">
          No hay DMs que coincidan con &quot;{busqueda}&quot;
        </div>
      ) : (
        <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {dmsFiltrados.map((dm) => (
            <DmCard
              key={dm.id}
              dm={dm}
              downloading={downloadingId === dm.id}
              onDescargar={() => handleDescargar(dm)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-componentes
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  sub,
  icon,
  iconBg,
  iconColor,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className="bg-card border border-border rounded-[8px] p-3 shadow-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground/70">
            {label}
          </p>
          <p className="text-foreground text-base font-bold mt-0.5 truncate">
            {value}
          </p>
          {sub && (
            <p
              className="text-[11px] text-muted-foreground mt-0.5 truncate"
              title={sub}
            >
              {sub}
            </p>
          )}
        </div>
        <span
          className={`shrink-0 size-9 rounded-lg ${iconBg} ${iconColor} flex items-center justify-center`}
        >
          {icon}
        </span>
      </div>
    </div>
  );
}

function DmCard({
  dm,
  downloading,
  onDescargar,
}: {
  dm: DmYpfRow;
  downloading: boolean;
  onDescargar: () => void;
}) {
  const conciliado = dm.estado === "conciliado";

  return (
    <li
      className={`group bg-card rounded-[10px] border shadow-xs hover:shadow-md transition-all overflow-hidden ${
        conciliado
          ? "border-[#A7F3D0]"
          : "border-border hover:border-[#BAE6FD]"
      }`}
    >
      {/* Header con período + estado */}
      <div
        className={`px-4 py-3 border-b flex items-center justify-between gap-2 ${
          conciliado
            ? "bg-[#ECFDF5]/40 border-[#A7F3D0]"
            : "bg-[#F0F9FF]/40 border-border"
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Calendar size={14} className="text-primary shrink-0" />
          <span className="text-sm font-bold text-foreground truncate">
            {formatPeriodoCorto(dm.periodo_desde, dm.periodo_hasta)}
          </span>
        </div>
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
            conciliado
              ? "bg-[#A7F3D0] text-[#065F46]"
              : "bg-[#BAE6FD] text-[#075985]"
          }`}
        >
          {conciliado ? (
            <CheckCircle2 size={10} />
          ) : (
            <FileText size={10} />
          )}
          {conciliado ? "Conciliado" : "Importado"}
        </span>
      </div>

      {/* Body con grid de stats */}
      <div className="grid grid-cols-2 divide-x divide-border border-b border-border">
        <div className="min-w-0 px-3 py-3 sm:px-4">
          <p className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground/70">
            Total certificado
          </p>
          <p className="text-foreground text-sm sm:text-base font-bold font-mono mt-0.5 flex items-baseline gap-1">
            <span className="text-[11px] text-muted-foreground/80">$</span>
            <span className="truncate">{formatARS(dm.total_certificado_ars)}</span>
          </p>
        </div>
        <div className="min-w-0 px-3 py-3 sm:px-4">
          <p className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground/70">
            Viajes vinculados
          </p>
          <Link
            href={`/viajes?dm_ypf=${dm.id}`}
            prefetch
            className="text-foreground text-base font-bold mt-0.5 inline-flex items-center gap-1.5 hover:text-primary hover:underline group/link"
          >
            <Truck size={14} className="text-primary" />
            <span>{dm.viajes_count}</span>
            <ExternalLink
              size={11}
              className="text-muted-foreground/50 group-hover/link:text-primary"
            />
          </Link>
        </div>
      </div>

      {/* Datos SAP (chips) */}
      <div className="px-3 sm:px-4 py-3 flex items-center gap-1.5 flex-wrap text-[11px] text-muted-foreground">
        {dm.numero_solpe && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted/60 font-mono">
            <Hash size={9} className="text-muted-foreground/70" />
            Solpe {dm.numero_solpe}
          </span>
        )}
        {dm.numero_pedido && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted/60 font-mono">
            <Hash size={9} className="text-muted-foreground/70" />
            Pedido {dm.numero_pedido}
          </span>
        )}
        {dm.solicitante && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted/60">
            Solic. {dm.solicitante}
          </span>
        )}
        {dm.fecha_certificacion && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#ECFDF5] text-[#065F46]">
            <CheckCircle2 size={9} />
            Firmado {formatFecha(dm.fecha_certificacion)}
          </span>
        )}
      </div>

      {/* Footer con acciones */}
      <div className="px-3 sm:px-4 py-2.5 border-t border-border bg-muted/20 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground/80">
          Importado {formatFecha(dm.importado_en)}
        </span>
        <button
          type="button"
          onClick={onDescargar}
          disabled={!dm.archivo_id || downloading}
          title={
            dm.archivo_id
              ? "Abrir / descargar el PDF firmado por YPF"
              : "Este DM no tiene PDF original"
          }
          className="inline-flex items-center gap-1.5 h-9 sm:h-8 px-3 rounded-md text-xs font-semibold bg-card border border-border text-foreground hover:bg-[#E1F5FE] hover:border-[#0088D1] hover:text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {downloading ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Download size={12} />
          )}
          {downloading ? "Abriendo…" : "Descargar PDF"}
        </button>
      </div>
    </li>
  );
}
