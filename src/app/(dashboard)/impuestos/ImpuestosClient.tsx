"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { EstadoImpuesto, FiltroEstado } from "./filtros";
import { useRouter } from "next/navigation";
import {
  Plus, Pencil, Trash2, Loader2, Check, ChevronRight, ChevronLeft, Paperclip,
  Search, X, FileText, ArrowUpDown, ArrowUp, ArrowDown, CalendarX2, Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import MetricCard from "@/components/ui/MetricCard";
import StatusBadge from "@/components/ui/StatusBadge";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import InlineFeedback from "@/components/ui/InlineFeedback";
import { coincideBusqueda } from "@/lib/texto";
import {
  togglePresentadoImpuestoAction,
  setFechaPresentacionAction,
  setFechaVencimientoAction,
  setImporteImpuestoAction,
  setFechaPagoImpuestoAction,
  updateImpuestoAction,
  createImpuestoAction,
  deleteImpuestoAction,
  type ImpuestoRow,
} from "./actions";
import CeldaFecha from "./components/CeldaFecha";
import CeldaImporte from "./components/CeldaImporte";
import { totalesPorPeriodo, totalGeneral } from "./totales";
import ImpuestoDetalle from "./components/ImpuestoDetalle";
import IlustracionImpuesto from "./components/IlustracionImpuesto";

/**
 * Calendario de vencimientos impositivos.
 *
 * La pantalla era una tabla suelta con las 11 filas todas juntas y cuatro
 * tarjetas arriba que sólo miraban. Ahora el número y el recorte son la misma
 * cosa —tocar "Vencidos" deja los vencidos, igual que en Legajos y en
 * Compliance—, hay buscador, se ordena por la columna y la lista pagina.
 *
 * Está pensada para cuando sean 200 filas y no 11: un impuesto por período por
 * organismo son ~15 filas por mes, así que en un año esto es la lista larga de
 * Finanzas.
 */

/** Cuántas filas por página. Con 25 entra un mes y medio de vencimientos. */
const POR_PAGINA = 25;

// ---------------------------------------------------------------------------
// Estado de un impuesto — una sola definición para todo el archivo
// ---------------------------------------------------------------------------



function diasRestantes(fechaISO: string): number {
  const [y, m, d] = fechaISO.split("-").map(Number);
  const venc = new Date(y!, m! - 1, d!);
  const hoy = new Date();
  const hoyMid = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return Math.round((venc.getTime() - hoyMid.getTime()) / 86400000);
}

/**
 * Las mismas cuatro cajas que cuentan las tarjetas, las solapas y el filtro. Es
 * una sola función a propósito: si la tarjeta dijera 11 vencidos y la solapa 9,
 * no habría forma de saber cuál de las dos miente.
 */
function estadoDe(i: ImpuestoRow): EstadoImpuesto {
  if (i.presentado) return "presentado";
  const d = diasRestantes(i.fecha_vencimiento);
  if (d < 0) return "vencido";
  if (d <= 7) return "por_vencer";
  return "pendiente";
}

/** "vence en 5 días" / "venció hace 67 días": el dato que la fecha sola no da. */
function textoVence(fechaISO: string): string {
  const d = diasRestantes(fechaISO);
  if (d === 0) return "vence hoy";
  if (d === 1) return "vence mañana";
  if (d === -1) return "venció ayer";
  if (d < 0) return `venció hace ${Math.abs(d)} días`;
  return `vence en ${d} días`;
}

function fmt(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** Se presentó después del vencimiento. Se avisa, pero no es un error rojo. */
function presentadoTarde(i: ImpuestoRow): boolean {
  return i.fecha_presentacion !== null && i.fecha_presentacion > i.fecha_vencimiento;
}

function EstadoImpuestoBadge({ row }: { row: ImpuestoRow }) {
  switch (estadoDe(row)) {
    case "presentado":
      return presentadoTarde(row)
        ? <StatusBadge label="Presentado tarde" tone="warning" />
        : <StatusBadge label="Presentado" tone="success" />;
    case "vencido":
      return <StatusBadge label="Vencido" tone="error" />;
    case "por_vencer":
      return <StatusBadge label="Por vencer" tone="warning" />;
    default:
      return <StatusBadge label="Pendiente" tone="neutral" />;
  }
}

/**
 * El renglón chico debajo de la fecha. En rojo sólo cuando ya se pasó.
 *
 * El `pl-` acompaña al padding de la celda de fecha (que es un botón): sin eso
 * el texto arranca unos pixeles a la izquierda del número y se ve desprolijo.
 */
function AvisoVencimiento({ row }: { row: ImpuestoRow }) {
  const e = estadoDe(row);
  if (e === "presentado") {
    return (
      <span className="pl-2.5 text-[11px] text-muted-foreground md:pl-2">
        vencía el {fmt(row.fecha_vencimiento)}
      </span>
    );
  }
  return (
    <span
      className={`pl-2.5 text-[11px] md:pl-2 ${
        e === "vencido" ? "font-medium text-red-600" : e === "por_vencer" ? "font-medium text-amber-600" : "text-muted-foreground"
      }`}
    >
      {textoVence(row.fecha_vencimiento)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Orden y paginación
// ---------------------------------------------------------------------------

type CampoOrden = "nombre" | "organismo" | "vencimiento";
type Direccion = "asc" | "desc";

function BotonOrden({
  label, campo, orden, dir, onOrden, className,
}: {
  label: string;
  campo: CampoOrden;
  orden: CampoOrden;
  dir: Direccion;
  onOrden: (c: CampoOrden) => void;
  className?: string;
}) {
  const activo = orden === campo;
  const Icono = !activo ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => onOrden(campo)}
      title={`Ordenar por ${label.toLowerCase()}`}
      aria-label={`Ordenar por ${label.toLowerCase()}`}
      className={`group inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider transition-colors ${
        activo ? "text-foreground" : "text-muted-foreground hover:text-foreground"
      } ${className ?? ""}`}
    >
      {label}
      <Icono size={12} className={activo ? "text-primary" : "opacity-40 group-hover:opacity-80"} />
    </button>
  );
}

/** Números de página a dibujar. Con muchas páginas se corta con puntos suspensivos. */
function ventanaPaginas(actual: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const desde = Math.max(2, actual - 1);
  const hasta = Math.min(total - 1, actual + 1);
  if (desde > 2) out.push("…");
  for (let n = desde; n <= hasta; n++) out.push(n);
  if (hasta < total - 1) out.push("…");
  out.push(total);
  return out;
}

// ---------------------------------------------------------------------------

type DialogState =
  | { mode: "closed" }
  | { mode: "add" }
  | { mode: "edit"; row: ImpuestoRow };

const SOLAPAS: { id: FiltroEstado; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "por_vencer", label: "Por vencer" },
  { id: "vencido", label: "Vencidos" },
  { id: "presentado", label: "Presentados" },
];

export default function ImpuestosClient({
  impuestos,
  canWrite,
  estadoInicial,
}: {
  impuestos: ImpuestoRow[];
  canWrite: boolean;
  /**
   * Solapa abierta al entrar, desde `?estado=` — así el resumen del día puede
   * mandar directo a los vencidos en vez de dejar la lista entera y que haya que
   * rearmar a mano el filtro que produjo el número. Llega como prop desde el
   * server (y no de `useSearchParams`) para que el primer render coincida.
   */
  estadoInicial?: FiltroEstado;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState>({ mode: "closed" });
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [aBorrar, setABorrar] = useState<ImpuestoRow | null>(null);
  const [expandidoId, setExpandidoId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);

  // Filtros, orden y página
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState<FiltroEstado>(estadoInicial ?? "todos");
  const [organismo, setOrganismo] = useState("todos");
  const [orden, setOrden] = useState<CampoOrden>("vencimiento");
  const [dir, setDir] = useState<Direccion>("asc");
  const [pagina, setPagina] = useState(1);
  const buscadorRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  /** Cambiar de página sube al principio de la lista: los botones están abajo
   *  y sin esto la página nueva arranca fuera de la pantalla. */
  const irAPagina = (p: number) => {
    setPagina(p);
    panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Form state (compartido add/edit)
  const [nombre, setNombre] = useState("");
  const [organismoForm, setOrganismoForm] = useState("");
  const [fecha, setFecha] = useState("");
  const [periodo, setPeriodo] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // "/" enfoca el buscador. ⌘K no: eso ya lo usa la paleta global del sistema.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
      buscadorRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Todo cambio de recorte vuelve a la primera página: si no, filtrar estando en
  // la página 4 deja la tabla vacía y parece que no hay resultados. Se hace en
  // los setters y no en un efecto para no re-renderizar dos veces por tecla.
  const cambiarBusqueda = (v: string) => { setBusqueda(v); setPagina(1); };
  const cambiarEstado = (v: FiltroEstado) => { setEstado(v); setPagina(1); };
  const cambiarOrganismo = (v: string) => { setOrganismo(v); setPagina(1); };

  const organismos = useMemo(() => {
    const set = new Set<string>();
    for (const i of impuestos) if (i.organismo) set.add(i.organismo);
    return [...set].sort((a, b) => a.localeCompare(b, "es"));
  }, [impuestos]);

  // Búsqueda y organismo primero: los contadores de las solapas se cuentan
  // sobre ESTO, así las cuatro siempre suman lo que hay en pantalla.
  const universo = useMemo(() => {
    const q = busqueda.trim();
    return impuestos.filter((i) => {
      if (organismo !== "todos" && (i.organismo ?? "") !== organismo) return false;
      if (!q) return true;
      const texto = `${i.nombre} ${i.organismo ?? ""} ${i.periodo ?? ""} ${i.observaciones ?? ""}`;
      return coincideBusqueda(texto, q);
    });
  }, [impuestos, busqueda, organismo]);

  const conteos = useMemo(() => {
    const c = { todos: universo.length, presentado: 0, vencido: 0, por_vencer: 0, pendiente: 0 };
    for (const i of universo) c[estadoDe(i)] += 1;
    return c;
  }, [universo]);

  const ordenados = useMemo(() => {
    const filas = universo.filter((i) => estado === "todos" || estadoDe(i) === estado);
    const signo = dir === "asc" ? 1 : -1;
    return [...filas].sort((a, b) => {
      let cmp = 0;
      if (orden === "nombre") cmp = a.nombre.localeCompare(b.nombre, "es");
      else if (orden === "organismo") cmp = (a.organismo ?? "").localeCompare(b.organismo ?? "", "es");
      else cmp = a.fecha_vencimiento.localeCompare(b.fecha_vencimiento);
      // Desempate estable: mismo día, alfabético. Si no, dos vencimientos del
      // mismo día se ordenan distinto en cada render.
      if (cmp === 0) cmp = a.fecha_vencimiento.localeCompare(b.fecha_vencimiento) || a.nombre.localeCompare(b.nombre, "es");
      return cmp * signo;
    });
  }, [universo, estado, orden, dir]);

  const totalPaginas = Math.max(1, Math.ceil(ordenados.length / POR_PAGINA));
  const paginaSegura = Math.min(pagina, totalPaginas);
  const desde = ordenados.length === 0 ? 0 : (paginaSegura - 1) * POR_PAGINA + 1;
  const hasta = Math.min(paginaSegura * POR_PAGINA, ordenados.length);
  const visibles = ordenados.slice((paginaSegura - 1) * POR_PAGINA, paginaSegura * POR_PAGINA);

  const hayFiltros = busqueda.trim() !== "" || estado !== "todos" || organismo !== "todos";
  const limpiar = () => {
    setBusqueda("");
    setEstado("todos");
    setOrganismo("todos");
    setPagina(1);
  };

  const cambiarOrden = (campo: CampoOrden) => {
    setPagina(1);
    if (orden === campo) {
      setDir(dir === "asc" ? "desc" : "asc");
      return;
    }
    setOrden(campo);
    // El vencimiento arranca del más viejo al más nuevo (lo urgente primero);
    // los textos, de la A a la Z.
    setDir("asc");
  };

  const openAdd = () => {
    setNombre(""); setOrganismoForm(""); setFecha(""); setPeriodo(""); setObservaciones("");
    setError(null); setDialog({ mode: "add" });
  };
  const openEdit = (row: ImpuestoRow) => {
    setNombre(row.nombre); setOrganismoForm(row.organismo ?? ""); setFecha(row.fecha_vencimiento);
    setPeriodo(row.periodo ?? ""); setObservaciones(row.observaciones ?? "");
    setError(null); setDialog({ mode: "edit", row });
  };

  // Handlers de las celdas de fecha — definidos acá para que la tabla (desktop)
  // y las tarjetas (celular) usen exactamente la misma lógica.
  const guardarImporte = (id: string) => async (v: number | null) => {
    const res = await setImporteImpuestoAction(id, v);
    if ("error" in res) return res;
    router.refresh();
  };

  const guardarFechaPago = (id: string) => async (f: string | null) => {
    const res = await setFechaPagoImpuestoAction(id, f);
    if ("error" in res) return res;
    router.refresh();
  };

  const guardarVencimiento = (id: string) => async (f: string | null) => {
    const res = await setFechaVencimientoAction(id, f!);
    if ("error" in res) return res;
    router.refresh();
  };
  const guardarPresentacion = (id: string) => async (f: string | null) => {
    const res = await setFechaPresentacionAction(id, f);
    if ("error" in res) return res;
    router.refresh();
  };

  const handleToggle = async (row: ImpuestoRow) => {
    setTogglingId(row.id);
    setErrorAccion(null);
    const res = await togglePresentadoImpuestoAction(row.id, !row.presentado);
    setTogglingId(null);
    // Antes el error se descartaba: el tilde volvía solo a su lugar y no se
    // sabía si no había guardado o si se había destildado de más.
    if ("error" in res) { setErrorAccion(res.error); return; }
    router.refresh();
  };

  const handleDelete = async () => {
    if (!aBorrar) return;
    setDeletingId(aBorrar.id);
    setErrorAccion(null);
    const res = await deleteImpuestoAction(aBorrar.id);
    setDeletingId(null);
    if ("error" in res) { setErrorAccion(res.error); return; }
    setABorrar(null);
    router.refresh();
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const res =
      dialog.mode === "edit"
        ? await updateImpuestoAction(dialog.row.id, {
            nombre, organismo: organismoForm || null, periodo: periodo || null,
            fecha_vencimiento: fecha, observaciones: observaciones || null,
          })
        : await createImpuestoAction({
            nombre, organismo: organismoForm || null, periodo: periodo || null, fecha_vencimiento: fecha,
          });
    setSaving(false);
    if ("error" in res) { setError(res.error); return; }
    setDialog({ mode: "closed" });
    router.refresh();
  };

  const puedeGuardar = nombre.trim() !== "" && fecha !== "";

  /** Tocar la tarjeta que ya está activa vuelve a "Todos". */
  const irA = (e: FiltroEstado) => cambiarEstado(estado === e ? "todos" : e);
  const marca = (e: FiltroEstado) => (estado === e ? "rounded-[8px] ring-2 ring-primary/40" : "");

  return (
    <div className="space-y-4 sm:space-y-5">
      {errorAccion && (
        <InlineFeedback variant="error" message={errorAccion} onDismiss={() => setErrorAccion(null)} autoHideMs={0} />
      )}

      {/* Las cuatro métricas. Además de contar, filtran: es el mismo gesto que
          en Compliance y en Legajos. El color va en el número y en el dibujo,
          nunca de fondo de la tarjeta. */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {/* La primera no se marca nunca: sin filtro quedaría siempre
            resaltada y parecería que hay un recorte puesto. */}
        <div className="flex">
          <MetricCard
            art={<IlustracionImpuesto nombre="calendario" size={40} />}
            label="Impuestos"
            value={String(impuestos.length)}
            sub="En el calendario"
            icon={FileText}
            tone="brand"
            onClick={() => cambiarEstado("todos")}
            ariaLabel="Ver todos los impuestos"
            bar={
              impuestos.length > 0
                ? {
                    pct: (impuestos.filter((i) => i.presentado).length / impuestos.length) * 100,
                    title: `${impuestos.filter((i) => i.presentado).length} de ${impuestos.length} presentados`,
                  }
                : undefined
            }
          />
        </div>
        <div className={`flex ${marca("presentado")}`}>
          <MetricCard
            art={<IlustracionImpuesto nombre="presentado" size={40} />}
            label="Presentados"
            value={String(impuestos.filter((i) => i.presentado).length)}
            sub="Marcados como hechos"
            icon={Check}
            color="#22C55E"
            onClick={() => irA("presentado")}
            ariaLabel="Ver sólo los presentados"
          />
        </div>
        <div className={`flex ${marca("por_vencer")}`}>
          <MetricCard
            art={<IlustracionImpuesto nombre="por-vencer" size={40} />}
            label="Por vencer"
            value={String(impuestos.filter((i) => estadoDe(i) === "por_vencer").length)}
            sub="Pendientes en ≤ 7 días"
            icon={ArrowUp}
            color="#F59E0B"
            onClick={() => irA("por_vencer")}
            ariaLabel="Ver sólo los que están por vencer"
          />
        </div>
        <div className={`flex ${marca("vencido")}`}>
          <MetricCard
            art={<IlustracionImpuesto nombre="vencido" size={40} />}
            label="Vencidos"
            value={String(impuestos.filter((i) => estadoDe(i) === "vencido").length)}
            sub="Pendientes pasados de fecha"
            icon={CalendarX2}
            color="#EF4444"
            onClick={() => irA("vencido")}
            ariaLabel="Ver sólo los vencidos"
          />
        </div>
      </div>

      <TotalesPorMes impuestos={impuestos} />

      <div ref={panelRef} className="overflow-hidden rounded-[8px] border border-border bg-card shadow-sm scroll-mt-4">
        {/* Barra de herramientas: buscar, acotar por organismo y agregar. */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-3 sm:px-4">
          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <Search
              size={14}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              ref={buscadorRef}
              value={busqueda}
              onChange={(e) => cambiarBusqueda(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") { cambiarBusqueda(""); e.currentTarget.blur(); }
              }}
              placeholder="Buscar impuesto, organismo o período…"
              aria-label="Buscar impuestos"
              className="h-10 w-full rounded-lg border border-border bg-background pl-8 pr-10 text-base outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20 sm:h-9 sm:text-sm"
            />
            {busqueda ? (
              <button
                type="button"
                onClick={() => cambiarBusqueda("")}
                aria-label="Limpiar la búsqueda"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X size={14} />
              </button>
            ) : (
              // La tecla es "/" y no ⌘K: ⌘K abre la búsqueda de todo el sistema.
              <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground sm:block">
                /
              </kbd>
            )}
          </div>

          {organismos.length > 1 && (
            <Combobox
              value={organismo}
              onValueChange={(v) => cambiarOrganismo(v || "todos")}
              options={[
                { id: "todos", label: "Todos los organismos" },
                ...organismos.map((o) => ({ id: o, label: o })),
              ]}
              searchable={organismos.length > 7}
              triggerClassName="h-10 w-full sm:h-9 sm:w-56"
              aria-label="Filtrar por organismo"
            />
          )}

          {canWrite && (
            <Button variant="brand" size="sm" className="w-full sm:ml-auto sm:w-auto" onClick={openAdd}>
              <Plus size={14} /> Agregar impuesto
            </Button>
          )}
        </div>

        {/* Solapas. Los números son de lo que hay bajo la búsqueda puesta, no
            del total: si buscás "ARBA", las cuatro suman los de ARBA. */}
        {/* Envuelven en vez de scrollear de costado: a 375px las cuatro no
            entran en una línea, y con scroll horizontal "Presentados" quedaba
            escondida detrás del borde. */}
        <div className="border-b border-border px-2 sm:px-4">
          <div role="tablist" aria-label="Filtrar impuestos por estado" className="flex flex-wrap items-center gap-x-1">
            {SOLAPAS.map((s) => {
              const activo = estado === s.id;
              const n = s.id === "todos" ? conteos.todos : conteos[s.id];
              return (
                <button
                  key={s.id}
                  role="tab"
                  id={`tab-impuestos-${s.id}`}
                  aria-selected={activo}
                  aria-controls="panel-impuestos"
                  type="button"
                  onClick={() => cambiarEstado(s.id)}
                  className={`-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-2.5 py-3 text-[13px] font-semibold transition-colors sm:px-3 ${
                    activo
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s.label}
                  <span
                    className={`rounded px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${
                      activo ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {n}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div id="panel-impuestos" role="tabpanel" aria-labelledby={`tab-impuestos-${estado}`}>
          {ordenados.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
              <IlustracionImpuesto nombre="calendario" size={48} />
              <p className="text-sm text-muted-foreground">
                {impuestos.length === 0
                  ? "No hay impuestos cargados."
                  : "Ningún impuesto coincide con lo que estás filtrando."}
              </p>
              {impuestos.length === 0
                ? canWrite && (
                    <Button variant="brand" size="sm" onClick={openAdd}>
                      <Plus size={14} /> Agregar el primero
                    </Button>
                  )
                : (
                  <Button variant="outline" size="sm" onClick={limpiar}>
                    <X size={14} /> Limpiar filtros
                  </Button>
                )}
            </div>
          ) : (
            <>
              {/* Celular: cada impuesto es una tarjeta. La tabla tiene 9 columnas
                  y es un checklist que se opera con el dedo (tildar, editar
                  fechas, adjuntar), así que abajo de md se apila en vez de
                  scrollear de costado. */}
              <div className="divide-y divide-border md:hidden">
                {visibles.map((i) => (
                  <div key={i.id} className={i.presentado ? "opacity-70" : ""}>
                    <div className="flex items-start gap-3 p-3.5">
                      {canWrite && (
                        <button
                          type="button"
                          title={i.presentado ? "Marcar como pendiente" : "Marcar como presentado"}
                          aria-label={i.presentado ? "Marcar como pendiente" : "Marcar como presentado"}
                          aria-pressed={i.presentado}
                          onClick={() => handleToggle(i)}
                          disabled={togglingId === i.id}
                          className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded border transition-colors ${
                            i.presentado
                              ? "border-emerald-500 bg-emerald-500 text-white"
                              : "border-border hover:border-emerald-400"
                          }`}
                        >
                          {togglingId === i.id ? <Loader2 size={13} className="animate-spin" /> : i.presentado ? <Check size={13} /> : null}
                        </button>
                      )}

                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className={`text-sm font-semibold text-foreground ${i.presentado ? "line-through" : ""}`}>
                              {i.nombre}
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                              {i.organismo && <span className="font-semibold">{i.organismo}</span>}
                              {i.periodo && <span>Período {i.periodo}</span>}
                            </div>
                          </div>
                          <span className="shrink-0">
                            <EstadoImpuestoBadge row={i} />
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
                          <span className="flex flex-col gap-0.5">
                            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Vence</span>
                            <CeldaFecha
                              valor={i.fecha_vencimiento}
                              canEdit={canWrite}
                              onGuardar={guardarVencimiento(i.id)}
                            />
                            <AvisoVencimiento row={i} />
                          </span>
                          <span className="flex flex-col gap-0.5">
                            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Presentado</span>
                            <CeldaFecha
                              valor={i.fecha_presentacion}
                              canEdit={canWrite}
                              permitirVaciar
                              tone="success"
                              placeholder="Sin presentar"
                              onGuardar={guardarPresentacion(i.id)}
                            />
                          </span>
                          <span className="flex flex-col gap-0.5">
                            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Pagado</span>
                            <CeldaImporte
                              valor={i.importe}
                              canEdit={canWrite}
                              onGuardar={guardarImporte(i.id)}
                            />
                            <CeldaFecha
                              valor={i.fecha_pago}
                              canEdit={canWrite}
                              permitirVaciar
                              placeholder="Sin fecha de pago"
                              onGuardar={guardarFechaPago(i.id)}
                            />
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-0.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9 flex-1 justify-center gap-1.5 text-xs"
                            aria-expanded={expandidoId === i.id}
                            onClick={() => setExpandidoId(expandidoId === i.id ? null : i.id)}
                          >
                            <ChevronRight size={14} className={`transition-transform ${expandidoId === i.id ? "rotate-90" : ""}`} />
                            Comprobantes
                            {i.archivos > 0 && (
                              <span className="inline-flex items-center gap-0.5 font-semibold">
                                <Paperclip size={11} />
                                {i.archivos}
                              </span>
                            )}
                          </Button>
                          {canWrite && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-9 w-9 p-0 text-muted-foreground hover:text-primary"
                                title="Editar"
                                aria-label={`Editar ${i.nombre}`}
                                onClick={() => openEdit(i)}
                              >
                                <Pencil size={15} />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-9 w-9 p-0 text-muted-foreground hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                                title="Eliminar"
                                aria-label={`Eliminar ${i.nombre}`}
                                onClick={() => setABorrar(i)}
                              >
                                <Trash2 size={15} />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {expandidoId === i.id && <ImpuestoDetalle impuesto={i} canWrite={canWrite} />}
                  </div>
                ))}
              </div>

              <Table className="hidden min-w-[1120px] md:table">
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="w-8 pl-4" />
                    {canWrite && <TableHead className="w-10" />}
                    <TableHead>
                      <BotonOrden label="Impuesto" campo="nombre" orden={orden} dir={dir} onOrden={cambiarOrden} />
                    </TableHead>
                    <TableHead>
                      <BotonOrden label="Organismo" campo="organismo" orden={orden} dir={dir} onOrden={cambiarOrden} />
                    </TableHead>
                    <TableHead>
                      <BotonOrden label="Vencimiento" campo="vencimiento" orden={orden} dir={dir} onOrden={cambiarOrden} />
                    </TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Presentado el</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Pagado</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Estado</TableHead>
                    {canWrite && (
                      <TableHead className="pr-6 text-right text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Acciones
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibles.map((i) => (
                    <Fragment key={i.id}>
                      <TableRow className={`transition-colors hover:bg-muted/10 ${i.presentado ? "opacity-70" : ""}`}>
                        <TableCell className="pl-4">
                          <button
                            type="button"
                            onClick={() => setExpandidoId(expandidoId === i.id ? null : i.id)}
                            aria-expanded={expandidoId === i.id}
                            aria-label={`Comprobantes e historial de ${i.nombre}`}
                            title="Comprobantes e historial"
                            className="flex items-center gap-1 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
                          >
                            <ChevronRight
                              size={14}
                              className={`transition-transform ${expandidoId === i.id ? "rotate-90" : ""}`}
                            />
                            {i.archivos > 0 && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold">
                                <Paperclip size={10} />
                                {i.archivos}
                              </span>
                            )}
                          </button>
                        </TableCell>
                        {canWrite && (
                          <TableCell className="pl-6">
                            <button
                              type="button"
                              title={i.presentado ? "Marcar como pendiente" : "Marcar como presentado"}
                              aria-label={i.presentado ? "Marcar como pendiente" : "Marcar como presentado"}
                              aria-pressed={i.presentado}
                              onClick={() => handleToggle(i)}
                              disabled={togglingId === i.id}
                              className={`flex size-5 items-center justify-center rounded border transition-colors ${
                                i.presentado
                                  ? "border-emerald-500 bg-emerald-500 text-white"
                                  : "border-border hover:border-emerald-400"
                              }`}
                            >
                              {togglingId === i.id ? <Loader2 size={12} className="animate-spin" /> : i.presentado ? <Check size={12} /> : null}
                            </button>
                          </TableCell>
                        )}
                        <TableCell>
                          {/* El ícono le da un ancla a la fila: con 25 renglones
                              seguidos de texto, el ojo no encuentra dónde
                              empieza cada uno. */}
                          <div className="flex items-center gap-2.5">
                            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/8 text-primary">
                              <FileText size={15} />
                            </span>
                            <div className="min-w-0">
                              <div className={`font-semibold text-foreground ${i.presentado ? "line-through" : ""}`}>
                                {i.nombre}
                              </div>
                              {i.periodo && (
                                <div className="text-[11px] text-muted-foreground">Período {i.periodo}</div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {i.organismo ? (
                            <span className="rounded border border-border bg-muted/60 px-2 py-0.5 text-[11px] font-semibold text-foreground">
                              {i.organismo}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex flex-col gap-0.5">
                            <CeldaFecha
                              valor={i.fecha_vencimiento}
                              canEdit={canWrite}
                              onGuardar={guardarVencimiento(i.id)}
                            />
                            <AvisoVencimiento row={i} />
                          </div>
                        </TableCell>
                        <TableCell>
                          <CeldaFecha
                            valor={i.fecha_presentacion}
                            canEdit={canWrite}
                            permitirVaciar
                            tone="success"
                            placeholder="Sin presentar"
                            onGuardar={guardarPresentacion(i.id)}
                          />
                        </TableCell>
                        {/* Cuánto arriba y cuándo abajo: las dos mitades de la
                            misma pregunta, como el vencimiento con su aviso. */}
                        <TableCell>
                          <div className="flex flex-col items-start gap-0.5">
                            <CeldaImporte
                              valor={i.importe}
                              canEdit={canWrite}
                              onGuardar={guardarImporte(i.id)}
                            />
                            <CeldaFecha
                              valor={i.fecha_pago}
                              canEdit={canWrite}
                              permitirVaciar
                              placeholder="Sin fecha de pago"
                              onGuardar={guardarFechaPago(i.id)}
                            />
                          </div>
                        </TableCell>
                        <TableCell><EstadoImpuestoBadge row={i} /></TableCell>
                        {canWrite && (
                          <TableCell className="pr-6 text-right">
                            {/* Sin confirmación al lado del botón: el "¿seguro?"
                                corría las dos columnas de la derecha y se
                                terminaba tocando lo de otra fila. */}
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-muted-foreground hover:bg-primary/5 hover:text-primary"
                                title="Editar"
                                aria-label={`Editar ${i.nombre}`}
                                onClick={() => openEdit(i)}
                              >
                                <Pencil size={14} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                                title="Eliminar"
                                aria-label={`Eliminar ${i.nombre}`}
                                onClick={() => setABorrar(i)}
                              >
                                <Trash2 size={14} />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                      {expandidoId === i.id && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={canWrite ? 9 : 7} className="p-0">
                            <ImpuestoDetalle impuesto={i} canWrite={canWrite} />
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>

              {/* Pie: qué parte de la lista estás viendo. Va siempre, aunque
                  entre en una sola página — es la línea que dice si lo que ves
                  es todo o un recorte. */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  Mostrando{" "}
                  <span className="font-semibold tabular-nums text-foreground">{desde}–{hasta}</span> de{" "}
                  <span className="tabular-nums">{ordenados.length}</span>{" "}
                  {ordenados.length === 1 ? "impuesto" : "impuestos"}
                  {hayFiltros && (
                    <>
                      {" "}
                      <button
                        type="button"
                        onClick={limpiar}
                        className="font-medium text-primary hover:underline"
                      >
                        (limpiar filtros)
                      </button>
                    </>
                  )}
                </p>

                {totalPaginas > 1 && (
                  <nav aria-label="Paginación" className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="size-8 p-0"
                      disabled={paginaSegura === 1}
                      onClick={() => irAPagina(paginaSegura - 1)}
                      aria-label="Página anterior"
                    >
                      <ChevronLeft size={14} />
                    </Button>
                    {ventanaPaginas(paginaSegura, totalPaginas).map((p, idx) =>
                      p === "…" ? (
                        <span key={`gap-${idx}`} className="px-1 text-xs text-muted-foreground">…</span>
                      ) : (
                        <Button
                          key={p}
                          variant={p === paginaSegura ? "brand" : "outline"}
                          size="sm"
                          className="size-8 p-0 tabular-nums"
                          aria-current={p === paginaSegura ? "page" : undefined}
                          aria-label={`Página ${p}`}
                          onClick={() => irAPagina(p)}
                        >
                          {p}
                        </Button>
                      ),
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="size-8 p-0"
                      disabled={paginaSegura === totalPaginas}
                      onClick={() => irAPagina(paginaSegura + 1)}
                      aria-label="Página siguiente"
                    >
                      <ChevronRight size={14} />
                    </Button>
                  </nav>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <Dialog open={dialog.mode !== "closed"} onOpenChange={(v) => !v && setDialog({ mode: "closed" })}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="text-xl text-foreground">
              {dialog.mode === "edit" ? "Editar impuesto" : "Agregar impuesto"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {dialog.mode === "edit" ? "Actualizá los datos y la fecha de vencimiento." : "Cargá un impuesto y su vencimiento."}
            </DialogDescription>
          </DialogHeader>

          <div
            className="space-y-4 py-2"
            onKeyDown={(e) => {
              // Enter guarda, como en cualquier formulario. Sin esto había que
              // ir hasta el botón con el mouse para cargar cada impuesto.
              if (e.key === "Enter" && puedeGuardar && !saving) handleSave();
            }}
          >
            {error && <InlineFeedback variant="error" message={error} onDismiss={() => setError(null)} autoHideMs={0} />}
            <div className="space-y-2">
              <Label htmlFor="imp-nombre" className="text-sm font-medium text-foreground">Impuesto</Label>
              <Input id="imp-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: IVA, SICORE 1er. Q…" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="imp-org" className="text-sm font-medium text-foreground">Organismo</Label>
                {/* Lista de los que ya se usaron, pero se puede escribir uno
                    nuevo: el catálogo no está cerrado (cada provincia suma el
                    suyo) y un desplegable cerrado dejaría afuera al que falta. */}
                <Input
                  id="imp-org"
                  list="impuestos-organismos"
                  value={organismoForm}
                  onChange={(e) => setOrganismoForm(e.target.value)}
                  placeholder="AFIP, ARBA…"
                />
                <datalist id="impuestos-organismos">
                  {organismos.map((o) => <option key={o} value={o} />)}
                </datalist>
              </div>
              <div className="space-y-2">
                <Label htmlFor="imp-fecha" className="text-sm font-medium text-foreground">Vencimiento</Label>
                <Input id="imp-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="imp-periodo" className="text-sm font-medium text-foreground">
                Período <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Input id="imp-periodo" value={periodo} onChange={(e) => setPeriodo(e.target.value)} placeholder="Ej: 2026-07" />
            </div>
            {dialog.mode === "edit" && (
              <div className="space-y-2">
                <Label htmlFor="imp-obs" className="text-sm font-medium text-foreground">
                  Observaciones <span className="font-normal text-muted-foreground">(opcional)</span>
                </Label>
                <Input id="imp-obs" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setDialog({ mode: "closed" })} disabled={saving}>Cancelar</Button>
            <Button variant="brand" onClick={handleSave} disabled={saving || !puedeGuardar}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              {dialog.mode === "edit" ? "Guardar cambios" : "Agregar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={aBorrar !== null}
        onOpenChange={(o) => !o && setABorrar(null)}
        title="Eliminar impuesto"
        description={
          aBorrar ? (
            <>
              Se va a borrar <span className="font-semibold text-foreground">{aBorrar.nombre}</span>
              {aBorrar.periodo ? ` (período ${aBorrar.periodo})` : ""} y sus comprobantes. No se puede deshacer.
            </>
          ) : undefined
        }
        confirmLabel="Eliminar"
        loading={deletingId !== null}
        onConfirm={handleDelete}
      />
    </div>
  );
}

/**
 * Cuánto se pagó en cada mes — la tira arriba de la lista.
 *
 * *"No te dice: este mes tenés tanto"* fue el pedido de la mamá de Bárbara para
 * los cheques (25/08) y es el mismo para los impuestos (27/08). Se dibuja igual
 * que la tira de meses de /cheques a propósito: es la misma pregunta.
 *
 * **Mira TODOS los impuestos, no los filtrados.** El total de junio es el total
 * de junio; si cambiara al escribir en el buscador dejaría de ser un dato del
 * mes y pasaría a ser un dato de la búsqueda, que no es lo que se está
 * preguntando. Las cuatro tarjetas de arriba se cuentan igual.
 *
 * Lo que falta cargar se dice, no se esconde: un total que se come en silencio
 * los que no tienen importe se lee como el gasto del mes sin serlo.
 */
function TotalesPorMes({ impuestos }: { impuestos: ImpuestoRow[] }) {
  const meses = useMemo(() => totalesPorPeriodo(impuestos), [impuestos]);
  const general = useMemo(() => totalGeneral(impuestos), [impuestos]);

  if (meses.length === 0) return null;

  // Con un solo período la tira sería una tarjeta sola al lado del total, que
  // dice dos veces lo mismo: se muestra el renglón del total y listo.
  const unSoloMes = meses.length === 1;

  return (
    <section
      aria-label="Cuánto se pagó por mes"
      className="rounded-[8px] border border-border bg-card p-3 shadow-sm sm:p-4"
    >
      <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Wallet size={14} className="text-muted-foreground" />
          Pagado por mes
        </h2>
        <p className="text-xs text-muted-foreground">
          Total ${" "}
          <span className="font-semibold tabular-nums text-foreground">
            {general.total.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          {general.sinImporte > 0 && (
            <span className="text-amber-700">
              {" "}· {general.sinImporte} sin cargar
            </span>
          )}
        </p>
      </div>

      {unSoloMes ? (
        <p className="text-xs text-muted-foreground">
          Todo lo cargado es de <span className="font-medium text-foreground">{meses[0]!.label}</span>.
          {meses[0]!.sinImporte > 0 && " Cargá el importe de cada uno para ver el total del mes."}
        </p>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
          {meses.map((m) => (
            <div
              key={m.periodo ?? "sin-periodo"}
              className="flex min-w-[8.5rem] shrink-0 flex-col items-start gap-0.5 rounded-[8px] border border-border px-3 py-2"
            >
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {m.label}
              </span>
              <span className="text-[15px] font-semibold tabular-nums text-foreground">
                $ {Math.round(m.total).toLocaleString("es-AR")}
              </span>
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {m.conImporte} de {m.conImporte + m.sinImporte}
                {m.sinImporte > 0 && <span className="text-amber-700"> · {m.sinImporte} sin cargar</span>}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
