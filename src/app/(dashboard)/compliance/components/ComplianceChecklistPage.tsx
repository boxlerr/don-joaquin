"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  Check,
  AlertTriangle,
  Upload,
  Pencil,
  History,
  Download,
  ChevronDown,
  Users,
  Truck,
  Building2,
  FileSpreadsheet,
  Printer,
  MessageSquare,
  Send,
  ShieldCheck,
} from "lucide-react";
import {
  NIVEL_LABEL,
  type ComplianceEstado,
  type ComplianceEstadoRow,
  type ComplianceNivel,
  type ComplianceRequisito,
} from "../types";
import CargarComplianceDocDialog, { type EditVencimiento } from "./CargarComplianceDocDialog";
import ComplianceHistorialDialog from "./ComplianceHistorialDialog";
import ComplianceHelpButton from "./ComplianceHelpButton";
import { getSignedUrlComplianceArchivoAction } from "../actions";
import { formatFecha } from "@/lib/utils";
import { exportToExcel } from "@/shared/services/excel-export.service";

interface Props {
  titulo: string;
  subtitulo?: string;
  rows: ComplianceEstadoRow[];
  requisitos: ComplianceRequisito[];
  canWrite: boolean;
  /** Cuando es true, omite el padding lateral del root (lo asume el wrapper). */
  embedded?: boolean;
}

const NIVELES: ComplianceNivel[] = ["empresa", "unidad", "chofer"];

const NIVEL_ICON: Record<ComplianceNivel, typeof Users> = {
  empresa: Building2,
  unidad: Truck,
  chofer: Users,
};

const NIVEL_SUB: Record<ComplianceNivel, string> = {
  empresa: "Se presenta una vez para toda la flota",
  unidad: "Uno por cada unidad",
  chofer: "Uno por cada chofer",
};

const ESTADO_RANK: Record<ComplianceEstado, number> = {
  vencido: 0,
  por_vencer: 1,
  faltante: 2,
  vigente: 3,
};

const ESTADO_LABEL: Record<ComplianceEstado, string> = {
  vigente: "al día",
  por_vencer: "por vencer",
  vencido: "vencido",
  faltante: "falta",
};

// Colores de la casilla y el estado, por estado.
const ESTADO_UI: Record<
  ComplianceEstado,
  { bg: string; border: string; fg: string; icon: "check" | "alert" | "none" }
> = {
  vigente: { bg: "#F0FDF4", border: "#22C55E", fg: "#166534", icon: "check" },
  por_vencer: { bg: "#FFFBEB", border: "#F59E0B", fg: "#92400E", icon: "check" },
  vencido: { bg: "#FEF2F2", border: "#EF4444", fg: "#991B1B", icon: "alert" },
  faltante: { bg: "transparent", border: "#94A3B8", fg: "#64748B", icon: "none" },
};

function esPendiente(e: ComplianceEstado): boolean {
  return e === "vencido" || e === "por_vencer" || e === "faltante";
}

function tagCliente(aplica: string): string | null {
  if (aplica === "YPF") return "solo YPF";
  if (aplica === "LOMA_NEGRA") return "solo Loma";
  return null;
}

function subFecha(row: ComplianceEstadoRow): string {
  if (!row.fecha_vencimiento) return "sin cargar";
  const base = `vence ${formatFecha(row.fecha_vencimiento)}`;
  if (row.estado === "vencido" && row.dias_restantes !== null)
    return `venció hace ${Math.abs(row.dias_restantes)} días`;
  if (row.estado === "por_vencer" && row.dias_restantes !== null)
    return `${base} · en ${row.dias_restantes} días`;
  return base;
}

export default function ComplianceChecklistPage({
  titulo,
  subtitulo,
  rows,
  requisitos,
  canWrite,
  embedded = false,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [busqueda, setBusqueda] = useState("");
  const [soloPendientes, setSoloPendientes] = useState(true);
  const [colapsados, setColapsados] = useState<Set<ComplianceNivel>>(new Set());
  const [dialogState, setDialogState] = useState<{
    requisito: ComplianceRequisito;
    chofer_id?: string;
    camion_id?: string;
    edit?: EditVencimiento;
  } | null>(null);
  const [historialState, setHistorialState] = useState<{
    requisito: ComplianceRequisito;
    entidadLabel: string;
    chofer_id?: string;
    camion_id?: string;
  } | null>(null);

  const reqById = useMemo(() => {
    const m = new Map<string, ComplianceRequisito>();
    for (const r of requisitos) m.set(r.id, r);
    return m;
  }, [requisitos]);

  const resumen = useMemo(() => {
    const out: Record<ComplianceEstado, number> = { vigente: 0, por_vencer: 0, vencido: 0, faltante: 0 };
    for (const r of rows) out[r.estado] += 1;
    return out;
  }, [rows]);

  const rowsPorNivel = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const m: Record<ComplianceNivel, ComplianceEstadoRow[]> = { empresa: [], unidad: [], chofer: [] };
    for (const r of rows) {
      if (soloPendientes && !esPendiente(r.estado)) continue;
      if (q) {
        const text = `${r.chofer_nombre ?? ""} ${r.camion_patente ?? ""} ${r.requisito_nombre}`.toLowerCase();
        if (!text.includes(q)) continue;
      }
      m[r.nivel].push(r);
    }
    for (const n of NIVELES) {
      m[n].sort((a, b) => {
        const d = ESTADO_RANK[a.estado] - ESTADO_RANK[b.estado];
        if (d !== 0) return d;
        const ea = a.chofer_nombre ?? a.camion_patente ?? "";
        const eb = b.chofer_nombre ?? b.camion_patente ?? "";
        if (ea !== eb) return ea.localeCompare(eb);
        return a.requisito_nombre.localeCompare(b.requisito_nombre);
      });
    }
    return m;
  }, [rows, busqueda, soloPendientes]);

  const abrirArchivo = async (archivo_id: string, download: boolean) => {
    const res = await getSignedUrlComplianceArchivoAction(archivo_id, { download });
    if ("url" in res && res.url) window.open(res.url, "_blank", "noopener,noreferrer");
    else alert(res.error ?? "No se pudo abrir el archivo");
  };

  const handleCasilla = (row: ComplianceEstadoRow) => {
    if (!canWrite) {
      if (row.archivo_id) startTransition(() => abrirArchivo(row.archivo_id!, false));
      return;
    }
    const req = reqById.get(row.requisito_id);
    if (!req) return;
    const target = { chofer_id: row.chofer_id ?? undefined, camion_id: row.camion_id ?? undefined };
    if (row.documento_id && row.documento_fuente) {
      setDialogState({
        requisito: req,
        ...target,
        edit: {
          documento_id: row.documento_id,
          fuente: row.documento_fuente as EditVencimiento["fuente"],
          fecha_vencimiento: row.fecha_vencimiento,
          observaciones: row.observaciones ?? null,
        },
      });
    } else {
      setDialogState({ requisito: req, ...target });
    }
  };

  const handleSubir = (row: ComplianceEstadoRow) => {
    const req = reqById.get(row.requisito_id);
    if (!req) return;
    setDialogState({ requisito: req, chofer_id: row.chofer_id ?? undefined, camion_id: row.camion_id ?? undefined });
  };

  const handleHistorial = (row: ComplianceEstadoRow) => {
    const req = reqById.get(row.requisito_id);
    if (!req) return;
    setHistorialState({
      requisito: req,
      entidadLabel: row.chofer_nombre ?? row.camion_patente ?? "Empresa",
      chofer_id: row.chofer_id ?? undefined,
      camion_id: row.camion_id ?? undefined,
    });
  };

  const toggleColapso = (n: ComplianceNivel) =>
    setColapsados((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });

  const handleExport = () => {
    const data = NIVELES.flatMap((n) =>
      rowsPorNivel[n].map((r) => ({
        alcance: NIVEL_LABEL[r.nivel],
        entidad: r.chofer_nombre ?? r.camion_patente ?? "Empresa",
        documento: r.requisito_nombre + (tagCliente(r.cliente_aplica) ? ` (${tagCliente(r.cliente_aplica)})` : ""),
        estado: ESTADO_LABEL[r.estado],
        vencimiento: r.fecha_vencimiento ? formatFecha(r.fecha_vencimiento) : "—",
      })),
    );
    exportToExcel({
      filename: `compliance_${slugFilename(titulo)}`,
      sheetName: "Checklist",
      data,
      columns: [
        { header: "Alcance", key: "alcance" },
        { header: "Entidad", key: "entidad" },
        { header: "Documento", key: "documento" },
        { header: "Estado", key: "estado" },
        { header: "Vencimiento", key: "vencimiento" },
      ],
    });
  };

  const hayResultados = NIVELES.some((n) => rowsPorNivel[n].length > 0);

  return (
    <div className={`${embedded ? "space-y-4" : "p-6 sm:p-8 space-y-4"} print:p-2`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap print:hidden">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <ShieldCheck size={22} className="text-primary" />
            {titulo}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {subtitulo ?? "Checklist de documentación con fechas de vencimiento."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ComplianceHelpButton />
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

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/70" />
          <Input
            placeholder="Buscar documento, chofer o unidad…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-9"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer select-none whitespace-nowrap">
          <input
            type="checkbox"
            checked={soloPendientes}
            onChange={(e) => setSoloPendientes(e.target.checked)}
            className="accent-primary"
          />
          Solo pendientes
        </label>
        <div className="flex items-center gap-1.5">
          <Chip n={resumen.vencido} label="vencidos" tone="error" />
          <Chip n={resumen.por_vencer} label="por vencer" tone="warning" />
          <Chip n={resumen.faltante} label="faltan" tone="neutral" />
        </div>
      </div>

      {/* Grupos */}
      {!hayResultados ? (
        <div className="bg-card rounded-[12px] border border-border p-10 text-center text-sm text-muted-foreground">
          {soloPendientes ? "No hay documentos pendientes. Todo al día." : "Sin resultados con la búsqueda actual."}
        </div>
      ) : (
        NIVELES.map((n) => {
          const grupo = rowsPorNivel[n];
          if (grupo.length === 0) return null;
          const Icon = NIVEL_ICON[n];
          const abierto = !colapsados.has(n);
          return (
            <section key={n} className="space-y-2">
              <button
                type="button"
                onClick={() => toggleColapso(n)}
                className="flex items-center gap-2 w-full text-left group"
              >
                <ChevronDown
                  size={15}
                  className={`text-muted-foreground transition-transform ${abierto ? "" : "-rotate-90"}`}
                />
                <Icon size={15} className="text-muted-foreground" />
                <span className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {NIVEL_LABEL[n]} · {NIVEL_SUB[n]}
                </span>
                <span className="text-[11px] text-muted-foreground/70">{grupo.length}</span>
              </button>

              {abierto && (
                <div className="border border-border rounded-[12px] overflow-hidden bg-card">
                  {grupo.map((r, i) => (
                    <ChecklistRow
                      key={`${r.requisito_id}-${r.chofer_id ?? r.camion_id ?? "emp"}`}
                      row={r}
                      nivel={n}
                      enviarA={reqById.get(r.requisito_id)?.enviar_a ?? null}
                      canWrite={canWrite}
                      primero={i === 0}
                      onCasilla={() => handleCasilla(r)}
                      onSubir={() => handleSubir(r)}
                      onHistorial={() => handleHistorial(r)}
                      onDescargar={() => startTransition(() => abrirArchivo(r.archivo_id!, true))}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })
      )}

      {dialogState && (
        <CargarComplianceDocDialog
          requisito={dialogState.requisito}
          chofer_id={dialogState.chofer_id}
          camion_id={dialogState.camion_id}
          edit={dialogState.edit}
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

function ChecklistRow({
  row,
  nivel,
  enviarA,
  canWrite,
  primero,
  onCasilla,
  onSubir,
  onHistorial,
  onDescargar,
}: {
  row: ComplianceEstadoRow;
  nivel: ComplianceNivel;
  enviarA: string | null;
  canWrite: boolean;
  primero: boolean;
  onCasilla: () => void;
  onSubir: () => void;
  onHistorial: () => void;
  onDescargar: () => void;
}) {
  const ui = ESTADO_UI[row.estado];
  const tag = tagCliente(row.cliente_aplica);
  const entidad = nivel === "chofer" ? row.chofer_nombre : nivel === "unidad" ? row.camion_patente : null;

  return (
    <div
      className={`flex items-center gap-3 px-3 sm:px-4 py-2.5 hover:bg-muted/20 ${primero ? "" : "border-t border-border"}`}
    >
      {/* Casilla */}
      <button
        type="button"
        onClick={onCasilla}
        title={
          !canWrite
            ? "Ver documento"
            : row.documento_id
            ? "Editar vencimiento / reemplazar"
            : "Marcar presentado y cargar vencimiento"
        }
        aria-label="Marcar presentado"
        className="shrink-0 size-[22px] rounded-[6px] border-[1.5px] flex items-center justify-center transition-transform hover:scale-105"
        style={{ backgroundColor: ui.bg, borderColor: ui.border }}
      >
        {ui.icon === "check" && <Check size={14} style={{ color: ui.border }} />}
        {ui.icon === "alert" && <AlertTriangle size={13} style={{ color: ui.border }} />}
      </button>

      {/* Nombre + entidad */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground truncate">
          {row.requisito_nombre}
          {tag && <span className="text-muted-foreground font-normal"> ({tag})</span>}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {entidad && <span className="truncate">{entidad}</span>}
          {row.aseguradora && (
            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60 shrink-0">
              {row.aseguradora}
            </span>
          )}
          {enviarA && (
            <span
              className="inline-flex items-center gap-1 truncate text-[#075985]"
              title={`Se manda a: ${enviarA}`}
            >
              <Send size={10} className="shrink-0" />
              {enviarA}
            </span>
          )}
          {row.observaciones && (
            <span className="inline-flex items-center gap-1 italic truncate">
              <MessageSquare size={10} className="shrink-0" />
              {row.observaciones}
            </span>
          )}
        </div>
      </div>

      {/* Vencimiento + estado */}
      <div className="text-right shrink-0 hidden sm:block">
        <p className="text-xs" style={{ color: row.estado === "vencido" ? "#DC2626" : undefined }}>
          {subFecha(row)}
        </p>
        <span className="text-[11px] font-medium" style={{ color: ui.fg }}>
          {ESTADO_LABEL[row.estado]}
        </span>
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-0.5 shrink-0 print:hidden">
        {row.archivo_id && (
          <IconBtn title="Descargar documento" onClick={onDescargar}>
            <Download size={14} />
          </IconBtn>
        )}
        <IconBtn title="Ver historial" onClick={onHistorial}>
          <History size={14} />
        </IconBtn>
        {canWrite && (
          <IconBtn title={row.documento_id ? "Editar vencimiento / reemplazar" : "Cargar"} onClick={onSubir}>
            {row.documento_id ? <Pencil size={14} /> : <Upload size={14} />}
          </IconBtn>
        )}
      </div>
    </div>
  );
}

function IconBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
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

function Chip({ n, label, tone }: { n: number; label: string; tone: "error" | "warning" | "neutral" }) {
  if (n === 0) return null;
  const cls =
    tone === "error"
      ? "bg-[#FEF2F2] text-[#991B1B]"
      : tone === "warning"
      ? "bg-[#FFFBEB] text-[#92400E]"
      : "bg-muted text-muted-foreground";
  return (
    <span className={`text-[11px] font-medium px-2 py-1 rounded-full whitespace-nowrap ${cls}`}>
      {n} {label}
    </span>
  );
}

function slugFilename(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}
