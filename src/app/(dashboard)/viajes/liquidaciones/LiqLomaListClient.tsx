"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  FileSpreadsheet,
  Download,
  Calendar,
  Truck,
  Search,
  Layers,
  TrendingUp,
  Loader2,
  Trash2,
  X,
  Filter,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  getLiqLomaFileUrlAction,
  deleteLiqLomaAction,
  type LiqLomaRow,
} from "./liq-actions";
import { coincideBusqueda } from "@/lib/texto";

// ---------------------------------------------------------------------------
// Helpers de formato
// ---------------------------------------------------------------------------

function formatFecha(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("T")[0].split("-");
  return `${d}/${m}/${y}`;
}

function formatPeriodoCorto(desde: string | null, hasta: string | null): string {
  if (!desde && !hasta) return "Sin período";
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  if (desde && hasta) {
    const [, mD, dD] = desde.split("T")[0].split("-");
    const [yH, mH, dH] = hasta.split("T")[0].split("-");
    const mesH = meses[parseInt(mH, 10) - 1];
    if (mD === mH) return `${parseInt(dD, 10)}-${parseInt(dH, 10)} ${mesH} ${yH}`;
    const mesD = meses[parseInt(mD, 10) - 1];
    return `${parseInt(dD, 10)} ${mesD} → ${parseInt(dH, 10)} ${mesH} ${yH}`;
  }
  return formatFecha(desde ?? hasta);
}

function formatARS(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatARSCompact(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString("es-AR", { maximumFractionDigits: 2 })}M`;
  if (n >= 1_000) return `${(n / 1_000).toLocaleString("es-AR", { maximumFractionDigits: 1 })}K`;
  return n.toLocaleString("es-AR");
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export default function LiqLomaListClient({
  liqs: initialLiqs,
  canDelete = false,
  embedded = false,
}: {
  liqs: LiqLomaRow[];
  canDelete?: boolean;
  embedded?: boolean;
}) {
  const [liqs, setLiqs] = useState<LiqLomaRow[]>(initialLiqs);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [, startTransition] = useTransition();

  const handleDescargar = (liq: LiqLomaRow) => {
    setDownloadingId(liq.id);
    setActionError(null);
    startTransition(async () => {
      const res = await getLiqLomaFileUrlAction(liq.id);
      setDownloadingId(null);
      if (res.error || !res.url) {
        setActionError(res.error ?? "No se pudo abrir el archivo");
        return;
      }
      window.open(res.url, "_blank", "noopener,noreferrer");
    });
  };

  const handleEliminar = (liq: LiqLomaRow) => {
    if (
      !window.confirm(
        `¿Eliminar esta liquidación? Los ${liq.viajes_count} viajes vinculados NO se borran, solo se desvinculan del archivo.`,
      )
    )
      return;
    setDeletingId(liq.id);
    setActionError(null);
    startTransition(async () => {
      const res = await deleteLiqLomaAction(liq.id);
      setDeletingId(null);
      if (res.error) {
        setActionError(res.error);
        return;
      }
      setLiqs((prev) => prev.filter((l) => l.id !== liq.id));
    });
  };

  const stats = useMemo(() => {
    const totalARS = liqs.reduce((acc, l) => acc + (l.total_importe_ars ?? 0), 0);
    const totalViajes = liqs.reduce((acc, l) => acc + l.viajes_count, 0);
    return { totalARS, totalViajes };
  }, [liqs]);

  const liqsFiltradas = useMemo(() => {
    if (!busqueda.trim()) return liqs;
    // La búsqueda ignora acentos y mayúsculas. Se compara contra todos los
    // campos unidos, igual que antes.
    return liqs.filter((l) =>
      coincideBusqueda(
        [
          formatPeriodoCorto(l.periodo_desde, l.periodo_hasta),
          l.archivo_nombre,
          formatFecha(l.importado_en),
        ].join(" "),
        busqueda,
      ),
    );
  }, [liqs, busqueda]);

  return (
    <div className="space-y-5">
      {!embedded && (
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-foreground text-xl font-bold">Liquidaciones — Loma Negra</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Cada liquidación es el Excel de fletes que Loma paga; el importador guarda acá el
              archivo original + los viajes que generó.
            </p>
          </div>
        </div>
      )}

      {liqs.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <StatCard
            label="Liquidaciones"
            value={liqs.length.toString()}
            icon={<FileSpreadsheet size={16} />}
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
        </div>
      )}

      {/* Toolbar */}
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
              placeholder="Período, archivo, fecha de importación…"
              className="h-9 pl-9 text-sm"
              disabled={liqs.length === 0}
            />
          </div>
        </div>
        {busqueda && (
          <button
            type="button"
            onClick={() => setBusqueda("")}
            className="inline-flex items-center justify-center gap-1 h-10 sm:h-9 px-3 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted border border-border transition-colors"
          >
            <X size={12} />
            Limpiar
          </button>
        )}
        <Link
          href="/viajes"
          prefetch
          className="inline-flex w-full items-center justify-center gap-1.5 h-10 sm:h-9 px-4 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:bg-[#0277BD] transition-colors shadow-sm sm:w-auto sm:ml-auto"
        >
          <FileSpreadsheet size={14} />
          Importar liquidación
        </Link>
      </div>

      {busqueda && (
        <p className="text-xs text-muted-foreground -mt-2 flex items-center gap-1.5">
          <Filter size={11} />
          Mostrando <strong className="text-foreground">{liqsFiltradas.length}</strong> de {liqs.length}
        </p>
      )}

      {actionError && (
        <div className="bg-[#FEF2F2] border border-[#FECACA] text-[#7F1D1D] text-sm rounded-lg px-3 py-2">
          {actionError}
        </div>
      )}

      {liqs.length === 0 ? (
        <div className="bg-card rounded-[8px] border border-dashed border-border py-14 px-5 text-center">
          <EmptyState icon={Layers} message="Todavía no hay liquidaciones cargadas" />
          <p className="text-xs text-muted-foreground/70 mt-1">
            Importá el primer Excel de Loma desde{" "}
            <Link href="/viajes" prefetch className="text-primary font-semibold hover:underline">
              Viajes → Importar liquidación Loma
            </Link>{" "}
            para verlo acá.
          </p>
        </div>
      ) : liqsFiltradas.length === 0 ? (
        <div className="bg-card rounded-[8px] border border-border py-10 px-5 text-center text-sm text-muted-foreground">
          No hay liquidaciones que coincidan con &quot;{busqueda}&quot;
        </div>
      ) : (
        <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {liqsFiltradas.map((liq) => (
            <LiqCard
              key={liq.id}
              liq={liq}
              downloading={downloadingId === liq.id}
              deleting={deletingId === liq.id}
              canDelete={canDelete}
              onDescargar={() => handleDescargar(liq)}
              onEliminar={() => handleEliminar(liq)}
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
          <p className="text-foreground text-base font-bold mt-0.5 truncate">{value}</p>
          {sub && (
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate" title={sub}>
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

function LiqCard({
  liq,
  downloading,
  deleting,
  canDelete,
  onDescargar,
  onEliminar,
}: {
  liq: LiqLomaRow;
  downloading: boolean;
  deleting: boolean;
  canDelete: boolean;
  onDescargar: () => void;
  onEliminar: () => void;
}) {
  return (
    <li className="group bg-card rounded-[10px] border border-border shadow-xs hover:shadow-md hover:border-[#BAE6FD] transition-all overflow-hidden">
      {/* Header con período */}
      <div className="px-4 py-3 border-b border-border bg-[#F0F9FF]/40 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Calendar size={14} className="text-primary shrink-0" />
          <span className="text-sm font-bold text-foreground truncate">
            {formatPeriodoCorto(liq.periodo_desde, liq.periodo_hasta)}
          </span>
        </div>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-[#BAE6FD] text-[#075985]">
          <FileSpreadsheet size={10} />
          {liq.estado === "conciliado" ? "Conciliado" : "Importado"}
        </span>
      </div>

      {/* Body con grid de stats. En el celular el total se lleva la fila entera:
          "$ 1.234.567,89" no entra en un tercio de 343px. */}
      <div className="grid grid-cols-2 border-b border-border sm:grid-cols-3">
        <div className="col-span-2 min-w-0 border-b border-border px-3 py-3 sm:col-span-1 sm:border-b-0 sm:border-r sm:px-4">
          <p className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground/70">
            Total
          </p>
          <p className="text-foreground text-sm font-bold font-mono mt-0.5 flex items-baseline gap-1">
            <span className="text-[10px] text-muted-foreground/80">$</span>
            <span className="truncate">{formatARS(liq.total_importe_ars)}</span>
          </p>
        </div>
        <div className="min-w-0 border-r border-border px-3 py-3 sm:px-4">
          <p className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground/70">
            Fletes
          </p>
          <p className="text-foreground text-sm font-bold mt-0.5">{liq.fletes_count}</p>
        </div>
        <div className="min-w-0 px-3 py-3 sm:px-4">
          <p className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground/70">
            Viajes
          </p>
          <p className="text-foreground text-sm font-bold mt-0.5 inline-flex items-center gap-1.5">
            <Truck size={13} className="text-primary" />
            {liq.viajes_count}
          </p>
        </div>
      </div>

      {/* Footer con acciones */}
      <div className="px-3 sm:px-4 py-2.5 border-t border-border bg-muted/20 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground/80 truncate" title={liq.archivo_nombre ?? undefined}>
          Importado {formatFecha(liq.importado_en)}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {canDelete && (
            <button
              type="button"
              onClick={onEliminar}
              disabled={deleting}
              title="Eliminar liquidación (los viajes no se borran)"
              className="inline-flex items-center justify-center size-9 sm:size-8 rounded-md text-muted-foreground hover:text-[#DC2626] hover:bg-[#FEF2F2] border border-border transition-colors disabled:opacity-40"
            >
              {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={13} />}
            </button>
          )}
          <button
            type="button"
            onClick={onDescargar}
            disabled={!liq.archivo_id || downloading}
            title={liq.archivo_id ? "Abrir / descargar el Excel de Loma" : "Esta liquidación no tiene archivo"}
            className="inline-flex items-center gap-1.5 h-9 sm:h-8 px-3 rounded-md text-xs font-semibold bg-card border border-border text-foreground hover:bg-[#E1F5FE] hover:border-[#0088D1] hover:text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {downloading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
            {downloading ? "Abriendo…" : "Descargar Excel"}
          </button>
        </div>
      </div>
    </li>
  );
}
