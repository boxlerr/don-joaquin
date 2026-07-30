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
  CalendarClock,
} from "lucide-react";
import {
  NIVEL_LABEL,
  type ComplianceEstado,
  type ComplianceEstadoRow,
  type ComplianceNivel,
  type ComplianceRequisito,
  type UnidadInfo,
} from "../types";
import CargarComplianceDocDialog, { type EditVencimiento } from "./CargarComplianceDocDialog";
import ComplianceHistorialDialog from "./ComplianceHistorialDialog";
import ComplianceHelpButton from "./ComplianceHelpButton";
import { getSignedUrlComplianceArchivoAction } from "../actions";
import { formatFecha } from "@/lib/utils";
import { coincideBusqueda } from "@/lib/texto";
import { exportarComplianceChecklistXlsx } from "../export";

interface Props {
  titulo: string;
  subtitulo?: string;
  rows: ComplianceEstadoRow[];
  requisitos: ComplianceRequisito[];
  canWrite: boolean;
  /** Cuando es true, omite el padding lateral del root (lo asume el wrapper). */
  embedded?: boolean;
  /**
   * Panel desplegable propio de un requisito, que se abre debajo de su fila.
   * Lo usa el F931, que además de la papeleta lleva el seguimiento de períodos
   * (fecha límite, envío a YPF/Loma). Si devuelve null, la fila no es desplegable.
   */
  renderRowPanel?: (row: ComplianceEstadoRow) => React.ReactNode | null;
  /** Código de requisito cuyo panel arranca abierto (deep-link `?plat=931`). */
  panelInicial?: string;
  /** Ficha de cada unidad por `camion_id`, para la cabecera del grupo "Unidades". */
  unidades?: Record<string, UnidadInfo>;
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

// Centinela del seed de carga inicial: unidades que en el Excel vinieron solo con
// patente quedaron con marca/modelo = "Sin datos". No tiene sentido mostrarlo.
const SIN_DATOS = "Sin datos";

// Mismos colores que la tabla de /camiones. "Interno" no se muestra: es el 90% de
// la flota y no aporta nada en la cabecera; solo se marcan las excepciones.
const TERCERIZACION_BADGE: Record<string, { label: string; cls: string }> = {
  en_transicion: { label: "En transición", cls: "bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]" },
  tercerizado: { label: "Tercerizado", cls: "bg-muted text-muted-foreground border-border" },
};

const TIPO_CAMION_LABEL: Record<string, string> = {
  tractor: "Tractor",
  chasis_rigido: "Chasis rígido",
  batea: "Batea",
  otro: "Otro",
};

/**
 * Ficha corta de la unidad para la cabecera, en el mismo orden que /camiones:
 * marca+modelo · año · capacidad · tipo · km · acoplado. Omite lo que está vacío
 * y el tipo "tractor" (61 de 62 unidades: no discrimina).
 */
function metaUnidad(u: UnidadInfo): string[] {
  const out: string[] = [];
  const marca = u.marca && u.marca !== SIN_DATOS ? u.marca : null;
  const modelo = u.modelo && u.modelo !== SIN_DATOS ? u.modelo : null;
  const marcaModelo = [marca, modelo].filter(Boolean).join(" ");
  if (marcaModelo) out.push(marcaModelo);
  if (u.ano) out.push(String(u.ano));
  if (u.capacidad_tn !== null) out.push(`${u.capacidad_tn.toFixed(1)} TN`);
  if (u.tipo_camion && u.tipo_camion !== "tractor")
    out.push(TIPO_CAMION_LABEL[u.tipo_camion] ?? u.tipo_camion);
  if (u.km_actual !== null) out.push(`${u.km_actual.toLocaleString("es-AR")} km`);
  if (u.acoplados.length) out.push(`Acoplado ${u.acoplados.join(" + ")}`);
  return out;
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

interface EntityGroup {
  id: string;
  label: string;
  rows: ComplianceEstadoRow[];
  vencidos: number;
  porVencer: number;
  faltantes: number;
}

function groupRows(rows: ComplianceEstadoRow[], nivel: ComplianceNivel): EntityGroup[] {
  const groupsMap = new Map<string, EntityGroup>();

  for (const r of rows) {
    let id = "";
    let label = "";

    if (nivel === "chofer") {
      id = r.chofer_id ?? "sin-chofer";
      label = r.chofer_nombre ?? "Chofer sin nombre";
    } else if (nivel === "unidad") {
      id = r.camion_id ?? "sin-camion";
      label = r.camion_patente ?? "Unidad sin patente";
    } else {
      id = "empresa";
      label = "Empresa";
    }

    let g = groupsMap.get(id);
    if (!g) {
      g = {
        id,
        label,
        rows: [],
        vencidos: 0,
        porVencer: 0,
        faltantes: 0,
      };
      groupsMap.set(id, g);
    }
    g.rows.push(r);
    if (r.estado === "vencido") g.vencidos++;
    else if (r.estado === "por_vencer") g.porVencer++;
    else if (r.estado === "faltante") g.faltantes++;
  }

  return Array.from(groupsMap.values()).sort((a, b) => {
    if (b.vencidos !== a.vencidos) return b.vencidos - a.vencidos;
    if (b.porVencer !== a.porVencer) return b.porVencer - a.porVencer;
    if (b.faltantes !== a.faltantes) return b.faltantes - a.faltantes;
    return a.label.localeCompare(b.label);
  });
}

export default function ComplianceChecklistPage({
  titulo,
  subtitulo,
  rows,
  requisitos,
  canWrite,
  embedded = false,
  renderRowPanel,
  panelInicial,
  unidades,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [panelesAbiertos, setPanelesAbiertos] = useState<Set<string>>(
    () => new Set(panelInicial ? [panelInicial] : []),
  );

  const [busqueda, setBusqueda] = useState("");
  const [soloPendientes, setSoloPendientes] = useState(false);
  const [colapsados, setColapsados] = useState<Set<ComplianceNivel>>(() => new Set(["unidad", "chofer"]));
  const [groupsExpandidos, setGroupsExpandidos] = useState<Set<string>>(new Set());
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
    const q = busqueda.trim();
    const m: Record<ComplianceNivel, ComplianceEstadoRow[]> = { empresa: [], unidad: [], chofer: [] };
    for (const r of rows) {
      if (soloPendientes && !esPendiente(r.estado)) continue;
      if (q) {
        const text = `${r.chofer_nombre ?? ""} ${r.camion_patente ?? ""} ${r.requisito_nombre}`;
        if (!coincideBusqueda(text, q)) continue;
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

  const toggleGroupColapso = (groupId: string) =>
    setGroupsExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });

  const togglePanel = (codigo: string) =>
    setPanelesAbiertos((prev) => {
      const next = new Set(prev);
      if (next.has(codigo)) next.delete(codigo);
      else next.add(codigo);
      return next;
    });

  const handleExport = () => {
    // El armado del .xlsx corre en el server (export-action.ts); se mandan las
    // filas visibles en el mismo orden del tablero (por nivel).
    void exportarComplianceChecklistXlsx(titulo, NIVELES.flatMap((n) => rowsPorNivel[n]));
  };

  const hayResultados = NIVELES.some((n) => rowsPorNivel[n].length > 0);

  /** Una fila del checklist + su panel desplegable, si el requisito tiene uno. */
  const renderFila = (r: ComplianceEstadoRow, i: number, n: ComplianceNivel) => {
    const panel = renderRowPanel?.(r) ?? null;
    const abierto = panelesAbiertos.has(r.requisito_codigo);
    return (
      <div key={`${r.requisito_id}-${r.chofer_id ?? r.camion_id ?? "emp"}`}>
        <ChecklistRow
          row={r}
          nivel={n}
          enviarA={reqById.get(r.requisito_id)?.enviar_a ?? null}
          canWrite={canWrite}
          primero={i === 0}
          expandible={panel !== null}
          panelAbierto={abierto}
          onTogglePanel={() => togglePanel(r.requisito_codigo)}
          onCasilla={() => handleCasilla(r)}
          onSubir={() => handleSubir(r)}
          onHistorial={() => handleHistorial(r)}
          onDescargar={() => startTransition(() => abrirArchivo(r.archivo_id!, true))}
        />
        {panel !== null && abierto && (
          <div className="border-t border-border bg-muted/20 px-3 sm:px-4 py-4">{panel}</div>
        )}
      </div>
    );
  };

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
                aria-expanded={abierto}
                className="flex items-center gap-2 w-full text-left group rounded-lg -mx-2 px-2 py-1.5 hover:bg-muted/40 transition-colors"
              >
                {/* Chevron en caja: sin esto la cabecera se leía como un título y
                    no como algo que se puede abrir. */}
                <span
                  className={`flex items-center justify-center size-[22px] shrink-0 rounded-md border border-border bg-card text-muted-foreground transition-all group-hover:border-primary/50 group-hover:text-primary ${
                    abierto ? "" : "-rotate-90"
                  }`}
                >
                  <ChevronDown size={14} />
                </span>
                <Icon size={15} className="text-muted-foreground" />
                <span className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {NIVEL_LABEL[n]} · {NIVEL_SUB[n]}
                </span>
                <span className="text-[11px] text-muted-foreground/70">{grupo.length}</span>
                <span className="ml-auto text-[11px] font-semibold text-muted-foreground/70 group-hover:text-primary transition-colors">
                  {abierto ? "Ocultar" : "Mostrar"}
                </span>
              </button>

              {abierto && (() => {
                if (n === "empresa") {
                  return (
                    <div className="border border-border rounded-[12px] overflow-hidden bg-card">
                      {grupo.map((r, i) => renderFila(r, i, n))}
                    </div>
                  );
                }

                const groupedEntities = groupRows(grupo, n);

                return (
                  <div className="space-y-3">
                    {groupedEntities.map((g) => {
                      const gAbierto = groupsExpandidos.has(g.id);
                      const SubIcon = n === "chofer" ? Users : Truck;
                      return (
                        <div
                          key={g.id}
                          className="border border-border rounded-[12px] bg-card overflow-hidden shadow-sm"
                        >
                          {/* Cabecera del subgrupo (Chofer / Unidad) */}
                          <button
                            type="button"
                            onClick={() => toggleGroupColapso(g.id)}
                            aria-expanded={gAbierto}
                            title={gAbierto ? "Ocultar documentos" : "Ver documentos"}
                            className={`group w-full text-left bg-muted/30 hover:bg-muted/60 px-4 py-2.5 flex items-center justify-between gap-3 select-none transition-colors ${
                              gAbierto ? "border-b border-border" : ""
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {/* Chevron en caja + contador: la fila tiene que
                                  leerse como "esto se abre", no como un título. */}
                              <span
                                className={`flex items-center justify-center size-5 shrink-0 rounded-md border border-border bg-card text-muted-foreground transition-all group-hover:border-primary/50 group-hover:text-primary ${
                                  gAbierto ? "" : "-rotate-90"
                                }`}
                              >
                                <ChevronDown size={13} />
                              </span>
                              <SubIcon size={14} className="shrink-0 text-muted-foreground/80" />
                              <GroupHeaderInfo nivel={n} groupId={g.id} label={g.label} unidades={unidades} />
                            </div>

                            {/* Indicadores de estado resumidos */}
                            <div className="flex items-center gap-1.5 text-[10px] shrink-0">
                              <span className="hidden sm:inline text-[11px] font-semibold text-muted-foreground/70 group-hover:text-primary transition-colors mr-1">
                                {gAbierto ? "Ocultar" : `Ver ${g.rows.length} doc.`}
                              </span>
                              {g.vencidos > 0 && (
                                <span className="bg-[#FEF2F2] text-[#991B1B] font-medium px-2 py-0.5 rounded-full border border-[#FECACA]">
                                  {g.vencidos} vencido{g.vencidos > 1 ? "s" : ""}
                                </span>
                              )}
                              {g.porVencer > 0 && (
                                <span className="bg-[#FFFBEB] text-[#92400E] font-medium px-2 py-0.5 rounded-full border border-[#FDE68A]">
                                  {g.porVencer} por vencer
                                </span>
                              )}
                              {g.faltantes > 0 && (
                                <span className="bg-muted text-muted-foreground font-medium px-2 py-0.5 rounded-full border border-border">
                                  {g.faltantes} falta{g.faltantes > 1 ? "s" : ""}
                                </span>
                              )}
                              {g.vencidos === 0 && g.porVencer === 0 && g.faltantes === 0 && (
                                <span className="bg-[#F0FDF4] text-[#166534] font-medium px-2 py-0.5 rounded-full border border-[#BBF7D0]">
                                  Al día
                                </span>
                              )}
                            </div>
                          </button>

                          {/* Lista de documentos del subgrupo */}
                          {gAbierto && (
                            <div className="divide-y divide-border">
                              {g.rows.map((r, i) => renderFila(r, i, n))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
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

/**
 * Cabecera de un grupo (unidad o chofer): patente/nombre + la ficha de datos que
 * tenemos cargada. En "unidad" muestra marca/modelo/año/capacidad/acoplado y el
 * chofer que la maneja; en "chofer", la unidad que tiene asignada. La asignación
 * sale de `camiones.chofer_actual_id`, la misma que reescribe la planilla diaria,
 * así que un cambio de camión se refleja acá al instante.
 */
function GroupHeaderInfo({
  nivel,
  groupId,
  label,
  unidades,
}: {
  nivel: ComplianceNivel;
  groupId: string;
  label: string;
  unidades?: Record<string, UnidadInfo>;
}) {
  const unidad = nivel === "unidad" ? unidades?.[groupId] : undefined;

  // En el grupo "chofer" mostramos la unidad que maneja (relación inversa).
  const unidadDelChofer =
    nivel === "chofer" && unidades
      ? Object.values(unidades).find((u) => u.chofer_id === groupId)
      : undefined;

  const terc = unidad?.tercerizacion_estado
    ? TERCERIZACION_BADGE[unidad.tercerizacion_estado]
    : undefined;

  const partes = unidad ? metaUnidad(unidad) : [];
  const chofer = unidad?.chofer_nombre ?? null;

  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-foreground">{label}</span>
        {terc && (
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${terc.cls}`}>
            {terc.label}
          </span>
        )}
      </div>

      {(partes.length > 0 || unidad || unidadDelChofer) && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground truncate">
          {partes.length > 0 && <span className="truncate">{partes.join(" · ")}</span>}

          {unidad && (
            <>
              {partes.length > 0 && <span className="text-muted-foreground/40">·</span>}
              <span
                className={`inline-flex items-center gap-1 shrink-0 ${
                  chofer ? "text-[#075985] font-medium" : "italic"
                }`}
                title={chofer ? `Chofer asignado: ${chofer}` : "Sin chofer asignado"}
              >
                <Users size={10} className="shrink-0" />
                {chofer ?? "Sin chofer"}
              </span>
            </>
          )}

          {unidadDelChofer && (
            <span
              className="inline-flex items-center gap-1 shrink-0 text-[#075985] font-medium"
              title={`Unidad asignada: ${unidadDelChofer.patente}`}
            >
              <Truck size={10} className="shrink-0" />
              {unidadDelChofer.patente}
            </span>
          )}
        </div>
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
  expandible = false,
  panelAbierto = false,
  onTogglePanel,
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
  /** El requisito tiene panel propio (ej. los períodos del F931). */
  expandible?: boolean;
  panelAbierto?: boolean;
  onTogglePanel?: () => void;
  onCasilla: () => void;
  onSubir: () => void;
  onHistorial: () => void;
  onDescargar: () => void;
}) {
  const ui = ESTADO_UI[row.estado];
  const tag = tagCliente(row.cliente_aplica);
  const entidad = null;

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
          {expandible ? (
            <button
              type="button"
              onClick={onTogglePanel}
              aria-expanded={panelAbierto}
              className="group/exp inline-flex items-center gap-1.5 hover:text-primary transition-colors"
              title={panelAbierto ? "Ocultar presentaciones" : "Ver presentaciones y fechas límite"}
            >
              {row.requisito_nombre}
              <span
                className={`flex items-center justify-center size-[18px] rounded-md border border-border bg-card text-muted-foreground transition-all group-hover/exp:border-primary/50 group-hover/exp:text-primary ${
                  panelAbierto ? "" : "-rotate-90"
                }`}
              >
                <ChevronDown size={12} />
              </span>
              <span className="text-[11px] font-semibold text-muted-foreground/70 group-hover/exp:text-primary transition-colors">
                {panelAbierto ? "Ocultar" : "Ver presentaciones"}
              </span>
            </button>
          ) : (
            row.requisito_nombre
          )}
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
        {expandible && onTogglePanel && (
          <IconBtn
            title={panelAbierto ? "Ocultar presentaciones" : "Ver presentaciones y fechas límite"}
            onClick={onTogglePanel}
          >
            <CalendarClock size={14} />
          </IconBtn>
        )}
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
