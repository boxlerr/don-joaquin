"use client";

import { useMemo } from "react";
import {
  FileText,
  CalendarClock,
  AlertTriangle,
  CheckCircle2,
  FileX,
  Search,
  X,
} from "lucide-react";
import MetricCard from "@/components/ui/MetricCard";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
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

export type FiltrosCompliance = {
  busqueda: string;
  estado: FiltroEstado;
  nivel: ComplianceNivel | "todos";
  /** `requisito_codigo`, o "todos". Es el "tipo de documento". */
  requisito: string;
};

export const FILTROS_VACIOS: FiltrosCompliance = {
  busqueda: "",
  estado: "todos",
  nivel: "todos",
  requisito: "todos",
};

export function hayFiltros(f: FiltrosCompliance): boolean {
  return (
    f.busqueda.trim() !== "" ||
    f.estado !== "todos" ||
    f.nivel !== "todos" ||
    f.requisito !== "todos"
  );
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
}: {
  filtros: FiltrosCompliance;
  onChange: (f: FiltrosCompliance) => void;
  /** Tipos de documento presentes en las filas, con su nombre. */
  requisitos: { codigo: string; nombre: string }[];
  mostrados: number;
  total: number;
}) {
  const set = <K extends keyof FiltrosCompliance>(k: K, v: FiltrosCompliance[K]) =>
    onChange({ ...filtros, [k]: v });

  return (
    <div className="space-y-2 print:hidden">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Campo label="Buscar" adorno={<Search size={13} className="shrink-0 text-muted-foreground" />}>
          <input
            value={filtros.busqueda}
            onChange={(e) => set("busqueda", e.target.value)}
            placeholder="Documento, chofer o unidad…"
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

        <Campo label="Tipo de documento">
          <Select value={filtros.requisito} onValueChange={(v) => set("requisito", v ?? "todos")}>
            <SelectTrigger className={TRIGGER_DESNUDO}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {requisitos.map((r) => (
                <SelectItem key={r.codigo} value={r.codigo}>
                  {r.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Campo>

        <Campo label="Estado">
          <Select value={filtros.estado} onValueChange={(v) => set("estado", (v ?? "todos") as FiltroEstado)}>
            <SelectTrigger className={TRIGGER_DESNUDO}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ESTADO_OPCIONES.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Campo>

        <Campo label="Alcance">
          <Select
            value={filtros.nivel}
            onValueChange={(v) => set("nivel", (v ?? "todos") as ComplianceNivel | "todos")}
          >
            <SelectTrigger className={TRIGGER_DESNUDO}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["todos", "empresa", "unidad", "chofer"] as const).map((n) => (
                <SelectItem key={n} value={n}>
                  {NIVEL_LABEL_CORTO[n]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Campo>
      </div>

      {/* El recuento y el "limpiar" van juntos: es la línea que dice si lo que
          estás mirando es todo o un recorte. Sin esto, un filtro puesto y
          olvidado hace creer que faltan documentos. */}
      {hayFiltros(filtros) && (
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
          <span>
            Mostrando <span className="font-semibold text-foreground tabular-nums">{mostrados}</span> de{" "}
            <span className="tabular-nums">{total}</span>
          </span>
          <button
            type="button"
            onClick={() => onChange(FILTROS_VACIOS)}
            className="font-medium text-primary hover:underline"
          >
            Limpiar filtros
          </button>
        </div>
      )}
    </div>
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

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-5 print:hidden">
      <MetricCard
        label="Total"
        value={String(c.total)}
        sub="Documentos del checklist"
        icon={FileText}
        tone="brand"
        onClick={() => onChange({ ...filtros, estado: "todos" })}
        ariaLabel="Ver todos los documentos"
      />
      <MetricCard
        label="Vencidos"
        value={String(c.vencido)}
        sub={c.vencido > 0 ? "Hay que renovarlos ya" : "Ninguno vencido"}
        icon={AlertTriangle}
        color="#EF4444"
        onClick={() => irA("vencido")}
        ariaLabel="Ver solo los vencidos"
      />
      <MetricCard
        label="Por vencer"
        value={String(c.por_vencer)}
        sub="Dentro del preaviso"
        icon={CalendarClock}
        color="#F59E0B"
        onClick={() => irA("por_vencer")}
        ariaLabel="Ver solo los que están por vencer"
      />
      <MetricCard
        label="Sin cargar"
        value={String(c.faltante)}
        sub="Nunca se presentaron"
        icon={FileX}
        color="#64748B"
        onClick={() => irA("faltante")}
        ariaLabel="Ver solo los que faltan cargar"
      />
      <MetricCard
        label="Al día"
        value={String(c.vigente)}
        sub="Vigentes"
        icon={CheckCircle2}
        color="#22C55E"
        onClick={() => irA("vigente")}
        ariaLabel="Ver solo los que están al día"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------

/**
 * Categorías: un renglón por tipo de documento, ordenado por lo que peor está.
 *
 * Reemplaza al "abrí el acordeón y contá": de un vistazo se ve que las VTV
 * tienen 12 vencidas y las licencias ninguna. Tocar una filtra por ese tipo.
 */
export function ComplianceCategorias({
  rows,
  filtros,
  onChange,
}: {
  rows: ComplianceEstadoRow[];
  filtros: FiltrosCompliance;
  onChange: (f: FiltrosCompliance) => void;
}) {
  const cats = useMemo(() => {
    const m = new Map<
      string,
      { codigo: string; nombre: string; total: number; vencidos: number; pendientes: number }
    >();
    for (const r of rows) {
      const prev = m.get(r.requisito_codigo) ?? {
        codigo: r.requisito_codigo,
        nombre: r.requisito_nombre,
        total: 0,
        vencidos: 0,
        pendientes: 0,
      };
      prev.total += 1;
      if (r.estado === "vencido") prev.vencidos += 1;
      if (esPendienteEstado(r.estado)) prev.pendientes += 1;
      m.set(r.requisito_codigo, prev);
    }
    // Primero lo que peor está: es lo que hay que mirar.
    return [...m.values()].sort(
      (a, b) => b.vencidos - a.vencidos || b.pendientes - a.pendientes || b.total - a.total,
    );
  }, [rows]);

  if (cats.length === 0) return null;

  return (
    <section className="rounded-[10px] border border-border bg-card print:hidden">
      <div className="flex items-baseline justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="text-[13px] font-semibold text-foreground">Por tipo de documento</h2>
        <span className="text-[11px] text-muted-foreground">
          {cats.length} {cats.length === 1 ? "tipo" : "tipos"} · tocá uno para filtrar
        </span>
      </div>
      <ul className="divide-y divide-border">
        {cats.map((c) => {
          const alDia = c.total - c.pendientes;
          const pct = c.total > 0 ? Math.round((alDia / c.total) * 100) : 0;
          const activo = filtros.requisito === c.codigo;
          return (
            <li key={c.codigo}>
              <button
                type="button"
                onClick={() =>
                  onChange({ ...filtros, requisito: activo ? "todos" : c.codigo })
                }
                aria-pressed={activo}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  activo ? "bg-primary/5" : "hover:bg-muted/40"
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-foreground">
                    {c.nombre}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    {c.total} {c.total === 1 ? "documento" : "documentos"}
                    {c.vencidos > 0 && (
                      <span className="font-semibold text-[#EF4444]"> · {c.vencidos} vencido{c.vencidos === 1 ? "" : "s"}</span>
                    )}
                  </span>
                </span>
                {/* La barra mide lo que está al día. Sin número al lado no se
                    entiende de qué es el porcentaje. */}
                <span className="hidden w-28 shrink-0 sm:block">
                  <span className="block h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: c.vencidos > 0 ? "#EF4444" : pct === 100 ? "#22C55E" : "#F59E0B",
                      }}
                    />
                  </span>
                </span>
                <span className="w-10 shrink-0 text-right text-[12px] font-semibold tabular-nums text-muted-foreground">
                  {pct}%
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
