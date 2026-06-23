"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/ui/StatusBadge";
import { Input } from "@/components/ui/input";
import {
  Printer,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileX,
  Upload,
  ExternalLink,
  Search,
  Filter,
  X,
  ChevronRight,
  History,
  Table2,
  Rows3,
  FileSpreadsheet,
  ShieldCheck,
  Users,
  Truck,
  Building2,
} from "lucide-react";
import {
  CLIENTE_LABEL,
  NIVEL_LABEL,
  type ComplianceCliente,
  type ComplianceEstado,
  type ComplianceEstadoRow,
  type ComplianceNivel,
  type ComplianceRequisito,
} from "../types";
import CargarComplianceDocDialog from "./CargarComplianceDocDialog";
import ComplianceHistorialDialog from "./ComplianceHistorialDialog";
import { getSignedUrlComplianceArchivoAction } from "../actions";
import { formatFecha } from "@/lib/utils";
import { exportToExcel } from "@/shared/services/excel-export.service";

interface Props {
  cliente: ComplianceCliente;
  rows: ComplianceEstadoRow[];
  requisitos: ComplianceRequisito[];
  canWrite: boolean;
  /** Cuando es true, omite el padding lateral del root (lo asume el wrapper). */
  embedded?: boolean;
}

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

const NIVELES: ComplianceNivel[] = ["chofer", "unidad", "empresa"];

const NIVEL_ICON: Record<ComplianceNivel, typeof Users> = {
  chofer: Users,
  unidad: Truck,
  empresa: Building2,
};

type Vista = "lista" | "matriz";

function esProblema(r: ComplianceEstadoRow): boolean {
  return r.estado === "vencido" || r.estado === "por_vencer" || r.estado === "faltante";
}

function diasTexto(estado: ComplianceEstado, dias: number | null): string | null {
  if (dias === null) return null;
  if (estado === "vencido") return `Venció hace ${Math.abs(dias)}d`;
  if (estado === "por_vencer") return `Vence en ${dias}d`;
  return null;
}

export default function ComplianceChecklistPage({ cliente, rows, requisitos, canWrite, embedded = false }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // ── UI state ───────────────────────────────────────────────────────────
  const [tab, setTab] = useState<ComplianceNivel>(() => {
    const counts: Record<ComplianceNivel, number> = { chofer: 0, unidad: 0, empresa: 0 };
    for (const r of rows) if (esProblema(r)) counts[r.nivel] += 1;
    const winner = NIVELES.reduce((a, b) => (counts[b] > counts[a] ? b : a), "chofer" as ComplianceNivel);
    return counts[winner] > 0 ? winner : "chofer";
  });
  const [vista, setVista] = useState<Vista>("lista");
  const [estadosFiltro, setEstadosFiltro] = useState<Set<ComplianceEstado>>(new Set());
  const [reqsFiltro, setReqsFiltro] = useState<Set<string>>(new Set());
  const [busqueda, setBusqueda] = useState("");
  const [soloProblemas, setSoloProblemas] = useState(false);
  const [reqsMenuOpen, setReqsMenuOpen] = useState(false);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const [dialogState, setDialogState] = useState<{
    requisito: ComplianceRequisito;
    chofer_id?: string;
    camion_id?: string;
  } | null>(null);
  const [historialState, setHistorialState] = useState<{
    requisito: ComplianceRequisito;
    entidadLabel: string;
    chofer_id?: string;
    camion_id?: string;
  } | null>(null);

  // ── Derivados ──────────────────────────────────────────────────────────
  const requisitosPorNivel = useMemo(() => {
    const m: Record<ComplianceNivel, ComplianceRequisito[]> = { chofer: [], unidad: [], empresa: [] };
    for (const r of requisitos) m[r.nivel].push(r);
    return m;
  }, [requisitos]);

  const rowsPorNivel = useMemo(() => {
    const m: Record<ComplianceNivel, ComplianceEstadoRow[]> = { chofer: [], unidad: [], empresa: [] };
    for (const r of rows) m[r.nivel].push(r);
    return m;
  }, [rows]);

  const resumen = useMemo(() => {
    const out: Record<ComplianceEstado, number> = { vigente: 0, por_vencer: 0, vencido: 0, faltante: 0 };
    for (const r of rows) out[r.estado] += 1;
    return out;
  }, [rows]);

  // Métricas: separamos "cobertura" (cuánto del legajo se cargó al sistema)
  // de "vigencia" (de lo cargado, cuánto está al día). Un faltante es un
  // documento que se exige pero todavía no se digitalizó — pesa en cobertura,
  // no en vigencia.
  const totalDocs = rows.length;
  const cargados = resumen.vigente + resumen.por_vencer + resumen.vencido;
  const coberturaPct = totalDocs > 0 ? Math.round((cargados / totalDocs) * 100) : null;
  const vigenciaPct = cargados > 0 ? Math.round((resumen.vigente / cargados) * 100) : null;

  const problemasPorNivel = useMemo(() => {
    const m: Record<ComplianceNivel, number> = { chofer: 0, unidad: 0, empresa: 0 };
    for (const r of rows) if (esProblema(r)) m[r.nivel] += 1;
    return m;
  }, [rows]);

  const rowsFiltradas = useMemo(() => {
    const base = rowsPorNivel[tab];
    const q = busqueda.trim().toLowerCase();
    return base.filter((r) => {
      if (soloProblemas && !esProblema(r)) return false;
      if (estadosFiltro.size > 0 && !estadosFiltro.has(r.estado)) return false;
      if (reqsFiltro.size > 0 && !reqsFiltro.has(r.requisito_id)) return false;
      if (q) {
        const text = `${r.chofer_nombre ?? ""} ${r.camion_patente ?? ""} ${r.requisito_nombre}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [rowsPorNivel, tab, busqueda, estadosFiltro, reqsFiltro, soloProblemas]);

  const toggleEstado = (e: ComplianceEstado) =>
    setEstadosFiltro((prev) => {
      const next = new Set(prev);
      if (next.has(e)) next.delete(e);
      else next.add(e);
      return next;
    });

  const toggleRequisito = (id: string) =>
    setReqsFiltro((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const limpiarFiltros = () => {
    setEstadosFiltro(new Set());
    setReqsFiltro(new Set());
    setBusqueda("");
    setSoloProblemas(false);
  };

  const hayFiltros =
    estadosFiltro.size > 0 || reqsFiltro.size > 0 || busqueda.length > 0 || soloProblemas;

  const abrirSignedUrl = async (archivo_id: string) => {
    const res = await getSignedUrlComplianceArchivoAction(archivo_id);
    if ("url" in res && res.url) window.open(res.url, "_blank", "noopener,noreferrer");
    else alert(res.error ?? "No se pudo abrir el archivo");
  };

  const handleUpload = (
    req: ComplianceRequisito,
    target?: { chofer_id?: string; camion_id?: string },
  ) => {
    setDialogState({ requisito: req, chofer_id: target?.chofer_id, camion_id: target?.camion_id });
  };

  const handleHistorial = (
    req: ComplianceRequisito,
    entidadLabel: string,
    target?: { chofer_id?: string; camion_id?: string },
  ) => {
    setHistorialState({
      requisito: req,
      entidadLabel,
      chofer_id: target?.chofer_id,
      camion_id: target?.camion_id,
    });
  };

  const toggleExpandido = (id: string) =>
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleExport = () => {
    const data = rowsFiltradas.map((r) => ({
      nivel: NIVEL_LABEL[r.nivel],
      entidad: r.chofer_nombre ?? r.camion_patente ?? "Empresa",
      requisito: r.requisito_nombre,
      estado: ESTADO_LABEL[r.estado],
      vencimiento: r.fecha_vencimiento ? formatFecha(r.fecha_vencimiento) : "—",
      dias:
        r.dias_restantes === null
          ? "—"
          : r.dias_restantes >= 0
          ? `${r.dias_restantes} días`
          : `Vencido ${Math.abs(r.dias_restantes)} días`,
    }));
    exportToExcel({
      filename: `compliance_${CLIENTE_LABEL[cliente]}_${NIVEL_LABEL[tab]}`,
      sheetName: NIVEL_LABEL[tab],
      data,
      columns: [
        { header: "Nivel", key: "nivel" },
        { header: "Entidad", key: "entidad" },
        { header: "Requisito", key: "requisito" },
        { header: "Estado", key: "estado" },
        { header: "Vencimiento", key: "vencimiento" },
        { header: "Días", key: "dias" },
      ],
    });
  };

  // ── Render ──────────────────────────────────────────────────────────────
  const requisitosTabActual = requisitosPorNivel[tab];
  const requisitosVisibles = useMemo(
    () =>
      reqsFiltro.size === 0
        ? requisitosTabActual
        : requisitosTabActual.filter((r) => reqsFiltro.has(r.id)),
    [requisitosTabActual, reqsFiltro],
  );

  return (
    <div className={`${embedded ? "space-y-5" : "p-6 sm:p-8 space-y-5"} print:p-2 print:space-y-3`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap print:hidden">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <ShieldCheck size={22} className="text-primary" />
            Compliance — {CLIENTE_LABEL[cliente]}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Documentación que se presenta al vencimiento, por chofer, unidad y empresa.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} className="border-border">
            <FileSpreadsheet size={14} className="mr-1.5" />
            Exportar
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()} className="border-border">
            <Printer size={14} className="mr-1.5" />
            Imprimir
          </Button>
        </div>
      </div>

      <div className="hidden print:block text-center">
        <h1 className="text-xl font-bold">Compliance — {CLIENTE_LABEL[cliente]}</h1>
        <p className="text-xs text-muted-foreground">
          Generado el {new Date().toLocaleDateString("es-AR")}
        </p>
      </div>

      {/* KPIs */}
      <div className="space-y-3 print:hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <MetricaCard
            icon={<Upload size={13} />}
            label="Cobertura de carga"
            pct={coberturaPct}
            sub={`${cargados}/${totalDocs} documentos cargados`}
            hint="De todo lo que se exige, cuánto se subió al sistema."
          />
          <MetricaCard
            icon={<ShieldCheck size={13} />}
            label="Vigencia"
            pct={vigenciaPct}
            sub={
              cargados > 0
                ? `${resumen.vigente}/${cargados} cargados al día`
                : "Sin documentos cargados"
            }
            hint="De lo que está cargado, cuánto está vigente (no vencido)."
          />
        </div>
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
      </div>

      {/* Tabs de nivel */}
      <div className="flex items-center gap-1 border-b border-border print:hidden overflow-x-auto">
        {NIVELES.map((n) => {
          const reqsN = requisitosPorNivel[n].length;
          if (reqsN === 0) return null;
          const probN = problemasPorNivel[n];
          const activo = tab === n;
          const Icon = NIVEL_ICON[n];
          return (
            <button
              key={n}
              type="button"
              onClick={() => {
                setTab(n);
                setReqsFiltro(new Set());
                setExpandidos(new Set());
              }}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors flex items-center gap-2 whitespace-nowrap ${
                activo
                  ? "text-primary border-primary"
                  : "text-muted-foreground border-transparent hover:text-foreground"
              }`}
            >
              <Icon size={15} />
              {NIVEL_LABEL[n]}
              {probN > 0 && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    activo ? "bg-[#FEE2E2] text-[#991B1B]" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {probN}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Toolbar de filtros */}
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/70" />
          <Input
            placeholder={
              tab === "chofer"
                ? "Buscar chofer o requisito..."
                : tab === "unidad"
                ? "Buscar patente o requisito..."
                : "Buscar requisito..."
            }
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-9"
          />
        </div>

        {tab !== "empresa" && (
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReqsMenuOpen((v) => !v)}
              className="border-border"
            >
              <Filter size={14} className="mr-1.5" />
              Requisitos {reqsFiltro.size > 0 && `(${reqsFiltro.size})`}
            </Button>
            {reqsMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setReqsMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 bg-card border border-border rounded-[8px] shadow-md min-w-[240px] max-h-[320px] overflow-y-auto">
                  <div className="p-2 space-y-1">
                    {requisitosTabActual.map((req) => (
                      <label
                        key={req.id}
                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted/40 rounded cursor-pointer text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={reqsFiltro.has(req.id)}
                          onChange={() => toggleRequisito(req.id)}
                          className="accent-primary"
                        />
                        <span className="text-foreground">{req.nombre}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={soloProblemas}
            onChange={(e) => setSoloProblemas(e.target.checked)}
            className="accent-primary"
          />
          Solo problemas
        </label>

        {tab !== "empresa" && (
          <div className="flex items-center rounded-[8px] border border-border overflow-hidden">
            <VistaToggleButton
              active={vista === "lista"}
              onClick={() => setVista("lista")}
              icon={<Rows3 size={14} />}
              label="Lista"
            />
            <VistaToggleButton
              active={vista === "matriz"}
              onClick={() => setVista("matriz")}
              icon={<Table2 size={14} />}
              label="Matriz"
            />
          </div>
        )}

        {hayFiltros && (
          <Button variant="outline" size="sm" onClick={limpiarFiltros} className="border-border text-muted-foreground">
            <X size={13} className="mr-1.5" />
            Limpiar
          </Button>
        )}

        <div className="ml-auto text-xs text-muted-foreground">
          {rowsFiltradas.length} resultado{rowsFiltradas.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Contenido del tab */}
      {tab === "empresa" ? (
        <EmpresaSection
          requisitos={requisitosVisibles}
          rows={rowsFiltradas}
          canWrite={canWrite}
          onUpload={handleUpload}
          onArchivo={(id) => startTransition(() => abrirSignedUrl(id))}
          onHistorial={(req) => handleHistorial(req, "Empresa")}
        />
      ) : vista === "matriz" ? (
        <MatrizSection
          nivel={tab}
          requisitos={requisitosVisibles}
          rows={rowsFiltradas}
          canWrite={canWrite}
          onUpload={handleUpload}
          onArchivo={(id) => startTransition(() => abrirSignedUrl(id))}
        />
      ) : (
        <ListaEntidadesSection
          nivel={tab}
          requisitos={requisitosVisibles}
          rows={rowsFiltradas}
          canWrite={canWrite}
          expandidos={expandidos}
          onToggleExpandido={toggleExpandido}
          onUpload={handleUpload}
          onArchivo={(id) => startTransition(() => abrirSignedUrl(id))}
          onHistorial={handleHistorial}
        />
      )}

      {dialogState && (
        <CargarComplianceDocDialog
          requisito={dialogState.requisito}
          chofer_id={dialogState.chofer_id}
          camion_id={dialogState.camion_id}
          open={true}
          onOpenChange={(o) => !o && setDialogState(null)}
          onSuccess={() => {
            setDialogState(null);
            router.refresh();
          }}
        />
      )}

      {historialState && (
        <ComplianceHistorialDialog
          requisito={historialState.requisito}
          entidadLabel={historialState.entidadLabel}
          chofer_id={historialState.chofer_id}
          camion_id={historialState.camion_id}
          open={true}
          onOpenChange={(o) => !o && setHistorialState(null)}
        />
      )}
    </div>
  );
}

// ── Vista toggle ───────────────────────────────────────────────────────────
function VistaToggleButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors ${
        active ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

// ── Métrica card (Cobertura / Vigencia) ──────────────────────────────────
function MetricaCard({
  icon,
  label,
  pct,
  sub,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  pct: number | null;
  sub: string;
  hint: string;
}) {
  const tone = pct === null ? "#94A3B8" : pct >= 90 ? "#22C55E" : pct >= 70 ? "#F59E0B" : "#EF4444";
  return (
    <div className="rounded-[8px] border border-border bg-card p-4 shadow-xs" title={hint}>
      <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-muted-foreground/70">
        {icon}
        {label}
      </div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="text-3xl font-bold text-foreground">{pct === null ? "—" : `${pct}%`}</span>
        <span className="text-xs text-muted-foreground">{sub}</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct ?? 0}%`, backgroundColor: tone }}
        />
      </div>
    </div>
  );
}

// ── Resumen card ─────────────────────────────────────────────────────────
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

// ── Lista por entidad (vista híbrida) ────────────────────────────────────
type EntidadAgrupada = {
  id: string;
  label: string;
  rows: ComplianceEstadoRow[];
  counts: Record<ComplianceEstado, number>;
  peorRank: number;
  peorDias: number;
};

function ListaEntidadesSection({
  nivel,
  requisitos,
  rows,
  canWrite,
  expandidos,
  onToggleExpandido,
  onUpload,
  onArchivo,
  onHistorial,
}: {
  nivel: ComplianceNivel;
  requisitos: ComplianceRequisito[];
  rows: ComplianceEstadoRow[];
  canWrite: boolean;
  expandidos: Set<string>;
  onToggleExpandido: (id: string) => void;
  onUpload: (req: ComplianceRequisito, target?: { chofer_id?: string; camion_id?: string }) => void;
  onArchivo: (archivo_id: string) => void;
  onHistorial: (
    req: ComplianceRequisito,
    entidadLabel: string,
    target?: { chofer_id?: string; camion_id?: string },
  ) => void;
}) {
  const reqsById = useMemo(() => {
    const m = new Map<string, ComplianceRequisito>();
    for (const r of requisitos) m.set(r.id, r);
    return m;
  }, [requisitos]);

  const entidades = useMemo(() => {
    const map = new Map<string, EntidadAgrupada>();
    for (const r of rows) {
      const id = nivel === "chofer" ? r.chofer_id : r.camion_id;
      const label = nivel === "chofer" ? r.chofer_nombre : r.camion_patente;
      if (!id || !label) continue;
      let ent = map.get(id);
      if (!ent) {
        ent = {
          id,
          label,
          rows: [],
          counts: { vigente: 0, por_vencer: 0, vencido: 0, faltante: 0 },
          peorRank: 99,
          peorDias: 9999,
        };
        map.set(id, ent);
      }
      ent.rows.push(r);
      ent.counts[r.estado] += 1;
      const rank = ESTADO_RANK[r.estado];
      const dias = r.dias_restantes ?? 9999;
      if (rank < ent.peorRank || (rank === ent.peorRank && dias < ent.peorDias)) {
        ent.peorRank = rank;
        ent.peorDias = dias;
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.peorRank !== b.peorRank) return a.peorRank - b.peorRank;
      if (a.peorDias !== b.peorDias) return a.peorDias - b.peorDias;
      return a.label.localeCompare(b.label);
    });
  }, [rows, nivel]);

  if (entidades.length === 0) return <EmptyState />;

  return (
    <div className="space-y-2">
      {entidades.map((ent) => {
        const abierto = expandidos.has(ent.id);
        const target = nivel === "chofer" ? { chofer_id: ent.id } : { camion_id: ent.id };
        const ordenadas = [...ent.rows].sort((a, b) => {
          const diff = ESTADO_RANK[a.estado] - ESTADO_RANK[b.estado];
          if (diff !== 0) return diff;
          return a.requisito_nombre.localeCompare(b.requisito_nombre);
        });
        return (
          <div key={ent.id} className="bg-card border border-border rounded-[8px] shadow-xs overflow-hidden">
            <button
              type="button"
              onClick={() => onToggleExpandido(ent.id)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
            >
              <ChevronRight
                size={16}
                className={`text-muted-foreground transition-transform shrink-0 ${abierto ? "rotate-90" : ""}`}
              />
              <span className="font-semibold text-foreground text-sm truncate flex-1">{ent.label}</span>
              <EntidadResumen counts={ent.counts} />
            </button>

            {abierto && (
              <div className="border-t border-border divide-y divide-border">
                {ordenadas.map((r) => {
                  const req = reqsById.get(r.requisito_id);
                  if (!req) return null;
                  return (
                    <RequisitoRow
                      key={r.requisito_id}
                      row={r}
                      canWrite={canWrite}
                      onUpload={() => onUpload(req, target)}
                      onArchivo={onArchivo}
                      onHistorial={() => onHistorial(req, ent.label, target)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function EntidadResumen({ counts }: { counts: Record<ComplianceEstado, number> }) {
  const problemas = counts.vencido + counts.por_vencer + counts.faltante;
  if (problemas === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#166534] shrink-0">
        <CheckCircle2 size={14} />
        Al día
      </span>
    );
  }
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {counts.vencido > 0 && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA]">
          {counts.vencido} vencido{counts.vencido !== 1 ? "s" : ""}
        </span>
      )}
      {counts.por_vencer > 0 && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FFFBEB] text-[#92400E] border border-[#FEF3C7]">
          {counts.por_vencer} x vencer
        </span>
      )}
      {counts.faltante > 0 && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted/60 text-muted-foreground border border-border">
          {counts.faltante} falta{counts.faltante !== 1 ? "n" : ""}
        </span>
      )}
    </div>
  );
}

function RequisitoRow({
  row,
  canWrite,
  onUpload,
  onArchivo,
  onHistorial,
}: {
  row: ComplianceEstadoRow;
  canWrite: boolean;
  onUpload: () => void;
  onArchivo: (archivo_id: string) => void;
  onHistorial: () => void;
}) {
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
    <div className="flex items-center gap-3 px-4 py-2.5 pl-11 hover:bg-muted/20">
      <span className={`size-2 rounded-full shrink-0 ${dotColor}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground truncate">{row.requisito_nombre}</p>
        <p className="text-xs text-muted-foreground">
          {row.fecha_vencimiento ? `Vence ${formatFecha(row.fecha_vencimiento)}` : "Sin documento"}
          {sub && <span className="text-muted-foreground/70"> · {sub}</span>}
        </p>
      </div>
      <StatusBadge label={ESTADO_LABEL[estado]} tone={ESTADO_TONE[estado]} />
      <div className="flex items-center gap-1 shrink-0 print:hidden">
        {row.archivo_id && (
          <IconAction title="Ver PDF actual" onClick={() => onArchivo(row.archivo_id!)}>
            <ExternalLink size={14} />
          </IconAction>
        )}
        <IconAction title="Ver historial" onClick={onHistorial}>
          <History size={14} />
        </IconAction>
        {canWrite && (
          <IconAction title={row.archivo_id ? "Reemplazar" : "Cargar"} onClick={onUpload}>
            <Upload size={14} />
          </IconAction>
        )}
      </div>
    </div>
  );
}

function IconAction({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="size-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-primary hover:bg-[#E1F5FE] transition-colors"
    >
      {children}
    </button>
  );
}

// ── Sección empresa (cards) ─────────────────────────────────────────────
function EmpresaSection({
  requisitos,
  rows,
  canWrite,
  onUpload,
  onArchivo,
  onHistorial,
}: {
  requisitos: ComplianceRequisito[];
  rows: ComplianceEstadoRow[];
  canWrite: boolean;
  onUpload: (req: ComplianceRequisito) => void;
  onArchivo: (archivo_id: string) => void;
  onHistorial: (req: ComplianceRequisito) => void;
}) {
  const ordenados = useMemo(() => {
    return [...requisitos].sort((a, b) => {
      const ra = rows.find((r) => r.requisito_id === a.id);
      const rb = rows.find((r) => r.requisito_id === b.id);
      const ea = ra?.estado ?? "faltante";
      const eb = rb?.estado ?? "faltante";
      const diff = ESTADO_RANK[ea] - ESTADO_RANK[eb];
      if (diff !== 0) return diff;
      return a.orden - b.orden;
    });
  }, [requisitos, rows]);

  if (ordenados.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {ordenados.map((req) => {
        const row = rows.find((r) => r.requisito_id === req.id);
        return (
          <RequisitoCard
            key={req.id}
            req={req}
            row={row}
            canWrite={canWrite}
            onUpload={() => onUpload(req)}
            onArchivo={onArchivo}
            onHistorial={() => onHistorial(req)}
          />
        );
      })}
    </div>
  );
}

function RequisitoCard({
  req,
  row,
  canWrite,
  onUpload,
  onArchivo,
  onHistorial,
}: {
  req: ComplianceRequisito;
  row: ComplianceEstadoRow | undefined;
  canWrite: boolean;
  onUpload: () => void;
  onArchivo: (archivo_id: string) => void;
  onHistorial: () => void;
}) {
  const estado = (row?.estado ?? "faltante") as ComplianceEstado;
  return (
    <div className="rounded-[8px] border border-border p-3 flex flex-col gap-2 bg-card shadow-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-semibold text-foreground">{req.nombre}</div>
        <StatusBadge label={ESTADO_LABEL[estado]} tone={ESTADO_TONE[estado]} />
      </div>
      <div className="text-xs text-muted-foreground space-y-0.5">
        {row?.fecha_vencimiento && <p>Vence: {formatFecha(row.fecha_vencimiento)}</p>}
        {row?.dias_restantes !== null && row?.dias_restantes !== undefined && (
          <p>
            {row.dias_restantes >= 0
              ? `${row.dias_restantes} días restantes`
              : `Vencido hace ${Math.abs(row.dias_restantes)} días`}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 pt-1 print:hidden">
        {row?.archivo_id && (
          <button
            type="button"
            onClick={() => onArchivo(row.archivo_id!)}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            <ExternalLink size={11} />
            Ver PDF
          </button>
        )}
        <button
          type="button"
          onClick={onHistorial}
          className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
        >
          <History size={11} />
          Historial
        </button>
        {canWrite && (
          <button
            type="button"
            onClick={onUpload}
            className="text-xs text-primary hover:underline flex items-center gap-1 ml-auto"
          >
            <Upload size={11} />
            {row?.archivo_id ? "Reemplazar" : "Cargar"}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Matriz Choferes / Unidades ──────────────────────────────────────────
function MatrizSection({
  nivel,
  requisitos,
  rows,
  canWrite,
  onUpload,
  onArchivo,
}: {
  nivel: ComplianceNivel;
  requisitos: ComplianceRequisito[];
  rows: ComplianceEstadoRow[];
  canWrite: boolean;
  onUpload: (req: ComplianceRequisito, target?: { chofer_id?: string; camion_id?: string }) => void;
  onArchivo: (archivo_id: string) => void;
}) {
  const entidades = useMemo(() => {
    const map = new Map<string, { id: string; label: string; peorRank: number; peorDias: number }>();
    for (const r of rows) {
      const id = nivel === "chofer" ? r.chofer_id : r.camion_id;
      const label = nivel === "chofer" ? r.chofer_nombre : r.camion_patente;
      if (!id || !label) continue;
      const rank = ESTADO_RANK[r.estado];
      const dias = r.dias_restantes ?? 9999;
      const existing = map.get(id);
      if (!existing) {
        map.set(id, { id, label, peorRank: rank, peorDias: dias });
      } else if (rank < existing.peorRank || (rank === existing.peorRank && dias < existing.peorDias)) {
        map.set(id, { id, label, peorRank: rank, peorDias: dias });
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.peorRank !== b.peorRank) return a.peorRank - b.peorRank;
      if (a.peorDias !== b.peorDias) return a.peorDias - b.peorDias;
      return a.label.localeCompare(b.label);
    });
  }, [rows, nivel]);

  const reqs = useMemo(() => [...requisitos].sort((a, b) => a.orden - b.orden), [requisitos]);

  if (entidades.length === 0 || reqs.length === 0) {
    return <EmptyState />;
  }

  return (
    <section className="bg-card rounded-[8px] border border-border shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/30">
            <tr>
              <th className="text-left px-3 py-2 font-semibold text-foreground sticky left-0 bg-muted/30 z-10">
                {nivel === "chofer" ? "Chofer" : "Patente"}
              </th>
              {reqs.map((req) => (
                <th key={req.id} className="text-left px-2 py-2 font-semibold text-foreground whitespace-nowrap">
                  {req.nombre}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entidades.map((ent) => (
              <tr key={ent.id} className="border-t border-border hover:bg-muted/20">
                <td className="px-3 py-2 font-medium text-foreground sticky left-0 bg-card z-10 whitespace-nowrap">
                  {ent.label}
                </td>
                {reqs.map((req) => {
                  const row = rows.find(
                    (r) =>
                      r.requisito_id === req.id &&
                      ((nivel === "chofer" && r.chofer_id === ent.id) ||
                        (nivel === "unidad" && r.camion_id === ent.id)),
                  );
                  return (
                    <td key={req.id} className="px-2 py-2">
                      <CellBadge
                        row={row}
                        canWrite={canWrite}
                        onUpload={() =>
                          onUpload(req, {
                            chofer_id: nivel === "chofer" ? ent.id : undefined,
                            camion_id: nivel === "unidad" ? ent.id : undefined,
                          })
                        }
                        onArchivo={onArchivo}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CellBadge({
  row,
  canWrite,
  onUpload,
  onArchivo,
}: {
  row: ComplianceEstadoRow | undefined;
  canWrite: boolean;
  onUpload: () => void;
  onArchivo: (archivo_id: string) => void;
}) {
  const estado = (row?.estado ?? "faltante") as ComplianceEstado;
  const tone = ESTADO_TONE[estado];
  const label = ESTADO_LABEL[estado];

  const dias = row?.dias_restantes ?? null;
  const sub =
    estado === "vencido" && dias !== null
      ? `${Math.abs(dias)}d`
      : estado === "por_vencer" && dias !== null
      ? `${dias}d`
      : null;

  const bg =
    tone === "success"
      ? "bg-[#F0FDF4] border-[#BBF7D0] text-[#166534] hover:bg-[#E7FBEE]"
      : tone === "warning"
      ? "bg-[#FFFBEB] border-[#FEF3C7] text-[#92400E] hover:bg-[#FEF7DC]"
      : tone === "error"
      ? "bg-[#FEF2F2] border-[#FECACA] text-[#991B1B] hover:bg-[#FDE7E7]"
      : "bg-muted/30 border-border text-muted-foreground hover:bg-muted/50";

  const disabled = !canWrite && !row?.archivo_id;

  const handleClick = () => {
    if (row?.archivo_id) onArchivo(row.archivo_id);
    else if (canWrite) onUpload();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      title={row?.fecha_vencimiento ? `Vence: ${formatFecha(row.fecha_vencimiento)}` : ""}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-semibold uppercase tracking-wider transition-colors ${bg} ${disabled ? "cursor-default opacity-70" : "cursor-pointer"}`}
    >
      {label}
      {sub && <span className="opacity-70 normal-case font-normal">· {sub}</span>}
    </button>
  );
}

function EmptyState() {
  return (
    <div className="bg-card rounded-[8px] border border-border p-12 text-center">
      <FileX size={36} className="mx-auto text-muted-foreground/60 mb-3" />
      <p className="text-sm text-muted-foreground">Sin resultados con los filtros actuales.</p>
    </div>
  );
}
