"use client";

import { Fragment, useMemo, useState } from "react";
import {
  FileText,
  CalendarClock,
  AlertTriangle,
  CheckCircle2,
  FileX,
  Search,
  X,
  ChevronDown,
  FileSpreadsheet,
} from "lucide-react";

import MetricCard from "@/components/ui/MetricCard";
import { Combobox } from "@/components/ui/combobox";
import { coincideBusqueda } from "@/lib/texto";
import { formatFecha } from "@/lib/utils";
import FiltrosAvanzadosCompliance from "./FiltrosAvanzadosCompliance";
import IlustracionCompliance, { type IlustracionNombre } from "./IlustracionCompliance";
import type { ComplianceEstado, ComplianceEstadoRow, ComplianceNivel } from "../types";

/**
 * Cabecera de Compliance: en qué estás parado y cómo acotarlo.
 *
 * Trae a Compliance lo que ya funcionó en Legajos: las métricas arriba **y que
 * sean el filtro** (tocar "Vencidos" deja los vencidos, no abre otra pantalla),
 * y una barra de filtros siempre visible en vez de un checkbox suelto.
 *
 * Antes esta pantalla eran 739 documentos detrás de tres acordeones cerrados,
 * un buscador y un "Solo pendientes". Para saber cuántas VTV estaban vencidas
 * había que abrir "Unidades" y contar a ojo.
 *
 * Sobre el color: va en el número y en el ícono, nunca en el fondo de la
 * tarjeta. Es la misma regla que en Legajos y en el resto del sistema — un
 * fondo de color entero se lee como un error y no como un dato.
 */

export type FiltroEstado = ComplianceEstado | "todos" | "pendientes";
/** A qué plataforma va el documento (`cliente_aplica` de la papeleta). */
export type FiltroPlataforma = "todos" | "AMBOS" | "YPF" | "LOMA_NEGRA";
/** Si el papel está digitalizado o solo se anotó el vencimiento. */
export type FiltroArchivo = "todos" | "con" | "sin";
/** Ventana de vencimiento en días, contada desde hoy. */
export type FiltroVence = "todos" | "30" | "60" | "90";

export type FiltrosCompliance = {
  busqueda: string;
  estado: FiltroEstado;
  nivel: ComplianceNivel | "todos";
  /** `requisito_codigo`, o "todos". Es el "tipo de documento". */
  requisito: string;
  plataforma: FiltroPlataforma;
  archivo: FiltroArchivo;
  vence: FiltroVence;
};

export const FILTROS_VACIOS: FiltrosCompliance = {
  busqueda: "",
  estado: "todos",
  nivel: "todos",
  requisito: "todos",
  plataforma: "todos",
  archivo: "todos",
  vence: "todos",
};

/** Cuántos filtros hay puestos. Cero = estás viendo todo. */
export function contarFiltros(f: FiltrosCompliance): number {
  let n = 0;
  if (f.busqueda.trim() !== "") n++;
  if (f.estado !== "todos") n++;
  if (f.nivel !== "todos") n++;
  if (f.requisito !== "todos") n++;
  if (f.plataforma !== "todos") n++;
  if (f.archivo !== "todos") n++;
  if (f.vence !== "todos") n++;
  return n;
}

export function hayFiltros(f: FiltrosCompliance): boolean {
  return contarFiltros(f) > 0;
}

const NIVEL_LABEL_CORTO: Record<ComplianceNivel | "todos", string> = {
  todos: "Todas",
  empresa: "De la empresa",
  unidad: "Por unidad",
  chofer: "Por chofer",
};

const ESTADO_OPCIONES: { value: FiltroEstado; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "pendientes", label: "Pendientes (lo que falta)" },
  { value: "vencido", label: "Vencidos" },
  { value: "por_vencer", label: "Por vencer" },
  { value: "faltante", label: "Sin cargar" },
  { value: "vigente", label: "Al día" },
];

/** Igual que en la tabla: pendiente es todo lo que exige una acción. */
export function esPendienteEstado(e: ComplianceEstado): boolean {
  return e === "vencido" || e === "por_vencer" || e === "faltante";
}

export function aplicaFiltroEstado(estado: ComplianceEstado, f: FiltroEstado): boolean {
  if (f === "todos") return true;
  if (f === "pendientes") return esPendienteEstado(estado);
  return estado === f;
}

/**
 * El único lugar donde se decide si una fila entra o no. Es puro a propósito:
 * la tabla, el recuento de "mostrando N de M" y el export tienen que coincidir
 * siempre, y eso solo se garantiza si los tres preguntan lo mismo.
 */
export function filaPasaFiltros(r: ComplianceEstadoRow, f: FiltrosCompliance): boolean {
  if (!aplicaFiltroEstado(r.estado, f.estado)) return false;
  if (f.nivel !== "todos" && r.nivel !== f.nivel) return false;
  if (f.requisito !== "todos" && r.requisito_codigo !== f.requisito) return false;
  if (f.plataforma !== "todos" && r.cliente_aplica !== f.plataforma) return false;
  if (f.archivo === "con" && !r.archivo_id) return false;
  if (f.archivo === "sin" && r.archivo_id) return false;
  if (f.vence !== "todos") {
    const d = r.dias_restantes;
    if (d === null || d < 0 || d > Number(f.vence)) return false;
  }
  const q = f.busqueda.trim();
  if (q) {
    const texto = `${r.chofer_nombre ?? ""} ${r.camion_patente ?? ""} ${r.requisito_nombre} ${
      r.observaciones ?? ""
    } ${r.aseguradora ?? ""}`;
    if (!coincideBusqueda(texto, q)) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------

const TRIGGER_DESNUDO =
  "h-9 sm:h-7 min-w-0 flex-1 rounded-none border-0 bg-transparent px-0 text-sm font-semibold text-foreground shadow-none hover:bg-transparent focus-visible:border-0 focus-visible:ring-0";

/** Campo de la barra: rótulo chico arriba, valor abajo. Igual que en Legajos. */
function Campo({
  label,
  children,
  adorno,
}: {
  label: string;
  children: React.ReactNode;
  adorno?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col justify-center rounded-lg border border-border bg-card px-3 py-1.5 transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20 sm:h-[52px] sm:flex-1">
      <span className="text-[11px] leading-none text-muted-foreground">{label}</span>
      <div className="mt-0.5 flex items-center gap-1.5">
        {adorno}
        {children}
      </div>
    </div>
  );
}

export function ComplianceFiltros({
  filtros,
  onChange,
  requisitos,
  mostrados,
  total,
  onExportarVisibles,
}: {
  filtros: FiltrosCompliance;
  onChange: (f: FiltrosCompliance) => void;
  /** Tipos de documento presentes en las filas, con su nombre. */
  requisitos: { codigo: string; nombre: string }[];
  mostrados: number;
  total: number;
  /** Exporta el recorte que se está viendo (no todo el checklist). */
  onExportarVisibles?: () => void;
}) {
  const set = <K extends keyof FiltrosCompliance>(k: K, v: FiltrosCompliance[K]) =>
    onChange({ ...filtros, [k]: v });

  const puestos = contarFiltros(filtros);

  return (
    // Dos hermanos y no un contenedor: `sticky` sólo corre dentro de su padre, y
    // envuelto en un `<div>` propio la barra no tendría por dónde desplazarse
    // (el padre mediría lo mismo que ella). Sueltos, el padre es la pantalla.
    <>
      {/* La fila de campos queda pegada arriba al scrollear: la lista tiene 848
          filas y perder el buscador a mitad de camino obliga a volver arriba.
          Sólo la fila —la línea de "mostrando N de M" queda abajo, en el flujo—
          así la franja pegada mide siempre lo mismo (68px) y la columna derecha
          puede apoyarse justo debajo. En celular no: apilada son 280px de alto
          y se comería la pantalla. */}
      <div className="-mx-4 bg-background px-4 print:hidden sm:sticky sm:top-0 sm:z-30 sm:-mx-6 sm:border-b sm:border-border sm:px-6 sm:py-2 lg:-mx-8 lg:px-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Campo label="Buscar" adorno={<Search size={13} className="shrink-0 text-muted-foreground" />}>
            <input
              value={filtros.busqueda}
              onChange={(e) => set("busqueda", e.target.value)}
              placeholder="Documento, chofer o unidad…"
              aria-label="Buscar en el checklist"
              className="h-9 min-w-0 flex-1 border-0 bg-transparent p-0 text-sm font-semibold text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground sm:h-7"
            />
            {filtros.busqueda && (
              <button
                type="button"
                onClick={() => set("busqueda", "")}
                aria-label="Limpiar la búsqueda"
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                <X size={13} />
              </button>
            )}
          </Campo>

          {/* Desplegables estilados (no `<select>` nativo) y con buscador cuando la
              lista es larga: los tipos de documento son 20. */}
          <Campo label="Tipo de documento">
            <Combobox
              value={filtros.requisito}
              onValueChange={(v) => set("requisito", v || "todos")}
              options={[
                { id: "todos", label: "Todos" },
                ...requisitos.map((r) => ({ id: r.codigo, label: r.nombre })),
              ]}
              triggerClassName={TRIGGER_DESNUDO}
              searchPlaceholder="Buscar tipo…"
              aria-label="Tipo de documento"
            />
          </Campo>

          <Campo label="Estado">
            <Combobox
              value={filtros.estado}
              onValueChange={(v) => set("estado", (v || "todos") as FiltroEstado)}
              options={ESTADO_OPCIONES.map((o) => ({ id: o.value, label: o.label }))}
              searchable={false}
              triggerClassName={TRIGGER_DESNUDO}
              aria-label="Estado"
            />
          </Campo>

          <Campo label="Alcance">
            <Combobox
              value={filtros.nivel}
              onValueChange={(v) => set("nivel", (v || "todos") as ComplianceNivel | "todos")}
              options={(["todos", "empresa", "unidad", "chofer"] as const).map((n) => ({
                id: n,
                label: NIVEL_LABEL_CORTO[n],
              }))}
              searchable={false}
              triggerClassName={TRIGGER_DESNUDO}
              aria-label="Alcance"
            />
          </Campo>

          <FiltrosAvanzadosCompliance filtros={filtros} onChange={onChange} />
        </div>
      </div>

      {/* El recuento y el "limpiar" van juntos: es la línea que dice si lo que
          estás mirando es todo o un recorte. Sin esto, un filtro puesto y
          olvidado hace creer que faltan documentos. */}
      {puestos > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-[12px] text-muted-foreground print:hidden">
          <span>
            Mostrando <span className="font-semibold text-foreground tabular-nums">{mostrados}</span> de{" "}
            <span className="tabular-nums">{total}</span> documentos
          </span>
          {onExportarVisibles && mostrados > 0 && (
            <button
              type="button"
              onClick={onExportarVisibles}
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              <FileSpreadsheet size={12} />
              Exportar estos {mostrados}
            </button>
          )}
          <button
            type="button"
            onClick={() => onChange(FILTROS_VACIOS)}
            className="ml-auto inline-flex items-center gap-1 font-medium text-primary hover:underline"
          >
            <X size={12} />
            Limpiar {puestos} filtro{puestos !== 1 ? "s" : ""}
          </button>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------

/**
 * Las cinco métricas. Cada una es un filtro: tocar "Vencidos" deja los
 * vencidos. En el mockup eran cinco "Ver todos" que no llevaban a ningún lado;
 * acá el número y el filtro son la misma cosa.
 */
export function ComplianceMetricas({
  rows,
  filtros,
  onChange,
}: {
  rows: ComplianceEstadoRow[];
  filtros: FiltrosCompliance;
  onChange: (f: FiltrosCompliance) => void;
}) {
  const c = useMemo(() => {
    const out = { total: rows.length, vigente: 0, por_vencer: 0, vencido: 0, faltante: 0 };
    for (const r of rows) out[r.estado] += 1;
    return out;
  }, [rows]);

  const irA = (estado: FiltroEstado) =>
    onChange({ ...filtros, estado: filtros.estado === estado ? "todos" : estado });

  // La tarjeta activa se marca: si no, no se ve cuál de las cinco está
  // filtrando. "Total" no se marca nunca: sin filtro quedaría siempre resaltada
  // y parecería que hay un recorte puesto.
  const marca = (estado: FiltroEstado) =>
    filtros.estado === estado ? "ring-2 ring-primary/40 rounded-[8px]" : "";

  return (
    // "Al día" va primero: es lo único que contesta "¿cómo venimos?" de un
    // vistazo, y estaba al final después de tres números de problemas.
    // `flex-wrap` y no `grid`: con una grilla de N columnas fijas, el ancho que
    // no da para cinco deja la última tarjeta sola con un hueco al lado (se veía
    // "Al día" flotando). Con `flex-1` las de la última fila se estiran y el
    // renglón siempre queda lleno, entren 2, 3, 4 o 5.
    <div className="flex flex-wrap gap-2.5 sm:gap-3 print:hidden">
      <div className={`flex min-w-0 flex-1 basis-[9.5rem] ${marca("vigente")}`}>
        <MetricCard
          art={<IlustracionCompliance nombre="al-dia" size={42} />}
          label="Al día"
          value={String(c.vigente)}
          sub="Vigentes"
          icon={CheckCircle2}
          color="#22C55E"
          onClick={() => irA("vigente")}
          ariaLabel="Ver solo los que están al día"
        />
      </div>
      <div className="flex min-w-0 flex-1 basis-[9.5rem]">
        <MetricCard
          art={<IlustracionCompliance nombre="total" size={42} />}
          label="Total"
          value={String(c.total)}
          sub="Documentos exigidos"
          icon={FileText}
          tone="brand"
          onClick={() => onChange({ ...filtros, estado: "todos" })}
          ariaLabel="Ver todos los documentos"
        />
      </div>
      <div className={`flex min-w-0 flex-1 basis-[9.5rem] ${marca("vencido")}`}>
        <MetricCard
          art={<IlustracionCompliance nombre="vencido" size={42} />}
          label="Vencidos"
          value={String(c.vencido)}
          sub={c.vencido > 0 ? "Hay que renovarlos ya" : "Ninguno vencido"}
          icon={AlertTriangle}
          color="#EF4444"
          onClick={() => irA("vencido")}
          ariaLabel="Ver solo los vencidos"
        />
      </div>
      <div className={`flex min-w-0 flex-1 basis-[9.5rem] ${marca("por_vencer")}`}>
        <MetricCard
          art={<IlustracionCompliance nombre="por-vencer" size={42} />}
          label="Por vencer"
          value={String(c.por_vencer)}
          sub="Dentro del preaviso"
          icon={CalendarClock}
          color="#F59E0B"
          onClick={() => irA("por_vencer")}
          ariaLabel="Ver solo los que están por vencer"
        />
      </div>
      <div className={`flex min-w-0 flex-1 basis-[9.5rem] ${marca("faltante")}`}>
        <MetricCard
          art={<IlustracionCompliance nombre="sin-cargar" size={42} />}
          label="Sin cargar"
          value={String(c.faltante)}
          sub="Nunca se presentaron"
          icon={FileX}
          color="#64748B"
          onClick={() => irA("faltante")}
          ariaLabel="Ver solo los que faltan cargar"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

/** Cómo se resume un tipo entero en una sola palabra y un solo color. */
type ResumenTipo = {
  codigo: string;
  nombre: string;
  total: number;
  vencidos: number;
  porVencer: number;
  faltantes: number;
  alDia: number;
  pct: number;
  estado: ComplianceEstado;
  /** A quién le corresponde: sale de las filas, es el mismo para todo el tipo. */
  nivel: ComplianceNivel;
  /** A qué plataforma se presenta (`cliente_aplica`). */
  aplica: string;
};

// `color` es para texto (tiene que contrastar sobre el fondo claro) y `barra`
// para la barra y el puntito, donde manda que se reconozca el color del estado.
// Usar el color de texto en la barra la dejaba marrón y no ámbar.
const TIPO_UI: Record<
  ComplianceEstado,
  { label: string; color: string; barra: string; bg: string; arte: IlustracionNombre }
> = {
  vencido: { label: "Vencido", color: "#B91C1C", barra: "#EF4444", bg: "#FEF2F2", arte: "vencido" },
  por_vencer: { label: "Por vencer", color: "#B45309", barra: "#F59E0B", bg: "#FFFBEB", arte: "por-vencer" },
  // Gris y no rojo a propósito: "sin cargar" no es lo mismo que "vencido" (el
  // papel puede existir y no estar digitalizado). Es la misma regla que usa la
  // tarjeta "Sin cargar" de arriba y el tutorial de la pantalla.
  faltante: { label: "Sin cargar", color: "#475569", barra: "#94A3B8", bg: "#F1F5F9", arte: "sin-cargar" },
  vigente: { label: "Al día", color: "#166534", barra: "#22C55E", bg: "#F0FDF4", arte: "al-dia" },
};

const RANK_FILA: Record<ComplianceEstado, number> = {
  vencido: 0,
  por_vencer: 1,
  faltante: 2,
  vigente: 3,
};

const NIVEL_CORTO: Record<ComplianceNivel, string> = {
  empresa: "Empresa",
  unidad: "Camión",
  chofer: "Chofer",
};

/** A qué plataforma va el documento. Dato de la papeleta, no una categoría inventada. */
const APLICA_UI: Record<string, { label: string; color: string; bg: string }> = {
  AMBOS: { label: "YPF + Loma", color: "#075985", bg: "#E0F2FE" },
  YPF: { label: "Solo YPF", color: "#166534", bg: "#F0FDF4" },
  LOMA_NEGRA: { label: "Solo Loma", color: "#7C2D12", bg: "#FFF7ED" },
};

/** Cuántos tipos se ven antes de tocar "Ver más". */
const TIPOS_VISIBLES = 7;
/** Cuántas filas se listan dentro de un tipo desplegado. */
const FILAS_EN_DETALLE = 8;

/**
 * Los tipos de documento, en tabla: un renglón por tipo con sus columnas.
 *
 * Reemplaza al "abrí el acordeón y contá": de un vistazo se ve que las VTV
 * tienen 12 vencidas y las licencias ninguna. Cada renglón dice además a quién
 * le corresponde ese papel y a qué plataforma va, que antes había que saberlo de
 * memoria — y se abre: adentro están las unidades/choferes concretos a los que
 * les falta, con el botón para cargarlo ahí mismo.
 */
export function ComplianceCategorias({
  rows,
  filtros,
  onChange,
  onCargar,
  canWrite = false,
}: {
  rows: ComplianceEstadoRow[];
  filtros: FiltrosCompliance;
  onChange: (f: FiltrosCompliance) => void;
  /** Abre el diálogo de carga/edición de esa fila. */
  onCargar?: (row: ComplianceEstadoRow) => void;
  canWrite?: boolean;
}) {
  const [abierto, setAbierto] = useState<string | null>(null);
  const [verTodos, setVerTodos] = useState(false);

  const { cats, porTipo } = useMemo(() => {
    const m = new Map<string, ResumenTipo>();
    const filas = new Map<string, ComplianceEstadoRow[]>();
    for (const r of rows) {
      const prev =
        m.get(r.requisito_codigo) ??
        ({
          codigo: r.requisito_codigo,
          nombre: r.requisito_nombre,
          total: 0,
          vencidos: 0,
          porVencer: 0,
          faltantes: 0,
          alDia: 0,
          pct: 0,
          estado: "vigente",
          nivel: r.nivel,
          aplica: r.cliente_aplica,
        } satisfies ResumenTipo);
      prev.total += 1;
      if (r.estado === "vencido") prev.vencidos += 1;
      else if (r.estado === "por_vencer") prev.porVencer += 1;
      else if (r.estado === "faltante") prev.faltantes += 1;
      else prev.alDia += 1;
      m.set(r.requisito_codigo, prev);

      const arr = filas.get(r.requisito_codigo) ?? [];
      arr.push(r);
      filas.set(r.requisito_codigo, arr);
    }

    for (const c of m.values()) {
      c.pct = c.total > 0 ? Math.round((c.alDia / c.total) * 100) : 0;
      // El peor estado manda: es lo que hay que ir a resolver.
      c.estado =
        c.vencidos > 0 ? "vencido" : c.porVencer > 0 ? "por_vencer" : c.faltantes > 0 ? "faltante" : "vigente";
    }
    for (const arr of filas.values()) {
      arr.sort((a, b) => {
        const d = RANK_FILA[a.estado] - RANK_FILA[b.estado];
        if (d !== 0) return d;
        return (a.chofer_nombre ?? a.camion_patente ?? "").localeCompare(
          b.chofer_nombre ?? b.camion_patente ?? "",
        );
      });
    }

    // Primero lo que peor está: es lo que hay que mirar.
    const cats = [...m.values()].sort(
      (a, b) =>
        b.vencidos - a.vencidos ||
        b.porVencer - a.porVencer ||
        b.faltantes - a.faltantes ||
        b.total - a.total,
    );
    return { cats, porTipo: filas };
  }, [rows]);

  if (cats.length === 0) return null;

  const visibles = verTodos ? cats : cats.slice(0, TIPOS_VISIBLES);
  const ocultos = cats.length - visibles.length;

  return (
    <section className="rounded-[10px] border border-border bg-card print:hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-border px-4 py-3">
        <h2 className="text-[13px] font-semibold text-foreground">Por tipo de documento</h2>
        <span className="text-[11px] text-muted-foreground">
          {cats.length} {cats.length === 1 ? "tipo" : "tipos"} · el % es lo que está al día
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] border-collapse text-left">
          <thead>
            <tr className="border-b border-border text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2 font-semibold">Documento</th>
              <th className="hidden px-3 py-2 font-semibold lg:table-cell">Es de</th>
              {/* La plataforma sólo distingue a los pocos que no van a las dos:
                  es la primera que se va cuando falta ancho. */}
              <th className="hidden px-3 py-2 font-semibold 2xl:table-cell">Plataforma</th>
              <th className="px-3 py-2 font-semibold">Al día</th>
              <th className="px-3 py-2 font-semibold">Estado</th>
              <th className="w-10 px-3 py-2" aria-label="Abrir" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visibles.map((c) => {
              const ui = TIPO_UI[c.estado];
              const aplica = APLICA_UI[c.aplica] ?? APLICA_UI.AMBOS!;
              const expandido = abierto === c.codigo;
              const filas = porTipo.get(c.codigo) ?? [];
              const pendientes = filas.filter((r) => esPendienteEstado(r.estado));
              // Si está todo al día no hay nada que ir a resolver: se listan igual
              // los documentos, así se puede ver la fecha sin bajar al checklist.
              const aListar = (pendientes.length > 0 ? pendientes : filas).slice(0, FILAS_EN_DETALLE);
              const restantes = (pendientes.length > 0 ? pendientes.length : filas.length) - aListar.length;

              return (
                <Fragment key={c.codigo}>
                  <tr
                    role="button"
                    tabIndex={0}
                    aria-expanded={expandido}
                    onClick={() => setAbierto(expandido ? null : c.codigo)}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter" && e.key !== " ") return;
                      e.preventDefault();
                      setAbierto(expandido ? null : c.codigo);
                    }}
                    className={`cursor-pointer transition-colors ${
                      expandido ? "bg-muted/40" : "hover:bg-muted/30"
                    }`}
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <IlustracionCompliance nombre={ui.arte} size={34} />
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-foreground">{c.nombre}</p>
                          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                            {c.total} {c.total === 1 ? "documento" : "documentos"}
                            {c.vencidos > 0 && (
                              <span className="font-semibold text-[#B91C1C]">
                                {" · "}
                                {c.vencidos} vencido{c.vencidos === 1 ? "" : "s"}
                              </span>
                            )}
                            {c.porVencer > 0 && (
                              <span className="font-semibold text-[#B45309]">
                                {" · "}
                                {c.porVencer} por vencer
                              </span>
                            )}
                            {c.faltantes > 0 && <span>{" · "}{c.faltantes} sin cargar</span>}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="hidden px-3 py-2.5 lg:table-cell">
                      <span className="whitespace-nowrap rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                        {NIVEL_CORTO[c.nivel]}
                      </span>
                    </td>

                    <td className="hidden px-3 py-2.5 2xl:table-cell">
                      <span
                        className="whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold"
                        style={{ backgroundColor: aplica.bg, color: aplica.color }}
                      >
                        {aplica.label}
                      </span>
                    </td>

                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        {/* La barra mide lo que está al día. Sin número al lado no
                            se entiende de qué es el porcentaje. */}
                        <span className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-muted sm:block xl:w-28">
                          <span
                            className="block h-full rounded-full transition-[width] duration-500"
                            style={{ width: `${c.pct}%`, backgroundColor: ui.barra }}
                          />
                        </span>
                        <span className="w-9 shrink-0 text-right text-[12px] font-semibold tabular-nums text-muted-foreground">
                          {c.pct}%
                        </span>
                      </div>
                    </td>

                    <td className="px-3 py-2.5">
                      <span
                        className="inline-block whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold"
                        style={{ backgroundColor: ui.bg, color: ui.color }}
                      >
                        {ui.label}
                      </span>
                    </td>

                    <td className="px-3 py-2.5">
                      <span
                        aria-hidden
                        className={`grid size-6 place-items-center rounded-md border border-border bg-card text-muted-foreground transition-transform ${
                          expandido ? "" : "-rotate-90"
                        }`}
                      >
                        <ChevronDown size={14} />
                      </span>
                    </td>
                  </tr>

                  {expandido && (
                    <tr>
                      <td colSpan={6} className="border-t border-border bg-muted/20 px-3 py-3 sm:px-4">
                        {pendientes.length === 0 ? (
                          <p className="mb-2 text-[12px] font-medium text-[#166534]">
                            Todo al día: los {c.total} están vigentes.
                          </p>
                        ) : (
                          <p className="mb-2 text-[12px] text-muted-foreground">
                            <span className="font-semibold text-foreground">{pendientes.length}</span> de{" "}
                            {c.total} necesitan algo. {onCargar && canWrite ? "Tocá uno para cargarlo." : ""}
                          </p>
                        )}

                        <ul className="grid gap-1 sm:grid-cols-2">
                          {aListar.map((r) => {
                            const fui = TIPO_UI[r.estado];
                            const etiqueta = r.chofer_nombre ?? r.camion_patente ?? "Empresa";
                            const clickable = Boolean(onCargar);
                            const contenido = (
                              <>
                                <span
                                  aria-hidden
                                  className="size-2 shrink-0 rounded-full"
                                  style={{ backgroundColor: fui.barra }}
                                />
                                <span className="min-w-0 flex-1 truncate text-[12px] text-foreground">
                                  {etiqueta}
                                </span>
                                <span className="shrink-0 text-[11px]" style={{ color: fui.color }}>
                                  {r.fecha_vencimiento ? formatFecha(r.fecha_vencimiento) : fui.label}
                                </span>
                              </>
                            );
                            return (
                              <li key={`${r.requisito_id}-${r.chofer_id ?? r.camion_id ?? "emp"}`}>
                                {clickable ? (
                                  <button
                                    type="button"
                                    onClick={() => onCargar?.(r)}
                                    title={
                                      canWrite
                                        ? r.documento_id
                                          ? "Editar el vencimiento"
                                          : "Cargar este documento"
                                        : "Ver el documento"
                                    }
                                    className="flex w-full items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5 text-left transition-colors hover:border-primary/50 hover:bg-primary/5"
                                  >
                                    {contenido}
                                  </button>
                                ) : (
                                  <span className="flex w-full items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5">
                                    {contenido}
                                  </span>
                                )}
                              </li>
                            );
                          })}
                        </ul>

                        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                          {restantes > 0 && (
                            <span className="text-[11px] text-muted-foreground">y {restantes} más…</span>
                          )}
                          <button
                            type="button"
                            onClick={() => onChange({ ...filtros, requisito: c.codigo, estado: "todos" })}
                            className="text-[12px] font-medium text-primary hover:underline"
                          >
                            Ver los {c.total} en el checklist
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {cats.length > TIPOS_VISIBLES && (
        <button
          type="button"
          onClick={() => setVerTodos((v) => !v)}
          className="flex w-full items-center justify-center gap-1.5 border-t border-border py-2.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
        >
          <ChevronDown size={14} className={verTodos ? "rotate-180 transition-transform" : "transition-transform"} />
          {verTodos ? "Ver menos" : `Ver ${ocultos} tipos más`}
        </button>
      )}
    </section>
  );
}
