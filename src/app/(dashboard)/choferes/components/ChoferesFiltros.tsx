"use client";

// La barra de Legajos: identidad, buscador, áreas, accesos rápidos y el
// selector de vista. Es la única parte de la pantalla que decide QUÉ se ve, así
// que está toda junta y en un orden fijo: quién soy → qué busco → de qué área →
// qué me falta.
//
// El componente sólo dibuja y avisa: no filtra ni ordena nada (eso vive en
// `../filtros`, que es puro y se prueba solo).

import { useEffect, useRef } from "react";
import {
  ArrowDownWideNarrow,
  Briefcase,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  FileText,
  LayoutGrid,
  List,
  MapPin,
  Phone,
  Search,
  TriangleAlert,
  Truck,
  Users,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import HorizontalScrollHint from "@/components/ui/HorizontalScrollHint";
import BusquedasGuardadas from "./BusquedasGuardadas";
import FiltrosAvanzadosPopover from "./FiltrosAvanzadosPopover";
import {
  ESTADOS,
  ESTADO_LABEL,
  FILTROS_VACIOS,
  ORDENES,
  ORDEN_LABEL,
  ROLES,
  ROL_LABELS,
  contarFiltros,
  type EstadoFilter,
  type EstadoFiltros,
  type Opcion,
  type OrdenFilter,
  type QuickFilter,
  type RolFilter,
} from "../filtros";

export type Vista = "tarjetas" | "tabla";

type Icono = React.ComponentType<{ size?: number | string; className?: string }>;

/** Anillo de foco igual al de `Button`: los botones a mano quedaban con el del navegador. */
const FOCO = "outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:border-ring";

/**
 * Volante de camión, dibujado acá: lucide 1.14 no trae ninguno. El único
 * parecido que tiene es `ShipWheel`, que es el timón de un barco y se lee como
 * otra cosa. Sigue el trazo de lucide (24×24, sin relleno, ancho 2) para que
 * pese lo mismo que los íconos de al lado.
 */
function Volante({ size = 24, className }: { size?: number | string; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M3 12h6.5" />
      <path d="M14.5 12H21" />
      <path d="M12 14.5V21" />
    </svg>
  );
}

/** Cada área con su ícono y su color. El color distingue de un vistazo; el
 *  ícono dice de qué se trata sin leer. */
const AREA: Record<RolFilter, { icon: Icono; color: string; fondo: string }> = {
  todos: { icon: Users, color: "#0088D1", fondo: "#E1F5FE" },
  chofer: { icon: Volante, color: "#059669", fondo: "#ECFDF5" },
  administrativo: { icon: Briefcase, color: "#7C3AED", fondo: "#F5F3FF" },
  mantenimiento: { icon: Wrench, color: "#D97706", fondo: "#FFFBEB" },
  fletero: { icon: Truck, color: "#0284C7", fondo: "#F0F9FF" },
};

/** El puntito del campo Estado: el color es el estado elegido. */
const COLOR_ESTADO: Record<EstadoFilter, string> = {
  todos: "#22C55E",
  activo: "#22C55E",
  inactivo: "#94A3B8",
  periodo_prueba: "#D97706",
  baja: "#CBD5E1",
};

type ChipRapido = {
  id: QuickFilter;
  label: string;
  icon?: Icono;
  /** Punto de color en vez de ícono (el estado no tiene un dibujo que lo diga). */
  dot?: string;
  /** Pinta el número cuando hay algo que atender. */
  tono?: "error" | "warning";
  /** Explica el criterio. Va también en el texto de ayuda, no sólo al pasar el mouse. */
  ayuda: string;
};

const RAPIDOS: ChipRapido[] = [
  { id: "activos", label: "Activos", dot: "#22C55E", ayuda: "Personal en actividad." },
  {
    id: "por_vencer",
    label: "Por vencer",
    icon: CalendarClock,
    tono: "warning",
    ayuda:
      "Con documentación entrando en su ventana de aviso. La ventana la define cada tipo de documento: 90 días antecedentes y libreta sanitaria, 60 psicofísico, CNRT y LINTI, 30 el resto.",
  },
  {
    id: "vencidos",
    label: "Vencidos",
    icon: TriangleAlert,
    tono: "error",
    ayuda: "Con al menos un documento vencido.",
  },
  {
    id: "sin_documentos",
    label: "Sin documentos",
    icon: FileText,
    ayuda: "Sin ningún documento cargado en el legajo.",
  },
  { id: "sin_localidad", label: "Sin localidad", icon: MapPin, ayuda: "Sin localidad cargada." },
  { id: "sin_telefono", label: "Sin teléfono", icon: Phone, ayuda: "Sin teléfono cargado." },
];

/**
 * Campo con la etiqueta arriba del valor.
 *
 * El trigger del `Combobox` sólo dibuja el valor y su chevron, así que la
 * etiqueta y el puntito van en esta caja y al trigger se le apaga el marco
 * propio (mismo recurso que usa `SelectField`). En celular el trigger crece a
 * 36px: 28 son incómodos de tocar.
 */
function Campo({
  label,
  children,
  adorno,
}: {
  label: string;
  children: React.ReactNode;
  adorno: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col justify-center rounded-lg border border-border bg-card px-3 py-1.5 transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20 sm:h-[52px] sm:flex-1 xl:w-[15.5rem] xl:flex-none">
      <span className="text-[11px] leading-none text-muted-foreground">{label}</span>
      <div className="mt-0.5 flex items-center gap-1.5">
        {adorno}
        {children}
      </div>
    </div>
  );
}

const TRIGGER_DESNUDO =
  "h-9 sm:h-7 min-w-0 flex-1 rounded-none border-0 bg-transparent px-0 text-sm font-semibold text-foreground hover:bg-transparent focus-visible:border-0 focus-visible:ring-0";

export default function ChoferesFiltros({
  filtros,
  onChange,
  vista,
  onVistaChange,
  abierto,
  onAbiertoChange,
  conteoPorRol,
  conteoRapidos,
  mostrados,
  total,
  localidades,
  marcas,
}: {
  filtros: EstadoFiltros;
  onChange: (f: EstadoFiltros) => void;
  vista: Vista;
  onVistaChange: (v: Vista) => void;
  abierto: boolean;
  onAbiertoChange: (v: boolean) => void;
  conteoPorRol: Record<RolFilter, number>;
  conteoRapidos: Record<QuickFilter, number>;
  mostrados: number;
  total: number;
  localidades: Opcion[];
  marcas: Opcion[];
}) {
  const buscador = useRef<HTMLInputElement>(null);
  const focoPendiente = useRef(false);

  // Atajo del buscador. NO es ⌘K: ese ya lo usa la paleta de páginas en toda la
  // app (y ya hubo un bug de dos capas peleándose ese atajo). "/" está libre y
  // es el mismo gesto de GitHub o Linear.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      // No robarle la barra a quien está escribiendo en otro lado.
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      // Ni pisar lo que esté abierto encima (un diálogo o el panel de filtros).
      if (document.querySelector('[role="dialog"], [data-panel-filtros]')) return;
      e.preventDefault();
      // El input vive dentro del bloque plegable: si la barra está cerrada
      // todavía no está montado y hay que enfocarlo recién cuando aparezca.
      focoPendiente.current = true;
      onAbiertoChange(true);
      if (buscador.current) {
        focoPendiente.current = false;
        buscador.current.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onAbiertoChange]);

  useEffect(() => {
    if (abierto && focoPendiente.current) {
      focoPendiente.current = false;
      buscador.current?.focus();
    }
  }, [abierto]);

  const set = <K extends keyof EstadoFiltros>(clave: K, valor: EstadoFiltros[K]) =>
    onChange({ ...filtros, [clave]: valor });

  const toggleRapido = (q: QuickFilter) =>
    set(
      "rapidos",
      filtros.rapidos.includes(q)
        ? filtros.rapidos.filter((x) => x !== q)
        : [...filtros.rapidos, q],
    );

  const puestos = contarFiltros(filtros);
  // El orden no filtra: limpiar no tiene por qué devolverlo al alfabético si la
  // persona lo eligió a propósito.
  const limpiar = () => onChange({ ...FILTROS_VACIOS, orden: filtros.orden });
  const IconoArea = AREA[filtros.rol].icon;

  const botonLimpiar = (
    <button
      type="button"
      onClick={limpiar}
      className={`inline-flex h-9 shrink-0 items-center gap-1 rounded-lg border border-border px-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground ${FOCO}`}
    >
      <X size={12} /> Limpiar {puestos} filtro{puestos !== 1 ? "s" : ""}
    </button>
  );

  return (
    <section className="rounded-xl border border-border bg-card shadow-xs">
      {/* Identidad + acciones */}
      <div className="flex flex-wrap items-start justify-between gap-3 px-3 py-3 sm:px-5 sm:py-4">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="grid size-11 shrink-0 place-items-center rounded-xl"
            style={{ backgroundColor: AREA[filtros.rol].fondo, color: AREA[filtros.rol].color }}
          >
            <IconoArea size={20} />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <h2 className="text-lg font-bold text-foreground sm:text-xl">
                {ROL_LABELS[filtros.rol]} en plantilla
              </h2>
              <span className="text-sm text-muted-foreground tabular-nums">
                {mostrados} de {total}
              </span>
            </div>
            <p className="text-[13px] text-muted-foreground">
              Explorá y gestioná los legajos del equipo
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <BusquedasGuardadas filtros={filtros} onAplicar={onChange} />
          <FiltrosAvanzadosPopover
            filtros={filtros.avanzados}
            onChange={(a) => set("avanzados", a)}
            localidades={localidades}
            marcas={marcas}
          />
          <button
            type="button"
            onClick={() => onAbiertoChange(!abierto)}
            aria-expanded={abierto}
            title={abierto ? "Ocultar los filtros" : "Mostrar los filtros"}
            className={`inline-flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground ${FOCO}`}
          >
            {abierto ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {/* Plegada, la barra tiene que seguir diciendo que hay algo filtrando: si
          no, la lista se ve incompleta y no se ve por qué. */}
      {!abierto && puestos > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border px-3 py-2.5 text-xs text-muted-foreground sm:px-5">
          <span>
            Hay {puestos} filtro{puestos !== 1 ? "s" : ""} puesto{puestos !== 1 ? "s" : ""}.
          </span>
          {botonLimpiar}
        </div>
      )}

      {abierto && (
        <div className="space-y-3 px-3 pb-3 sm:px-5 sm:pb-4">
          {/* Buscar / Estado / Ordenar. Hasta xl los tres no entran en una fila
              sin dejar el buscador en 150px, así que baja: buscador arriba y los
              dos desplegables abajo (apilados en celular). */}
          <div className="rounded-xl border border-border bg-muted/20 p-2.5">
            <div className="flex flex-col gap-2 xl:flex-row">
              <div className="relative min-w-0 flex-1">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-muted-foreground/70"
                />
                {/* El primitivo `Input` y no un <input> a mano: trae el
                    `text-base` que evita que iOS haga zoom al enfocarlo. */}
                <Input
                  ref={buscador}
                  type="search"
                  value={filtros.query}
                  onChange={(e) => set("query", e.target.value)}
                  placeholder="Buscar por nombre, DNI, camión, marca, localidad…"
                  aria-label="Buscar en los legajos"
                  className="h-12 max-md:h-12 w-full rounded-lg border-border bg-card pl-10 pr-4 sm:h-[52px] sm:pr-14"
                />
                <kbd
                  aria-hidden
                  className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-[5px] border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground sm:block"
                >
                  /
                </kbd>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Campo
                  label="Estado"
                  adorno={
                    <span
                      aria-hidden
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: COLOR_ESTADO[filtros.estado] }}
                    />
                  }
                >
                  <Combobox
                    value={filtros.estado}
                    onValueChange={(v) => set("estado", v as EstadoFilter)}
                    options={ESTADOS.map((e) => ({
                      id: e,
                      label: ESTADO_LABEL[e],
                      dot: COLOR_ESTADO[e],
                    }))}
                    searchable={false}
                    triggerClassName={TRIGGER_DESNUDO}
                    aria-label="Estado"
                  />
                </Campo>

                <Campo
                  label="Ordenar por"
                  adorno={
                    <ArrowDownWideNarrow
                      size={14}
                      className="shrink-0 text-muted-foreground/70"
                      aria-hidden
                    />
                  }
                >
                  <Combobox
                    value={filtros.orden}
                    onValueChange={(v) => set("orden", v as OrdenFilter)}
                    options={ORDENES.map((o) => ({ id: o, label: ORDEN_LABEL[o] }))}
                    searchable={false}
                    triggerClassName={TRIGGER_DESNUDO}
                    aria-label="Ordenar por"
                  />
                </Campo>
              </div>
            </div>
          </div>

          {/* Áreas + vista. La tira mide más de 700px con los conteos: scrollea
              de costado con sus flechitas en vez de empujar la página. */}
          <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
            <HorizontalScrollHint className="-mx-1 min-w-0 px-1 pb-1" fadeBg="from-card">
              <div className="flex w-max items-center gap-2">
                {ROLES.map((r) => {
                  const activo = filtros.rol === r;
                  const { icon: Icono, color, fondo } = AREA[r];
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => set("rol", r)}
                      aria-pressed={activo}
                      // Sin esto el lector de pantalla lee "Choferes72": el
                      // número es un `<span>` pegado al texto.
                      aria-label={`${ROL_LABELS[r]}: ${conteoPorRol[r]}`}
                      className={`relative inline-flex shrink-0 items-center gap-2.5 overflow-hidden rounded-xl border px-3 py-2.5 text-left transition-colors ${FOCO} ${
                        activo
                          ? "border-primary/40 bg-primary/5"
                          : "border-border bg-card hover:bg-muted/50"
                      }`}
                    >
                      <span
                        className="grid size-8 shrink-0 place-items-center rounded-lg"
                        style={{ backgroundColor: fondo, color }}
                      >
                        <Icono size={16} />
                      </span>
                      <span
                        className={`whitespace-nowrap text-sm font-medium ${
                          activo ? "text-primary" : "text-foreground"
                        }`}
                      >
                        {ROL_LABELS[r]}
                      </span>
                      <span
                        className={`tabular-nums text-sm ${
                          activo ? "text-primary/80" : "text-muted-foreground"
                        }`}
                      >
                        {conteoPorRol[r]}
                      </span>
                      {activo && (
                        <span
                          aria-hidden
                          className="absolute inset-x-0 bottom-0 h-[3px] rounded-full bg-primary"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </HorizontalScrollHint>

            {/* El selector de vista va solo: con "Limpiar" al lado se corría de
                lugar cada vez que se tocaba un filtro. */}
            <div className="inline-flex shrink-0 self-start overflow-hidden rounded-lg border border-border xl:self-auto">
              {(
                [
                  { id: "tarjetas" as const, label: "Tarjetas", Icono: LayoutGrid },
                  { id: "tabla" as const, label: "Tabla", Icono: List },
                ]
              ).map(({ id, label, Icono }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onVistaChange(id)}
                  aria-pressed={vista === id}
                  className={`inline-flex h-10 items-center gap-1.5 px-3 text-sm font-medium transition-colors focus-visible:relative focus-visible:z-10 ${FOCO} ${
                    vista === id
                      ? "bg-primary/5 text-primary"
                      : "bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icono size={15} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Vista rápida: lo que hay que ir a arreglar, a un toque. */}
          <div className="rounded-xl border border-border bg-muted/20 px-2.5 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex shrink-0 items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Zap size={13} aria-hidden />
                Vista rápida
              </span>
              {RAPIDOS.map(({ id, label, icon: Icono, dot, tono, ayuda }) => {
                const activo = filtros.rapidos.includes(id);
                const n = conteoRapidos[id];
                const colorN =
                  n === 0
                    ? "text-muted-foreground/80"
                    : activo
                      ? "text-primary/80"
                      : tono === "error"
                        ? "text-[#B91C1C]"
                        : tono === "warning"
                          ? "text-[#B45309]"
                          : "text-muted-foreground";
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleRapido(id)}
                    aria-pressed={activo}
                    // El conteo es un `<span>` pegado al texto, y el criterio no
                    // puede vivir sólo en un `title` (en touch no hay hover).
                    aria-label={`${label}: ${n}. ${ayuda}`}
                    title={ayuda}
                    className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-[13px] transition-colors ${FOCO} ${
                      activo
                        ? "border-primary/50 bg-primary/5 font-medium text-primary"
                        : "border-border bg-card text-foreground hover:bg-muted/60"
                    }`}
                  >
                    {dot ? (
                      <span
                        aria-hidden
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: dot }}
                      />
                    ) : Icono ? (
                      <Icono
                        size={14}
                        aria-hidden
                        className={
                          activo
                            ? "text-primary"
                            : tono === "error"
                              ? "text-[#B91C1C]"
                              : "text-muted-foreground/70"
                        }
                      />
                    ) : null}
                    <span className="whitespace-nowrap">{label}</span>
                    <span className={`tabular-nums ${colorN}`}>{n}</span>
                  </button>
                );
              })}
              {puestos > 0 && botonLimpiar}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
