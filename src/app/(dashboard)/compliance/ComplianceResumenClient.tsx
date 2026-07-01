"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ShieldCheck,
  Search,
  X,
  ChevronRight,
  FileSpreadsheet,
  AlertTriangle,
  Clock,
  FileX,
  CheckCircle2,
  MessageSquare,
  ArrowUpRight,
} from "lucide-react";
import ComplianceHelpButton from "./components/ComplianceHelpButton";
import { exportToExcel } from "@/shared/services/excel-export.service";
import { formatFecha } from "@/lib/utils";
import type { ComplianceEstado, ComplianceResumenRow } from "./types";

export type AccesoDirecto = { label: string; href: string; fuente: string };

const ESTADO_TONE: Record<ComplianceEstado, "success" | "warning" | "error" | "neutral"> = {
  vigente: "success",
  por_vencer: "warning",
  vencido: "error",
  faltante: "neutral",
};

const ESTADO_LABEL: Record<ComplianceEstado, string> = {
  vigente: "Vigente",
  por_vencer: "Por vencer",
  vencido: "Vencido",
  faltante: "Falta",
};

const ESTADO_RANK: Record<ComplianceEstado, number> = {
  vencido: 0,
  por_vencer: 1,
  faltante: 2,
  vigente: 3,
};

/** Prioridad de las fuentes en chips y accesos (las no listadas van al final, alfabético). */
const FUENTE_ORDEN = ["F931", "YPF", "Loma Negra", "Ambos"];

function esProblema(e: ComplianceEstado): boolean {
  return e !== "vigente";
}

function diasTexto(estado: ComplianceEstado, dias: number | null): string | null {
  if (dias === null) return null;
  if (estado === "vencido") return `Venció hace ${Math.abs(dias)}d`;
  if (estado === "por_vencer") return `Vence en ${dias}d`;
  return null;
}

function fuenteChipClass(fuente: string): string {
  switch (fuente) {
    case "F931":
      return "bg-[#EEF2FF] text-[#3730A3] border-[#C7D2FE]";
    case "YPF":
      return "bg-[#ECFEFF] text-[#155E75] border-[#A5F3FC]";
    case "Loma Negra":
      return "bg-[#F1F5F9] text-[#334155] border-[#CBD5E1]";
    case "Ambos":
      return "bg-[#F5F3FF] text-[#5B21B6] border-[#DDD6FE]";
    default:
      return "bg-[#FDF4FF] text-[#86198F] border-[#F5D0FE]"; // organismos (SICOP, Secondi…)
  }
}

function ordenarFuentes(fuentes: string[]): string[] {
  return [...fuentes].sort((a, b) => {
    const ia = FUENTE_ORDEN.indexOf(a);
    const ib = FUENTE_ORDEN.indexOf(b);
    if (ia !== -1 || ib !== -1) {
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    }
    return a.localeCompare(b);
  });
}

export default function ComplianceResumenClient({
  rows,
  accesos,
}: {
  rows: ComplianceResumenRow[];
  accesos: AccesoDirecto[];
}) {
  const [busqueda, setBusqueda] = useState("");
  const [estadosFiltro, setEstadosFiltro] = useState<Set<ComplianceEstado>>(new Set());
  const [fuentesFiltro, setFuentesFiltro] = useState<Set<string>>(new Set());
  // Por defecto mostramos solo lo que hay que resolver (vencido/por vencer/falta).
  const [soloProblemas, setSoloProblemas] = useState(true);

  const resumen = useMemo(() => {
    const out: Record<ComplianceEstado, number> = {
      vigente: 0,
      por_vencer: 0,
      vencido: 0,
      faltante: 0,
    };
    for (const r of rows) out[r.estado] += 1;
    return out;
  }, [rows]);

  const fuentesDisponibles = useMemo(
    () => ordenarFuentes(Array.from(new Set(rows.map((r) => r.fuente)))),
    [rows],
  );

  const rowsFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const filtradas = rows.filter((r) => {
      if (soloProblemas && !esProblema(r.estado)) return false;
      if (estadosFiltro.size > 0 && !estadosFiltro.has(r.estado)) return false;
      if (fuentesFiltro.size > 0 && !fuentesFiltro.has(r.fuente)) return false;
      if (q) {
        const text = `${r.fuente} ${r.requisito} ${r.entidad} ${r.observaciones ?? ""}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
    return filtradas.sort((a, b) => {
      const diff = ESTADO_RANK[a.estado] - ESTADO_RANK[b.estado];
      if (diff !== 0) return diff;
      const da = a.dias_restantes ?? 99999;
      const db = b.dias_restantes ?? 99999;
      if (da !== db) return da - db;
      return a.requisito.localeCompare(b.requisito);
    });
  }, [rows, busqueda, estadosFiltro, fuentesFiltro, soloProblemas]);

  const toggleEstado = (e: ComplianceEstado) =>
    setEstadosFiltro((prev) => {
      const next = new Set(prev);
      if (next.has(e)) next.delete(e);
      else next.add(e);
      return next;
    });

  const toggleFuente = (f: string) =>
    setFuentesFiltro((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });

  const limpiarFiltros = () => {
    setEstadosFiltro(new Set());
    setFuentesFiltro(new Set());
    setBusqueda("");
    setSoloProblemas(false);
  };

  const hayFiltros =
    estadosFiltro.size > 0 || fuentesFiltro.size > 0 || busqueda.length > 0 || soloProblemas;

  const handleExport = () => {
    exportToExcel({
      filename: "compliance_resumen",
      sheetName: "Compliance",
      data: rowsFiltradas,
      columns: [
        { header: "Fuente", key: "fuente" },
        { header: "Requisito", key: "requisito" },
        { header: "Entidad", key: "entidad" },
        {
          header: "Vencimiento",
          key: (r) => (r.fecha_vencimiento ? formatFecha(r.fecha_vencimiento) : "—"),
        },
        { header: "Estado", key: (r) => ESTADO_LABEL[r.estado] },
        {
          header: "Días",
          key: (r) =>
            r.dias_restantes === null
              ? "—"
              : r.dias_restantes >= 0
              ? `${r.dias_restantes}`
              : `-${Math.abs(r.dias_restantes)}`,
        },
        { header: "Observaciones", key: (r) => r.observaciones ?? "" },
      ],
    });
  };

  return (
    <div className="p-6 sm:p-8 space-y-5">
      <PageHeader
        title="Compliance"
        description="Todo lo que hay que presentar y su vencimiento, en un solo checklist — YPF, Loma Negra, SICOP, Secondi y Formulario 931."
        action={
          <div className="flex items-center gap-2">
            <ComplianceHelpButton />
            <Button variant="outline" size="sm" onClick={handleExport} className="border-border">
              <FileSpreadsheet size={14} className="mr-1.5" />
              Exportar
            </Button>
          </div>
        }
      />

      {/* Accesos directos a cada sección de detalle */}
      {accesos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {accesos.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              prefetch
              className="group inline-flex items-center gap-2 rounded-[8px] border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground shadow-xs hover:border-primary/40 hover:bg-primary/5 transition-colors"
            >
              <ShieldCheck size={15} className="text-primary" />
              {a.label}
              <ArrowUpRight
                size={14}
                className="text-muted-foreground/60 group-hover:text-primary transition-colors"
              />
            </Link>
          ))}
        </div>
      )}

      {/* KPIs (clickeables → filtran por estado) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {(["vencido", "por_vencer", "faltante", "vigente"] as ComplianceEstado[]).map((e) => (
          <ResumenCard
            key={e}
            estado={e}
            count={resumen[e]}
            activo={estadosFiltro.has(e)}
            onClick={() => toggleEstado(e)}
          />
        ))}
      </div>

      {/* Toolbar de filtros */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/70"
            />
            <Input
              placeholder="Buscar requisito, entidad, fuente…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-9"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={soloProblemas}
              onChange={(e) => setSoloProblemas(e.target.checked)}
              className="accent-primary"
            />
            Solo lo que vence / falta
          </label>

          {hayFiltros && (
            <Button
              variant="outline"
              size="sm"
              onClick={limpiarFiltros}
              className="border-border text-muted-foreground"
            >
              <X size={13} className="mr-1.5" />
              Limpiar
            </Button>
          )}

          <div className="ml-auto text-xs text-muted-foreground">
            {rowsFiltradas.length} resultado{rowsFiltradas.length !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Chips por fuente */}
        {fuentesDisponibles.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {fuentesDisponibles.map((f) => {
              const activo = fuentesFiltro.has(f);
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => toggleFuente(f)}
                  className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide transition-colors ${fuenteChipClass(
                    f,
                  )} ${activo ? "ring-2 ring-primary/50" : "opacity-90 hover:opacity-100"}`}
                >
                  {f}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Checklist */}
      {rowsFiltradas.length === 0 ? (
        <div className="bg-card rounded-[8px] border border-border p-12 text-center">
          <CheckCircle2 size={36} className="mx-auto text-[#22C55E]/70 mb-3" />
          <p className="text-sm text-muted-foreground">
            {soloProblemas
              ? "No hay nada por vencer ni faltante. Todo al día."
              : "Sin resultados con los filtros actuales."}
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-[8px] shadow-xs overflow-hidden divide-y divide-border">
          {rowsFiltradas.map((r) => (
            <ChecklistRow key={r.id} row={r} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Fila del checklist (link a la sección de detalle) ──────────────────────
function ChecklistRow({ row }: { row: ComplianceResumenRow }) {
  const estado = row.estado;
  const dotColor =
    estado === "vigente"
      ? "bg-[#22C55E]"
      : estado === "por_vencer"
      ? "bg-[#F59E0B]"
      : estado === "vencido"
      ? "bg-[#EF4444]"
      : "bg-[#94A3B8]";
  const sub = diasTexto(estado, row.dias_restantes);

  return (
    <Link
      href={row.href}
      prefetch
      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors"
    >
      <span className={`size-2 rounded-full shrink-0 ${dotColor}`} />

      <span
        className={`shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide w-[92px] justify-center ${fuenteChipClass(
          row.fuente,
        )}`}
      >
        {row.fuente}
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground truncate">{row.requisito}</p>
        <p className="text-xs text-muted-foreground truncate">
          {row.entidad}
          {row.fecha_vencimiento && (
            <span className="text-muted-foreground/70"> · Vence {formatFecha(row.fecha_vencimiento)}</span>
          )}
          {sub && <span className="text-muted-foreground/70"> · {sub}</span>}
        </p>
        {row.observaciones && (
          <p className="text-xs text-muted-foreground/80 italic flex items-center gap-1 mt-0.5 truncate">
            <MessageSquare size={11} className="shrink-0" />
            {row.observaciones}
          </p>
        )}
      </div>

      <StatusBadge label={ESTADO_LABEL[estado]} tone={ESTADO_TONE[estado]} />
      <ChevronRight size={16} className="text-muted-foreground/50 shrink-0" />
    </Link>
  );
}

// ── KPI card ───────────────────────────────────────────────────────────────
function ResumenCard({
  estado,
  count,
  activo,
  onClick,
}: {
  estado: ComplianceEstado;
  count: number;
  activo: boolean;
  onClick: () => void;
}) {
  const tone = ESTADO_TONE[estado];
  const Icon =
    estado === "vigente"
      ? CheckCircle2
      : estado === "por_vencer"
      ? Clock
      : estado === "vencido"
      ? AlertTriangle
      : FileX;
  const base =
    tone === "success"
      ? "bg-[#F0FDF4] border-[#BBF7D0] text-[#166534]"
      : tone === "warning"
      ? "bg-[#FFFBEB] border-[#FEF3C7] text-[#92400E]"
      : tone === "error"
      ? "bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]"
      : "bg-muted/40 border-border text-muted-foreground";
  const ring = activo
    ? tone === "success"
      ? "ring-2 ring-[#22C55E]"
      : tone === "warning"
      ? "ring-2 ring-[#F59E0B]"
      : tone === "error"
      ? "ring-2 ring-[#EF4444]"
      : "ring-2 ring-[#94A3B8]"
    : "";
  return (
    <button
      type="button"
      onClick={onClick}
      title={activo ? "Quitar filtro" : `Filtrar por ${ESTADO_LABEL[estado].toLowerCase()}`}
      className={`rounded-[8px] border p-4 text-left transition-all hover:scale-[1.01] ${base} ${ring}`}
    >
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
        <Icon size={13} />
        {ESTADO_LABEL[estado]}
      </div>
      <div className="text-2xl font-bold mt-1.5">{count}</div>
    </button>
  );
}
