"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Check,
  AlertTriangle,
  Upload,
  Pencil,
  History,
  FileText,
  FileX,
  ChevronDown,
  Users,
  Truck,
  FileSpreadsheet,
  Printer,
  MessageSquare,
  Send,
  ShieldCheck,
  CalendarClock,
  SearchX,
} from "lucide-react";
import AvatarPersona from "@/components/ui/AvatarPersona";
import MarcaLogo from "@/components/ui/MarcaLogo";
import {
  type ChoferInfo,
  type ComplianceEstado,
  type ComplianceEstadoRow,
  type ComplianceNivel,
  type ComplianceRequisito,
  type UnidadInfo,
} from "../types";
import CargarComplianceDocDialog, { type EditVencimiento } from "./CargarComplianceDocDialog";
import ComplianceHistorialDialog from "./ComplianceHistorialDialog";
import ComplianceHelpButton from "./ComplianceHelpButton";
import ComplianceRail from "./ComplianceRail";
import TarjetaAlcance from "./TarjetaAlcance";
import {
  ComplianceFiltros,
  ComplianceMetricas,
  ComplianceCategorias,
  FILTROS_VACIOS,
  filaPasaFiltros,
  hayFiltros,
  type FiltrosCompliance,
} from "./ComplianceResumen";
import { getComplianceArchivoParaVerAction } from "../actions";
import VisorArchivo, { type ArchivoParaVer } from "@/components/ui/VisorArchivo";
import { formatFecha } from "@/lib/utils";
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
  /** Ficha de cada chofer por `chofer_id`, para el avatar de su cabecera. */
  choferes?: Record<string, ChoferInfo>;
  /** Momento (ISO) en que el server armó estos datos — lo muestra la columna derecha. */
  generadoEn?: string;
}

const NIVELES: ComplianceNivel[] = ["empresa", "unidad", "chofer"];

/**
 * Si el papel es del ACOPLADO y no del chasis. Lo dice la propia fila: la vista
 * la trae con `acoplado_id`, y el server la engancha a la ficha del chasis que
 * lo lleva puesto (ver `engancharAcopladosASuChasis`).
 */
const esDelAcoplado = (r: ComplianceEstadoRow) => r.acoplado_id != null;

/** De quién es el papel que se está mirando: "VTV · AB742XZ". */
function tituloDeFila(row: ComplianceEstadoRow): string {
  const de = row.chofer_nombre ?? row.camion_patente;
  return de ? `${row.requisito_nombre} · ${de}` : row.requisito_nombre;
}

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
  faltante: "sin cargar",
};

/** El mismo estado para la pastilla, que va sola y arranca la frase. */
const ESTADO_CHIP: Record<ComplianceEstado, string> = {
  vigente: "Al día",
  por_vencer: "Por vencer",
  vencido: "Vencido",
  faltante: "Sin cargar",
};

// Colores de la casilla y el estado, por estado.
const ESTADO_UI: Record<
  ComplianceEstado,
  { bg: string; border: string; fg: string; chip: string; icon: "check" | "alert" | "none" }
> = {
  vigente: { bg: "#F0FDF4", border: "#22C55E", fg: "#166534", chip: "#F0FDF4", icon: "check" },
  por_vencer: { bg: "#FFFBEB", border: "#F59E0B", fg: "#B45309", chip: "#FFFBEB", icon: "check" },
  vencido: { bg: "#FEF2F2", border: "#EF4444", fg: "#B91C1C", chip: "#FEF2F2", icon: "alert" },
  faltante: { bg: "transparent", border: "#94A3B8", fg: "#475569", chip: "#F1F5F9", icon: "none" },
};

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
  // Sin fecha no hay nada que poner: lo dice la pastilla de estado, al lado.
  if (!row.fecha_vencimiento) return "";
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
      // Un acoplado sin chasis enganchado no puede colgar de ninguna ficha:
      // arma la suya, con su patente. Son 3 de 64 al 26/08/2026.
      if (!r.camion_id && r.acoplado_id) {
        id = r.acoplado_id;
        label = r.acoplado_patente ?? "Acoplado sin patente";
      } else {
        id = r.camion_id ?? "sin-camion";
        label = r.camion_patente ?? "Unidad sin patente";
      }
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

/** Con pocos grupos, filtrar los abre solos; con muchos, no (serían 62 unidades). */
const AUTO_ABRIR_HASTA = 25;

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
  choferes,
  generadoEn,
}: Props) {
  const router = useRouter();
  const [refrescando, startTransition] = useTransition();
  const [panelesAbiertos, setPanelesAbiertos] = useState<Set<string>>(
    () => new Set(panelInicial ? [panelInicial] : []),
  );

  const [filtros, setFiltros] = useState<FiltrosCompliance>(FILTROS_VACIOS);
  // Lo que la persona abrió o cerró A MANO. Lo demás lo decide el filtro: con un
  // filtro puesto todo arranca abierto, porque si no se filtra "Vencidos" y la
  // pantalla queda en blanco con los acordeones cerrados.
  const [nivelManual, setNivelManual] = useState<Map<ComplianceNivel, boolean>>(new Map());
  const [grupoManual, setGrupoManual] = useState<Map<string, boolean>>(new Map());
  const [dialogState, setDialogState] = useState<{
    requisito: ComplianceRequisito;
    chofer_id?: string;
    camion_id?: string;
    entidadLabel?: string | null;
    edit?: EditVencimiento;
  } | null>(null);
  const [historialState, setHistorialState] = useState<{
    requisito: ComplianceRequisito;
    entidadLabel: string;
    chofer_id?: string;
    camion_id?: string;
  } | null>(null);
  // El papel abierto en el visor de la aplicación (null = visor cerrado).
  const [visor, setVisor] = useState<{
    archivo: ArchivoParaVer | null;
    cargando: boolean;
    error: string | null;
    titulo: string;
  } | null>(null);

  const checklistRef = useRef<HTMLDivElement>(null);

  const reqById = useMemo(() => {
    const m = new Map<string, ComplianceRequisito>();
    for (const r of requisitos) m.set(r.id, r);
    return m;
  }, [requisitos]);

  const rowsPorNivel = useMemo(() => {
    const m: Record<ComplianceNivel, ComplianceEstadoRow[]> = { empresa: [], unidad: [], chofer: [] };
    for (const r of rows) {
      if (!filaPasaFiltros(r, filtros)) continue;
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
  }, [rows, filtros]);

  // Los tipos que existen en el checklist, para el selector. Salen de las filas
  // y no del catálogo entero: ofrecer un tipo que no tiene ni una fila deja
  // elegir un filtro que sólo puede dar cero.
  const requisitosPresentes = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) m.set(r.requisito_codigo, r.requisito_nombre);
    return [...m.entries()]
      .map(([codigo, nombre]) => ({ codigo, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [rows]);

  const visibles = useMemo(() => NIVELES.flatMap((n) => rowsPorNivel[n]), [rowsPorNivel]);
  const mostrados = visibles.length;
  const filtrando = hayFiltros(filtros);
  /** Con un tipo de documento elegido, agrupar por entidad no agrupa nada. */
  const agrupar = filtros.requisito === "todos";

  /** Cambiar un filtro descarta lo que se abrió a mano: el filtro manda de nuevo. */
  const cambiarFiltros = (f: FiltrosCompliance) => {
    setFiltros(f);
    setNivelManual(new Map());
    setGrupoManual(new Map());
  };

  const irAlChecklist = (f: FiltrosCompliance) => {
    cambiarFiltros(f);
    // Sin esto, tocar un tipo cambia una lista que está 600px más abajo y
    // parece que no pasó nada. Dos cuadros: en el primero React todavía está
    // pintando la lista nueva y el destino queda donde estaba la vieja.
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        checklistRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      ),
    );
  };

  // El papel se mira ACÁ ADENTRO: abrir una pestaña nueva hacía perder la
  // pantalla, el filtro puesto y el lugar de la lista para ver un PDF de una
  // carilla. El visor se abre en "cargando" y después entra el archivo.
  const abrirArchivo = async (archivo_id: string, titulo: string) => {
    setVisor({ archivo: null, cargando: true, error: null, titulo });
    const res = await getComplianceArchivoParaVerAction(archivo_id);
    setVisor((v) =>
      v === null
        ? v
        : "archivo" in res
          ? { ...v, archivo: res.archivo, cargando: false }
          : { ...v, cargando: false, error: res.error },
    );
  };

  /**
   * Abre la ventana de la fila: si ya hay un documento cargado la abre para
   * EDITARLO (con su fecha, sus observaciones y los papeles que ya tiene), y si
   * no, para cargar uno nuevo.
   *
   * Es el mismo camino para los tres accesos —la casilla, el botón "Cargar" y el
   * lápiz—. El lápiz abría siempre una carga en blanco: decía "editar", no traía
   * nada de lo que había y desde ahí no se podía ver el papel guardado.
   */
  const abrirDialogo = (row: ComplianceEstadoRow) => {
    const req = reqById.get(row.requisito_id);
    if (!req) return;
    const target = {
      chofer_id: row.chofer_id ?? undefined,
      camion_id: row.camion_id ?? undefined,
      entidadLabel: row.chofer_nombre ?? row.camion_patente ?? null,
    };
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

  const handleCasilla = (row: ComplianceEstadoRow) => {
    // Sin permiso de escritura la casilla no carga nada: muestra el papel.
    if (!canWrite) {
      if (row.archivo_id) void abrirArchivo(row.archivo_id, tituloDeFila(row));
      return;
    }
    abrirDialogo(row);
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

  const toggleColapso = (n: ComplianceNivel, abierto: boolean) =>
    setNivelManual((prev) => new Map(prev).set(n, !abierto));

  const toggleGroupColapso = (groupId: string, abierto: boolean) =>
    setGrupoManual((prev) => new Map(prev).set(groupId, !abierto));

  const togglePanel = (codigo: string) =>
    setPanelesAbiertos((prev) => {
      const next = new Set(prev);
      if (next.has(codigo)) next.delete(codigo);
      else next.add(codigo);
      return next;
    });

  // El armado del .xlsx corre en el server (export-action.ts); se mandan las
  // filas visibles en el mismo orden del tablero (por nivel).
  const handleExport = () => void exportarComplianceChecklistXlsx(titulo, visibles);

  const hayResultados = mostrados > 0;

  /** Una fila del checklist + su panel desplegable, si el requisito tiene uno. */
  const renderFila = (r: ComplianceEstadoRow, i: number, mostrarEntidad = false) => {
    const panel = renderRowPanel?.(r) ?? null;
    const abierto = panelesAbiertos.has(r.requisito_codigo);
    return (
      <div key={`${r.requisito_id}-${r.chofer_id ?? r.camion_id ?? "emp"}`}>
        <ChecklistRow
          row={r}
          entidadLabel={mostrarEntidad ? r.chofer_nombre ?? r.camion_patente ?? null : null}
          enviarA={reqById.get(r.requisito_id)?.enviar_a ?? null}
          canWrite={canWrite}
          primero={i === 0}
          expandible={panel !== null}
          panelAbierto={abierto}
          onTogglePanel={() => togglePanel(r.requisito_codigo)}
          onCasilla={() => handleCasilla(r)}
          onSubir={() => abrirDialogo(r)}
          onHistorial={() => handleHistorial(r)}
          onAbrirArchivo={() => void abrirArchivo(r.archivo_id!, tituloDeFila(r))}
        />
        {panel !== null && abierto && (
          <div className="border-t border-border bg-muted/20 px-3 sm:px-4 py-4">{panel}</div>
        )}
      </div>
    );
  };

  const checklist = !hayResultados ? (
    <div className="rounded-[12px] border border-border bg-card p-6 text-center sm:p-10">
      <SearchX size={28} className="mx-auto text-muted-foreground/50" aria-hidden />
      <p className="mt-2 text-sm font-medium text-foreground">
        {filtros.estado === "pendientes" || filtros.estado === "vencido"
          ? "No hay nada pendiente con este filtro."
          : "Ningún documento coincide con lo que buscaste."}
      </p>
      {filtrando && (
        <button
          type="button"
          onClick={() => cambiarFiltros(FILTROS_VACIOS)}
          className="mt-2 text-[13px] font-medium text-primary hover:underline"
        >
          Ver los {rows.length} documentos
        </button>
      )}
    </div>
  ) : (
    NIVELES.map((n) => {
      const grupo = rowsPorNivel[n];
      // Un alcance sin coincidencias se muestra igual, apagado: si desaparece,
      // no hay forma de saber si no tiene documentos o si se lo comió el filtro
      // (buscando "VTV" desaparecían Empresa y Choferes sin explicación).
      const vacia = grupo.length === 0;
      // Con un filtro puesto todo arranca abierto; sin filtro, sólo "Empresa"
      // (unidades y choferes son 800 filas).
      const abiertoPorDefecto = filtrando || n === "empresa";
      const abierto = !vacia && (nivelManual.get(n) ?? abiertoPorDefecto);
      // La lista va soldada a la tarjeta cuando es UNA caja; con las fichas de
      // cada unidad o chofer son varias, y ahí la tarjeta cierra sola.
      const soldada = abierto && (n === "empresa" || !agrupar);
      return (
        <section key={n} className={soldada ? "" : "space-y-2"}>
          <TarjetaAlcance
            nivel={n}
            rows={grupo}
            abierto={abierto}
            soldada={soldada}
            vacia={vacia}
            onToggle={() => toggleColapso(n, abierto)}
          />

          {abierto && (() => {
            // Filtrando por UN tipo de documento hay exactamente una fila por
            // chofer/unidad: agrupar deja 78 tarjetas que dicen "ver 1 doc.".
            // Ahí la lista va derecha, con el nombre en cada fila.
            if (n === "empresa" || !agrupar) {
              return (
                <div className="overflow-hidden rounded-b-[12px] border border-border bg-card">
                  {grupo.map((r, i) => renderFila(r, i, n !== "empresa"))}
                </div>
              );
            }

            const groupedEntities = groupRows(grupo, n);
            const grupoAbiertoPorDefecto = filtrando && groupedEntities.length <= AUTO_ABRIR_HASTA;

            return (
              <div className="space-y-3">
                {groupedEntities.map((g) => {
                  const gAbierto = grupoManual.get(g.id) ?? grupoAbiertoPorDefecto;
                  return (
                    <div
                      key={g.id}
                      className="border border-border rounded-[12px] bg-card overflow-hidden shadow-sm"
                    >
                      {/* Cabecera del subgrupo (Chofer / Unidad) */}
                      <button
                        type="button"
                        onClick={() => toggleGroupColapso(g.id, gAbierto)}
                        aria-expanded={gAbierto}
                        title={gAbierto ? "Ocultar documentos" : "Ver documentos"}
                        className={`group w-full text-left bg-muted/30 hover:bg-muted/60 px-3 sm:px-4 py-2.5 flex flex-col items-stretch gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 select-none transition-colors ${
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
                          <GroupHeaderInfo
                            nivel={n}
                            groupId={g.id}
                            label={g.label}
                            unidades={unidades}
                            choferes={choferes}
                          />
                        </div>

                        {/* Indicadores de estado resumidos */}
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] pl-7 sm:pl-0 sm:shrink-0">
                          <span className="text-[11px] font-semibold text-muted-foreground/70 group-hover:text-primary transition-colors sm:mr-1">
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
                              {g.faltantes} sin cargar
                            </span>
                          )}
                          {g.vencidos === 0 && g.porVencer === 0 && g.faltantes === 0 && (
                            <span className="bg-[#F0FDF4] text-[#166534] font-medium px-2 py-0.5 rounded-full border border-[#BBF7D0]">
                              Al día
                            </span>
                          )}
                        </div>
                      </button>

                      {/* Lista de documentos del subgrupo. En las unidades va
                          partida en dos: los papeles del chasis y los de la
                          tolva, cada uno con su patente arriba. Se entra por la
                          misma ficha de siempre; lo único nuevo es que ahora
                          cada papel dice de cuál de las dos patentes es. */}
                      {gAbierto && (() => {
                        const delAcoplado =
                          n === "unidad"
                            ? g.rows.filter(esDelAcoplado)
                            : [];
                        if (delAcoplado.length === 0) {
                          return (
                            <div className="divide-y divide-border">
                              {g.rows.map((r, i) => renderFila(r, i))}
                            </div>
                          );
                        }
                        const delChasis = g.rows.filter((r) => !esDelAcoplado(r));
                        // La patente sale de la propia fila: es la del acoplado
                        // que tenía el papel, no la del vínculo de hoy.
                        const patenteAcoplado =
                          delAcoplado[0]?.acoplado_patente ?? unidades?.[g.id]?.acoplados?.[0] ?? null;
                        return (
                          <>
                            {delChasis.length > 0 && (
                              <>
                                <TiraDeParte titulo="Del chasis" patente={g.label} />
                                <div className="divide-y divide-border">
                                  {delChasis.map((r, i) => renderFila(r, i))}
                                </div>
                              </>
                            )}
                            <TiraDeParte
                              titulo="Del acoplado"
                              patente={patenteAcoplado}
                              sinPatente="sin acoplado enganchado"
                            />
                            <div className="divide-y divide-border">
                              {delAcoplado.map((r, i) => renderFila(r, i))}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </section>
      );
    })
  );

  return (
    <div className={`${embedded ? "space-y-4" : "p-4 sm:p-6 lg:p-8 space-y-4"} print:p-2`}>
      {/* Header propio — sólo cuando la pantalla se usa suelta. Embebida, el
          título y las acciones los pone el contenedor (si no, quedan dos
          títulos, uno debajo del otro). */}
      {!embedded && (
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
          <div className="flex flex-wrap items-center gap-2">
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
      )}

      {/* Dos columnas en pantalla ancha: la pantalla a la izquierda y los
          atajos a la derecha, acompañando todo el scroll. Es `grid` y no
          `flex`: con `minmax(0,1fr)` la columna izquierda nunca puede empujar
          a la derecha fuera de la pantalla (con flex, un hijo ancho desbordaba
          y se comía el borde derecho). Abajo de `xl` la barra lateral de la app
          ya se come el ancho y la columna derecha no se dibuja: todo lo que
          tiene está también en las tarjetas y en el filtro "Alcance". */}
      {/* En qué estás parado: las métricas son el filtro (tocar "Vencidos" deja
          los vencidos). Antes eran tres chips que sólo contaban. Van a todo el
          ancho: metidas en la columna izquierda quedan de 140px y el número
          grande no entra. */}
      <ComplianceMetricas rows={rows} filtros={filtros} onChange={cambiarFiltros} />

      <ComplianceFiltros
        filtros={filtros}
        onChange={cambiarFiltros}
        requisitos={requisitosPresentes}
        mostrados={mostrados}
        total={rows.length}
        onExportarVisibles={handleExport}
      />

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_17rem]">
        {/* El `min-h` es para la columna de al lado: `sticky` sólo se sostiene
            mientras dure la fila de la grilla, y con la lista colapsada la fila
            era más baja que el panel — al llegar al fondo se despegaba de golpe
            y se metía debajo de la barra de arriba. */}
        <div className="min-w-0 space-y-4 xl:min-h-[calc(100dvh-13rem)]">
          <ComplianceCategorias
            rows={rows}
            filtros={filtros}
            onChange={irAlChecklist}
            onCargar={handleCasilla}
            canWrite={canWrite}
          />

          <div ref={checklistRef} className="space-y-4 scroll-mt-4 sm:scroll-mt-[5.25rem]">
            {checklist}
          </div>
        </div>

        {generadoEn && (
          <ComplianceRail
            rows={rows}
            filtros={filtros}
            onChange={cambiarFiltros}
            generadoEn={generadoEn}
            onRefrescar={() => startTransition(() => router.refresh())}
            refrescando={refrescando}
          />
        )}
      </div>

      {dialogState && (
        <CargarComplianceDocDialog
          requisito={dialogState.requisito}
          chofer_id={dialogState.chofer_id}
          camion_id={dialogState.camion_id}
          entidadLabel={dialogState.entidadLabel}
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

      <VisorArchivo
        archivo={visor?.archivo ?? null}
        cargando={visor?.cargando ?? false}
        error={visor?.error ?? null}
        titulo={visor?.titulo}
        open={visor !== null}
        onOpenChange={(o) => !o && setVisor(null)}
      />
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
  choferes,
}: {
  nivel: ComplianceNivel;
  groupId: string;
  label: string;
  unidades?: Record<string, UnidadInfo>;
  choferes?: Record<string, ChoferInfo>;
}) {
  const unidad = nivel === "unidad" ? unidades?.[groupId] : undefined;
  const choferInfo = nivel === "chofer" ? choferes?.[groupId] : undefined;

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
    <>
      {/* La cara y la foto en lugar del iconito repetido: con 78 choferes y 62
          unidades apilados, la fila se encuentra por la imagen mucho antes que
          leyendo el nombre o la patente. La foto del camión es la misma de tapa
          que muestra /camiones; el chofer sin foto lleva la silueta de su área,
          igual que en el legajo. */}
      {nivel === "chofer" ? (
        <AvatarPersona
          name={choferInfo?.nombre ?? label}
          src={choferInfo?.foto_url ?? null}
          rol={choferInfo?.rol}
          size={32}
          className="shrink-0"
        />
      ) : (
        <MarcaLogo marca={unidad?.marca} foto={unidad?.foto_url} patente={label} size={32} />
      )}

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
    </>
  );
}

function ChecklistRow({
  row,
  entidadLabel,
  enviarA,
  canWrite,
  primero,
  expandible = false,
  panelAbierto = false,
  onTogglePanel,
  onCasilla,
  onSubir,
  onHistorial,
  onAbrirArchivo,
}: {
  row: ComplianceEstadoRow;
  /** De quién es la fila. Va sólo cuando la lista no está agrupada por entidad
   *  (si no, el nombre ya está en la cabecera del grupo y se repetiría). */
  entidadLabel?: string | null;
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
  onAbrirArchivo: () => void;
}) {
  const ui = ESTADO_UI[row.estado];
  const tag = tagCliente(row.cliente_aplica);

  return (
    <div
      className={`flex items-center gap-2.5 sm:gap-3 px-3 sm:px-4 py-2.5 hover:bg-muted/20 ${primero ? "" : "border-t border-border"}`}
    >
      {/* Casilla — el cuadrito mide 22px, pero en celular el área táctil se
          extiende con un ::after invisible para llegar a ~38px. */}
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
        className="relative shrink-0 size-[22px] rounded-[6px] border-[1.5px] flex items-center justify-center transition-transform hover:scale-105 max-md:after:absolute max-md:after:-inset-2 max-md:after:content-['']"
        style={{ backgroundColor: ui.bg, borderColor: ui.border }}
      >
        {ui.icon === "check" && <Check size={14} style={{ color: ui.border }} />}
        {ui.icon === "alert" && <AlertTriangle size={13} style={{ color: ui.border }} />}
      </button>

      {/* Nombre + entidad */}
      <div className="min-w-0 flex-1">
        {/* Sin agrupar, el título de la fila es de quién es: el tipo de
            documento ya lo dice el filtro y sería el mismo en las 78 filas. */}
        {entidadLabel && (
          <p className="truncate text-sm font-semibold text-foreground">{entidadLabel}</p>
        )}
        <p
          className={`truncate ${
            entidadLabel ? "text-xs text-muted-foreground" : "text-sm font-medium text-foreground"
          }`}
        >
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
              <span className="hidden sm:inline text-[11px] font-semibold text-muted-foreground/70 group-hover/exp:text-primary transition-colors">
                {panelAbierto ? "Ocultar" : "Ver presentaciones"}
              </span>
            </button>
          ) : (
            row.requisito_nombre
          )}
          {tag && <span className="text-muted-foreground font-normal"> ({tag})</span>}
        </p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
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
          {row.numero && (
            <span className="truncate" title={`Número del documento: ${row.numero}`}>
              N.º {row.numero}
            </span>
          )}
          {row.observaciones && (
            <span className="inline-flex items-center gap-1 italic truncate">
              <MessageSquare size={10} className="shrink-0" />
              {row.observaciones}
            </span>
          )}
        </div>

        {/* Vencimiento + estado — en celular van acá abajo, porque la columna
            de la derecha no entra. En papel manda la columna (print:hidden). */}
        <p className="sm:hidden print:hidden mt-0.5 text-[11px] leading-tight">
          {subFecha(row) && (
            <span style={{ color: row.estado === "vencido" ? "#DC2626" : undefined }}>
              {subFecha(row)}
              {" · "}
            </span>
          )}
          {row.estado === "faltante" && canWrite ? (
            <button
              type="button"
              onClick={onSubir}
              className="inline-flex items-center gap-1 font-semibold text-primary"
            >
              <Upload size={11} />
              Cargar
            </button>
          ) : (
            <span className="font-semibold" style={{ color: ui.fg }}>
              {ESTADO_LABEL[row.estado]}
            </span>
          )}
        </p>
      </div>

      {/* Vencimiento + estado */}
      <div className="hidden shrink-0 items-center gap-2 sm:flex print:flex">
        <p className="text-xs text-right" style={{ color: row.estado === "vencido" ? "#DC2626" : undefined }}>
          {subFecha(row)}
        </p>
        {/* Lo que falta cargar no lleva pastilla sino BOTÓN: "Sin cargar" era
            un cartel gris y la única forma de cargarlo era adivinar que la
            flechita del final servía para eso. Los demás estados sí van en
            pastilla — ahí no hay nada urgente que hacer. */}
        {row.estado === "faltante" && canWrite ? (
          <button
            type="button"
            onClick={onSubir}
            data-tour="btn-cargar"
            className="inline-flex w-[104px] shrink-0 items-center justify-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-2 py-1 text-[12px] font-semibold text-primary transition-colors hover:border-primary/60 hover:bg-primary/10"
            title={`Cargar ${row.requisito_nombre}`}
          >
            <Upload size={13} />
            Cargar
          </button>
        ) : (
          <span
            className="w-[104px] shrink-0 rounded-md px-1.5 py-1 text-center text-[11px] font-semibold"
            style={{ backgroundColor: ui.chip, color: ui.fg }}
          >
            {ESTADO_CHIP[row.estado]}
          </span>
        )}
      </div>

      {/* Acciones — SIEMPRE las mismas tres ranuras: papel · historial · editar.
          La que no aplica va apagada o vacía, pero ocupa su lugar. Con los
          botones apareciendo y desapareciendo, cada fila alineaba distinto y la
          columna quedaba en escalera. */}
      <div
        data-tour={primero ? "acciones-fila" : undefined}
        className="flex items-center gap-0.5 shrink-0 print:hidden"
      >
        {expandible && onTogglePanel && (
          <IconBtn
            title={panelAbierto ? "Ocultar presentaciones" : "Ver presentaciones y fechas límite"}
            onClick={onTogglePanel}
          >
            <CalendarClock size={14} />
          </IconBtn>
        )}
        {/* El papel. Con documento cargado se abre en el visor de la aplicación
            (y el número dice cuántos hay); sin papel, el mismo lugar lleva el
            ícono tachado y en gris: se ve de un saque cuál tiene el respaldo y
            cuál es solo una fecha escrita a mano. */}
        {row.archivo_id ? (
          <IconBtn
            title={
              (row.archivos ?? 1) > 1
                ? `Ver el papel cargado — hay ${row.archivos}, el resto en el historial`
                : "Ver el papel cargado"
            }
            onClick={onAbrirArchivo}
          >
            <FileText size={14} />
            {(row.archivos ?? 0) > 1 && (
              <span className="text-[10px] font-semibold leading-none">{row.archivos}</span>
            )}
          </IconBtn>
        ) : (
          <IconBtn
            title={
              canWrite
                ? "Sin papel cargado — tocá para subirlo"
                : "Sin papel cargado: acá está la fecha, pero no el documento"
            }
            onClick={canWrite ? onSubir : undefined}
            apagado
          >
            <FileX size={14} />
          </IconBtn>
        )}
        <IconBtn title="Ver historial" onClick={onHistorial}>
          <History size={14} />
        </IconBtn>
        {canWrite && row.estado !== "faltante" ? (
          <IconBtn title="Editar vencimiento / reemplazar" onClick={onSubir}>
            <Pencil size={14} />
          </IconBtn>
        ) : (
          <span className="inline-block h-7 min-w-7 max-md:h-9 max-md:min-w-9" aria-hidden />
        )}
      </div>
    </div>
  );
}

/**
 * El renglón que separa los papeles del chasis de los del acoplado, con la
 * patente de cada parte. Va dentro de la ficha de la unidad, no en una sección
 * aparte: quien carga entra por la patente del camión, como siempre.
 */
function TiraDeParte({
  titulo,
  patente,
  sinPatente,
}: {
  titulo: string;
  patente: string | null;
  /** Qué decir cuando esa parte no tiene patente asignada. */
  sinPatente?: string;
}) {
  return (
    <div className="flex items-center gap-2 border-t border-border bg-muted/20 px-3 py-1.5 sm:px-4">
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {titulo}
      </span>
      <span className="text-[12px] font-semibold text-foreground">
        {patente ?? (
          <span className="font-normal italic text-muted-foreground">{sinPatente}</span>
        )}
      </span>
    </div>
  );
}

function IconBtn({
  title,
  onClick,
  children,
  apagado = false,
}: {
  title: string;
  /** Sin `onClick` el botón queda inerte (informa, no hace). */
  onClick?: () => void;
  children: React.ReactNode;
  /** Marca "esto todavía no está": mismo lugar y tamaño, en gris claro. */
  apagado?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={!onClick}
      className={`h-7 min-w-7 px-1 gap-0.5 max-md:h-9 max-md:min-w-9 inline-flex items-center justify-center rounded-md transition-colors ${
        apagado ? "text-muted-foreground/35" : "text-muted-foreground"
      } ${
        onClick
          ? "hover:text-primary hover:bg-[#E1F5FE] cursor-pointer"
          : "cursor-default"
      }`}
    >
      {children}
    </button>
  );
}
