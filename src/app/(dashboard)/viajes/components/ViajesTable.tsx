"use client";

import React, { useState, useEffect, useTransition, useRef } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyTableRow } from "@/components/ui/EmptyState";
import StatusBadge from "@/components/ui/StatusBadge";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import {
  Loader2,
  X,
  ChevronDown,
  ChevronUp,
  Trash2,
  CheckCircle2,
  Clock,
  Coins,
  FileText,
  Truck,
  User,
  Pencil,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Receipt,
  CalendarDays,
  Route,
  Package,
  Hash,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  getViajesAction,
  deleteViajeAction,
  updateViajeEstadoAction,
  type ViajeOrderBy,
} from "../actions";
import { getViajeDetalleAction, type ViajeDetalle } from "../detalle-action";
import type { ViajeBasico } from "../types";
import { formatFecha } from "@/lib/utils";
import HelpTutorialButton from "../help-tutorial-button";
import AuditTrailDrawer from "./audit-trail-drawer";
import ViajeGastosPanel, { type GastoFormData } from "./ViajeGastosPanel";
import ViajeDocumentosPanel from "./ViajeDocumentosPanel";
import { esFacturable } from "../flujo-logic";
import CerrarViajeDialog from "./CerrarViajeDialog";
import EditViajeDialog from "./EditViajeDialog";
import ExportViajesButton from "./ExportViajesButton";
import FacturarBloqueDialog from "./FacturarBloqueDialog";

/** Una fila es seleccionable si se puede facturar. */
function esSeleccionable(v: ViajeBasico): boolean {
  return esFacturable(v);
}

/** Filtro empujado desde las tarjetas de estadísticas (clic). */
export interface FiltroExterno {
  estado: string;
  facturado: boolean | null;
  esVacio: boolean | null;
  nonce: number;
}

interface Props {
  choferId?: string;
  filtroExterno?: FiltroExterno;
  onFiltroChange?: (f: {
    estado: string;
    facturado: boolean | null;
    esVacio: boolean | null;
  }) => void;
  /** Datos de formulario de gasto, resueltos en la página y compartidos por todas
   *  las filas (evita re-pedirlos al expandir cada viaje). */
  gastoFormData: GastoFormData;
}

const ESTADO_TONE: Record<string, "success" | "warning" | "info" | "neutral" | "error"> = {
  cerrado: "success",
  en_curso: "info",
  pendiente: "warning",
  cancelado: "error",
};

type ColumnDef = {
  label: string;
  sortKey?: ViajeOrderBy;
  /** Clases responsive aplicadas tanto al <th> como a la <td> correspondiente. */
  cellClass?: string;
  align?: "left" | "right";
};

const COLUMNS: ColumnDef[] = [
  { label: "", cellClass: "w-10" },
  { label: "Fecha", sortKey: "fecha" },
  { label: "Cliente" },
  { label: "Chofer", cellClass: "hidden lg:table-cell" },
  { label: "Origen", cellClass: "hidden sm:table-cell" },
  { label: "Destino", cellClass: "hidden sm:table-cell" },
  { label: "KM", cellClass: "hidden sm:table-cell" },
  // Igual que la planilla del cliente: los km vacíos van en su propia columna.
  { label: "KM vacíos", cellClass: "hidden sm:table-cell" },
  { label: "Toneladas", sortKey: "toneladas", cellClass: "hidden sm:table-cell" },
  { label: "Remito Nº", cellClass: "hidden xl:table-cell" },
  { label: "Material", cellClass: "hidden xl:table-cell" },
  { label: "Importe", sortKey: "monto", cellClass: "hidden lg:table-cell", align: "right" },
  { label: "Estado" },
  { label: "Remito", cellClass: "hidden sm:table-cell" },
  { label: "" },
];

const ESTADO_LABELS: Record<string, string> = {
  pendiente: "Pendiente",
  en_curso: "En curso",
  cerrado: "Cerrado",
  cancelado: "Cancelado",
};

const ESTADO_BADGE: Record<string, string> = {
  cerrado: "bg-green-100 text-green-700",
  en_curso: "bg-sky-100 text-sky-700",
  pendiente: "bg-amber-100 text-amber-700",
  cancelado: "bg-red-100 text-red-700",
};

const VIA_LABELS: Record<string, string> = { ruta_5: "Ruta 5", ruta_22: "Ruta 22" };

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Fila etiqueta → valor del panel de detalle. */
function DetField({
  label,
  value,
  mono,
  strong,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  strong?: boolean;
  tone?: string;
}) {
  const vacio = value == null || value === "" || value === "—";
  return (
    <div className="flex items-baseline justify-between gap-2 py-1">
      <span className="text-[11px] text-muted-foreground shrink-0">{label}</span>
      <span
        className={`text-[11px] text-right ${mono ? "font-mono" : ""} ${
          strong ? "font-bold" : "font-medium"
        } ${vacio ? "text-muted-foreground/40" : tone ?? "text-foreground/90"}`}
      >
        {vacio ? "—" : value}
      </span>
    </div>
  );
}

function DetSkeleton({ n }: { n: number }) {
  return (
    <div className="py-1.5 space-y-2">
      {Array.from({ length: n }).map((_, i) => (
        <Skeleton key={i} className="h-3 w-full" />
      ))}
    </div>
  );
}

/** Encabezado del panel expandido: código, estado, quién/cuándo lo cargó y la ruta. */
function ViajeDetalleHeader({
  viaje: v,
  detalle,
}: {
  viaje: ViajeBasico;
  detalle: ViajeDetalle | "loading" | "error" | undefined;
}) {
  const det = typeof detalle === "object" ? detalle : null;
  return (
    <div className="rounded-xl border border-border/80 bg-card px-4 py-3 shadow-2xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm font-bold text-foreground">{v.codigo}</span>
        <span
          className={`rounded-full text-[10px] font-bold px-2 py-0.5 ${
            ESTADO_BADGE[v.estado] ?? "bg-muted text-muted-foreground"
          }`}
        >
          {ESTADO_LABELS[v.estado] ?? v.estado}
        </span>
        {v.es_vacio && (
          <span className="rounded-full bg-[#C00000]/10 text-[#C00000] text-[10px] font-bold px-2 py-0.5">
            VACÍO
          </span>
        )}
        {v.facturado && (
          <span className="rounded-full bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 inline-flex items-center gap-1">
            <CheckCircle2 size={11} /> Facturado
          </span>
        )}
        {v.cobrado && (
          <span className="rounded-full bg-sky-100 text-sky-700 text-[10px] font-bold px-2 py-0.5">
            Cobrado
          </span>
        )}
      </div>
      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap text-[11px] text-muted-foreground">
        <CalendarDays size={12} className="shrink-0" />
        Cargado el {fmtDateTime(det?.createdAt ?? null)}
        {det?.creadoPor && (
          <>
            · por <span className="font-medium text-foreground/80">{det.creadoPor}</span>
          </>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
        <span className="inline-flex items-center gap-1 font-medium text-foreground/90">
          <Route size={12} className="text-primary shrink-0" /> {v.origen ?? "—"} → {v.destino ?? "—"}
        </span>
        {det?.rutaVia && (
          <span className="rounded bg-muted px-1.5 py-0.5 font-semibold text-foreground/80">
            {VIA_LABELS[det.rutaVia] ?? det.rutaVia}
          </span>
        )}
        {det?.tipoCarga && (
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Package size={12} /> {det.tipoCarga}
          </span>
        )}
        {v.material && <span className="text-muted-foreground">{v.material}</span>}
        {!v.es_vacio && v.nro_remito && (
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Hash size={11} /> Remito {v.nro_remito}
          </span>
        )}
      </div>
    </div>
  );
}

/** Tarjeta con los datos del chofer (traídos al expandir la fila). */
function ChoferCard({
  detalle,
  choferNombre,
}: {
  detalle: ViajeDetalle | "loading" | "error" | undefined;
  choferNombre: string | null;
}) {
  const det = typeof detalle === "object" ? detalle : null;
  const c = det?.chofer;
  const cargando = detalle === "loading";
  return (
    <div className="rounded-xl border border-border/80 bg-card p-3 shadow-2xs">
      <h4 className="text-[11px] font-bold uppercase tracking-wide text-foreground flex items-center gap-1.5 border-b border-border pb-2 mb-1">
        <User size={13} className="text-primary" /> Chofer
      </h4>
      <div className="divide-y divide-border/40">
        <DetField
          label="Nombre"
          value={c ? [c.apellido, c.nombre].filter(Boolean).join(", ") : choferNombre}
          strong
        />
        {cargando ? (
          <DetSkeleton n={4} />
        ) : (
          <>
            <DetField label="Teléfono" value={c?.telefono} mono />
            <DetField label="DNI" value={c?.dni} mono />
            <DetField label="Localidad" value={c?.localidad} />
            <DetField label="Ingreso" value={c?.fecha_ingreso ? formatFecha(c.fecha_ingreso) : "—"} />
          </>
        )}
      </div>
    </div>
  );
}

/** Tarjeta con los datos del camión + el flete y las distancias del viaje. */
function CamionFleteCard({
  detalle,
  viaje: v,
}: {
  detalle: ViajeDetalle | "loading" | "error" | undefined;
  viaje: ViajeBasico;
}) {
  const det = typeof detalle === "object" ? detalle : null;
  const cam = det?.camion;
  const cargando = detalle === "loading";
  return (
    <div className="rounded-xl border border-border/80 bg-card p-3 shadow-2xs">
      <h4 className="text-[11px] font-bold uppercase tracking-wide text-foreground flex items-center gap-1.5 border-b border-border pb-2 mb-1">
        <Truck size={13} className="text-primary" /> Camión &amp; flete
      </h4>
      <div className="divide-y divide-border/40">
        <DetField label="Patente" value={cam?.patente ?? v.camion} mono strong />
        {cargando ? (
          <DetSkeleton n={3} />
        ) : (
          <>
            <DetField label="Marca / Modelo" value={[cam?.marca, cam?.modelo].filter(Boolean).join(" ")} />
            <DetField label="Capacidad" value={cam?.capacidad_tn != null ? `${cam.capacidad_tn} tn` : "—"} mono />
            <DetField
              label="Km actual"
              value={cam?.km_actual != null ? `${cam.km_actual.toLocaleString("es-AR")} km` : "—"}
              mono
            />
          </>
        )}
        <DetField
          label="Monto flete"
          value={v.monto_flete ? `$ ${v.monto_flete.toLocaleString("es-AR")}` : "—"}
          mono
          strong
          tone="text-[#10B981]"
        />
        <DetField label="Km con carga" value={`${(v.km_con_carga ?? 0).toLocaleString("es-AR")} km`} mono />
        <DetField
          label="Km vacíos"
          value={`${(v.km_vacios ?? 0).toLocaleString("es-AR")} km`}
          mono
          tone={v.km_vacios ? "text-[#C00000]" : undefined}
        />
        <DetField
          label="Toneladas"
          value={v.toneladas != null ? `${v.toneladas.toLocaleString("es-AR")} tn` : "—"}
          mono
        />
      </div>
    </div>
  );
}

export default function ViajesTable({ choferId, filtroExterno, onFiltroChange, gastoFormData }: Props) {

  const [rows, setRows] = useState<ViajeBasico[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Detalle rico (chofer, camión, quién/cuándo lo cargó), traído al expandir.
  const [detalles, setDetalles] = useState<
    Record<string, ViajeDetalle | "loading" | "error">
  >({});
  useEffect(() => {
    const id = expandedId;
    if (!id || detalles[id]) return;
    let cancel = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- marcar "cargando" al abrir la fila
    setDetalles((p) => ({ ...p, [id]: "loading" }));
    getViajeDetalleAction(id).then((res) => {
      if (cancel) return;
      setDetalles((p) => ({ ...p, [id]: "error" in res ? "error" : res }));
    });
    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al cambiar de fila expandida
  }, [expandedId]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [auditTrailOpen, setAuditTrailOpen] = useState(false);
  const [auditTrailViajeId, setAuditTrailViajeId] = useState<string | null>(null);
  const [cerrandoViaje, setCerrandoViaje] = useState<ViajeBasico | null>(null);
  const [editingViaje, setEditingViaje] = useState<ViajeBasico | null>(null);
  const [confirmEditViaje, setConfirmEditViaje] = useState<ViajeBasico | null>(null);

  // Selección múltiple para facturación en bloque.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [facturarOpen, setFacturarOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [facturadoFiltro, setFacturadoFiltro] = useState<boolean | null>(null);
  const [esVacioFiltro, setEsVacioFiltro] = useState<boolean | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [allLoaded, setAllLoaded] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [orderBy, setOrderBy] = useState<ViajeOrderBy>("fecha");
  const [orderDir, setOrderDir] = useState<"asc" | "desc">("desc");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const handler = () => setRefreshToken((t) => t + 1);
    window.addEventListener("viaje-created", handler);
    return () => window.removeEventListener("viaje-created", handler);
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  // Aplicar filtro empujado desde las tarjetas de estadísticas (clic en tarjeta).
  // Patrón "ajustar estado al cambiar un prop": se setea durante el render
  // comparando contra el último nonce procesado, evitando un efecto.
  const [ultimoNonce, setUltimoNonce] = useState<number | undefined>(undefined);
  if (filtroExterno && filtroExterno.nonce !== ultimoNonce) {
    setUltimoNonce(filtroExterno.nonce);
    setEstadoFiltro(filtroExterno.estado);
    setFacturadoFiltro(filtroExterno.facturado);
    setEsVacioFiltro(filtroExterno.esVacio);
  }

  // Reportar el filtro actual al contenedor (para resaltar la tarjeta activa).
  useEffect(() => {
    onFiltroChange?.({ estado: estadoFiltro, facturado: facturadoFiltro, esVacio: esVacioFiltro });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estadoFiltro, facturadoFiltro, esVacioFiltro]);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronización intencional al cambiar props/abrir (carga o reset de estado)
    setLoading(true);
    setError(null);

    getViajesAction({
      choferId,
      page: 0,
      desde: desde || undefined,
      hasta: hasta || undefined,
      estado: estadoFiltro ? [estadoFiltro] : undefined,
      facturado: facturadoFiltro ?? undefined,
      esVacio: esVacioFiltro ?? undefined,
      search: debouncedSearch || undefined,
      orderBy,
      orderDir,
    }).then((result) => {
      if (cancelled) return;
      if ("error" in result) {
        setError(result.error);
      } else {
        setRows(result.data);
        setHasMore(result.hasMore);
        setAllLoaded(false);
        setPage(0);
        setSelectedIds(new Set());
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [choferId, desde, hasta, estadoFiltro, facturadoFiltro, esVacioFiltro, debouncedSearch, refreshToken, orderBy, orderDir]);

  const loadMore = () => {
    startTransition(async () => {
      const nextPage = page + 1;
      const result = await getViajesAction({
        choferId,
        page: nextPage,
        desde: desde || undefined,
        hasta: hasta || undefined,
        estado: estadoFiltro ? [estadoFiltro] : undefined,
        facturado: facturadoFiltro ?? undefined,
        esVacio: esVacioFiltro ?? undefined,
        search: debouncedSearch || undefined,
        orderBy,
        orderDir,
      });
      if ("data" in result) {
        setRows((prev) => [...prev, ...result.data]);
        setHasMore(result.hasMore);
        setPage(nextPage);
        if (!result.hasMore) setAllLoaded(true);
      }
    });
  };

  const hayFiltros =
    !!desde || !!hasta || !!search || !!estadoFiltro || facturadoFiltro !== null || esVacioFiltro !== null;

  const limpiarFiltros = () => {
    setDesde("");
    setHasta("");
    setSearch("");
    setEstadoFiltro("");
    setFacturadoFiltro(null);
    setEsVacioFiltro(null);
  };

  const toggleOrden = (key: ViajeOrderBy) => {
    if (orderBy === key) {
      setOrderDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setOrderBy(key);
      setOrderDir(key === "fecha" ? "desc" : "asc");
    }
  };

  // --- Selección múltiple (facturación en bloque) -------------------------
  const seleccionablesCargadas = rows.filter(esSeleccionable);
  const selectedViajes = rows.filter((v) => selectedIds.has(v.id));
  // Subconjunto elegible para la acción en bloque.
  const selectedFacturables = selectedViajes.filter(esFacturable);
  const allSeleccionablesSelected =
    seleccionablesCargadas.length > 0 && seleccionablesCargadas.every((v) => selectedIds.has(v.id));

  const toggleSeleccion = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSeleccionarTodos = () => {
    setSelectedIds((prev) => {
      if (seleccionablesCargadas.length > 0 && seleccionablesCargadas.every((v) => prev.has(v.id))) {
        return new Set();
      }
      return new Set(seleccionablesCargadas.map((v) => v.id));
    });
  };

  const onFacturadoEnBloque = (patches: Map<string, Partial<ViajeBasico>>) => {
    setRows((prev) => prev.map((v) => (patches.has(v.id) ? { ...v, ...patches.get(v.id)! } : v)));
    setSelectedIds(new Set());
  };

  // Totales sobre las filas ya cargadas (no sobre el total del filtro completo).
  const totales = rows.reduce(
    (acc, v) => {
      acc.km += v.km_con_carga ?? 0;
      acc.kmVacios += v.km_vacios ?? 0;
      acc.toneladas += v.toneladas ?? 0;
      acc.flete += v.monto_flete ?? 0;
      return acc;
    },
    { km: 0, kmVacios: 0, toneladas: 0, flete: 0 },
  );

  return (
    <div className="bg-card rounded-[8px] border border-border shadow-sm">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-border bg-muted/40">
        <HelpTutorialButton />
        <Input
          type="date"
          value={desde}
          onChange={(e) => setDesde(e.target.value)}
          className="text-sm w-36"
          aria-label="Fecha desde"
        />
        <Input
          type="date"
          value={hasta}
          onChange={(e) => setHasta(e.target.value)}
          className="text-sm w-36"
          aria-label="Fecha hasta"
        />
        <Input
          type="text"
          placeholder="Buscar por código, chofer, camión..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-sm flex-1 min-w-[11rem]"
          aria-label="Buscar viaje por código"
        />
        <Combobox
          value={estadoFiltro}
          onValueChange={setEstadoFiltro}
          options={[
            { id: "", label: "Todos los estados" },
            { id: "pendiente", label: "Pendiente" },
            { id: "en_curso", label: "En curso" },
            { id: "cerrado", label: "Cerrado" },
            { id: "cancelado", label: "Cancelado" },
          ]}
          searchable={false}
          triggerClassName="h-9 w-44"
          aria-label="Filtrar por estado"
        />
        {hayFiltros && (
          <Button
            variant="ghost"
            size="sm"
            onClick={limpiarFiltros}
            className="text-muted-foreground hover:text-foreground h-9"
            aria-label="Limpiar todos los filtros"
          >
            <X size={13} className="mr-1" />
            Limpiar filtros
          </Button>
        )}
        <div className="ml-auto">
          <ExportViajesButton
            choferId={choferId}
            desde={desde || undefined}
            hasta={hasta || undefined}
            estado={estadoFiltro || undefined}
            facturado={facturadoFiltro ?? undefined}
            esVacio={esVacioFiltro ?? undefined}
            search={debouncedSearch || undefined}
            disabled={loading || rows.length === 0}
          />
        </div>
      </div>

      {/* Barra de selección para facturar en bloque */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-border bg-[#10B981]/5">
          <span className="text-sm font-semibold text-foreground">
            {selectedIds.size} viaje{selectedIds.size !== 1 ? "s" : ""} seleccionado{selectedIds.size !== 1 ? "s" : ""}
          </span>
          {selectedFacturables.length > 0 && (
            <Button
              size="sm"
              className="bg-[#10B981] hover:bg-[#059669] text-white gap-1.5"
              onClick={() => setFacturarOpen(true)}
            >
              <Receipt size={14} />
              Facturar {selectedFacturables.length}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => setSelectedIds(new Set())}
          >
            <X size={13} className="mr-1" />
            Limpiar selección
          </Button>
        </div>
      )}

      {/* Tabla */}
      <div className="overflow-x-auto">
      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow>
            {COLUMNS.map((col, i) => {
              const isSorted = col.sortKey && orderBy === col.sortKey;
              return (
                <TableHead
                  key={i}
                  className={`text-xs font-semibold text-muted-foreground uppercase tracking-wide ${col.cellClass ?? ""}`}
                >
                  {i === 0 ? (
                    <input
                      type="checkbox"
                      aria-label="Seleccionar todos los viajes facturables"
                      className="size-4 accent-[#0088D1] cursor-pointer align-middle disabled:cursor-not-allowed disabled:opacity-40"
                      checked={allSeleccionablesSelected}
                      disabled={seleccionablesCargadas.length === 0}
                      onChange={toggleSeleccionarTodos}
                    />
                  ) : col.sortKey ? (
                    <button
                      type="button"
                      onClick={() => toggleOrden(col.sortKey!)}
                      className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                      aria-label={`Ordenar por ${col.label}`}
                    >
                      {col.label}
                      {isSorted ? (
                        orderDir === "asc" ? (
                          <ArrowUp size={12} />
                        ) : (
                          <ArrowDown size={12} />
                        )
                      ) : (
                        <ArrowUpDown size={12} className="opacity-40" />
                      )}
                    </button>
                  ) : (
                    col.label
                  )}
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <TableRow key={i}>
                {COLUMNS.map((_, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : error ? (
            <TableRow>
              <TableCell
                colSpan={COLUMNS.length}
                className="py-12 text-center text-red-500 text-sm"
              >
                {error}
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <EmptyTableRow message="Sin viajes registrados" />
          ) : (
            rows.map((v) => (
              <React.Fragment key={v.id}>
                <TableRow
                  className="hover:bg-muted/40 transition-colors cursor-pointer"
                  tabIndex={0}
                  onClick={() => setExpandedId(expandedId === v.id ? null : v.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setExpandedId(expandedId === v.id ? null : v.id);
                  }}
                >
                  <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
                    {esSeleccionable(v) ? (
                      <input
                        type="checkbox"
                        aria-label={`Seleccionar viaje ${v.codigo}`}
                        className="size-4 accent-[#0088D1] cursor-pointer align-middle"
                        checked={selectedIds.has(v.id)}
                        onChange={() => toggleSeleccion(v.id)}
                      />
                    ) : v.facturado ? (
                      <CheckCircle2 size={15} className="text-[#10B981]" aria-label="Con remito" />
                    ) : null}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatFecha(v.fecha_viaje)}
                  </TableCell>
                  <TableCell className="text-sm font-medium text-foreground">
                    {v.cliente ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground hidden lg:table-cell">
                    {v.chofer ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground hidden sm:table-cell">
                    {v.origen ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground hidden sm:table-cell">
                    {v.destino ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground font-mono hidden sm:table-cell">
                    {v.es_vacio ? (
                      <span className="text-muted-foreground/50">—</span>
                    ) : (
                      `${(v.km_con_carga ?? 0).toLocaleString("es-AR")} km`
                    )}
                  </TableCell>
                  <TableCell className="text-sm font-mono hidden sm:table-cell">
                    {(v.km_vacios ?? 0) > 0 ? (
                      <span className="text-[#C00000] font-semibold">{v.km_vacios.toLocaleString("es-AR")} km</span>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground font-mono hidden sm:table-cell">
                    {v.toneladas ?? 0} tn
                  </TableCell>
                  <TableCell className="text-sm font-mono hidden xl:table-cell">
                    {v.es_vacio ? (
                      // Igual que la planilla Excel del cliente: "VACIO" en rojo en el remito.
                      <span className="text-[#C00000] font-bold">VACIO</span>
                    ) : v.nro_remito && v.nro_remito.toUpperCase() !== "VACIO" ? (
                      <span className="text-muted-foreground">{v.nro_remito}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground hidden xl:table-cell max-w-[12rem] truncate">
                    {v.material ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm font-mono text-right hidden lg:table-cell">
                    {v.monto_flete != null ? (
                      <span className="font-semibold text-[#10B981]">
                        $ {v.monto_flete.toLocaleString("es-AR")}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/70">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {/* El vacío ya se indica con "VACIO" en el remito y en KM vacíos. */}
                    <StatusBadge
                      label={v.estado.replace("_", " ")}
                      tone={ESTADO_TONE[v.estado] ?? "neutral"}
                    />
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${
                        v.facturado
                          ? "bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/30"
                          : "bg-[#C00000]/10 text-[#C00000] border border-[#C00000]/30"
                      }`}
                    >
                      {v.facturado ? "REMITO" : "SIN REMITO"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Expandir detalles"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedId(expandedId === v.id ? null : v.id);
                      }}
                    >
                      {expandedId === v.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </Button>
                  </TableCell>
                </TableRow>

                {/* Sub-fila Desplegable de Detalles */}
                {expandedId === v.id && (
                  <TableRow className="bg-muted/60 hover:bg-muted/60">
                    <TableCell colSpan={COLUMNS.length} className="p-0 border-b border-border">
                      <div className="p-4 sm:p-5 space-y-4 animate-in fade-in-50 duration-200">
                        <ViajeDetalleHeader viaje={v} detalle={detalles[v.id]} />
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <ChoferCard detalle={detalles[v.id]} choferNombre={v.chofer} />

                        <CamionFleteCard detalle={detalles[v.id]} viaje={v} />

                        {/* Notas y Acciones Operativas */}
                        <div className="space-y-3 flex flex-col justify-between bg-card p-4 rounded-lg border border-border/80 shadow-2xs">
                          <div>
                            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide flex items-center gap-1.5 border-b border-border pb-2">
                              <FileText size={14} className="text-[#F59E0B]" /> Notas / Descripción
                            </h4>
                            {v.nro_viaje_ypf && (
                              <p className="text-xs font-semibold text-primary pt-1.5">
                                Nº viaje: <span className="font-mono">{v.nro_viaje_ypf}</span>
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground pt-1.5 italic line-clamp-3">
                              {v.observaciones
                                ? v.observaciones
                                    .split("|")
                                    .filter((p) => !p.includes("Origen:") && !p.includes("Destino:"))
                                    .join(" | ")
                                    .trim() || "Sin notas adicionales"
                                : "Sin notas adicionales"}
                            </p>
                          </div>

                          <div className="pt-3 border-t border-border space-y-2.5">
                            {v.facturado ? (
                              <>
                                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                                  <CheckCircle2 size={14} className="text-green-600 shrink-0" />
                                  <span className="text-[11px] font-semibold text-green-700">
                                    Viaje facturado — remito y valor cargados
                                  </span>
                                </div>
                                <div className="pt-1 flex justify-between items-center">
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="xs"
                                      className="h-7 px-2 text-primary hover:text-[#0277BD] hover:bg-[#E1F5FE] text-[11px] gap-1"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setAuditTrailViajeId(v.id);
                                        setAuditTrailOpen(true);
                                      }}
                                    >
                                      <Clock size={12} /> Historial
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="xs"
                                      className="h-7 px-2 text-muted-foreground hover:text-foreground hover:bg-muted text-[11px] gap-1"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setConfirmEditViaje(v);
                                      }}
                                    >
                                      <Pencil size={12} /> Editar
                                    </Button>
                                  </div>
                                  {deletingId === v.id ? (
                                    <div className="flex items-center gap-2">
                                      <span className="text-[11px] text-red-600 font-medium">¿Confirmar?</span>
                                      <Button
                                        variant="destructive"
                                        size="xs"
                                        className="h-6 px-2 text-[10px]"
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          const res = await deleteViajeAction(v.id);
                                          if (res && res.ok) {
                                            setRows((prev) => prev.filter((item) => item.id !== v.id));
                                            setExpandedId(null);
                                          }
                                          setDeletingId(null);
                                        }}
                                      >
                                        Sí, borrar
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="xs"
                                        className="h-6 px-2 text-[10px]"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setDeletingId(null);
                                        }}
                                      >
                                        No
                                      </Button>
                                    </div>
                                  ) : (
                                    <Button
                                      variant="ghost"
                                      size="xs"
                                      className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 text-[11px] gap-1"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDeletingId(v.id);
                                      }}
                                    >
                                      <Trash2 size={12} /> Eliminar Viaje
                                    </Button>
                                  )}
                                </div>
                              </>
                            ) : (
                              <>
                                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                                  Cambiar Estado Operativo:
                                </span>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {["pendiente", "en_curso", "cerrado"].map((st) => {
                                    const isCurrent = v.estado === st;
                                    const isUpd = updatingId === `${v.id}-${st}`;
                                    const labels: Record<string, string> = {
                                      pendiente: "Pendiente",
                                      en_curso: "En Curso",
                                      cerrado: "Cerrado",
                                    };
                                    return (
                                      <Button
                                        key={st}
                                        variant={isCurrent ? "default" : "outline"}
                                        size="xs"
                                        disabled={isCurrent || isUpd || updatingId !== null}
                                        className={`text-[11px] h-7 px-2.5 ${isCurrent ? "bg-[#0F172A]" : ""}`}
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          if (st === "cerrado") {
                                            setCerrandoViaje(v);
                                            return;
                                          }
                                          setUpdatingId(`${v.id}-${st}`);
                                          const res = await updateViajeEstadoAction(v.id, st);
                                          setUpdatingId(null);
                                          if (res && res.ok) {
                                            setRows((prev) =>
                                              prev.map((item) => (item.id === v.id ? { ...item, estado: st } : item))
                                            );
                                          }
                                        }}
                                      >
                                        {isUpd && <Loader2 size={10} className="animate-spin mr-1" />}
                                        {labels[st]}
                                      </Button>
                                    );
                                  })}
                                </div>

                                {v.estado === "cerrado" && !v.facturado && (
                                  <Button
                                    variant="outline"
                                    size="xs"
                                    className="h-7 px-2.5 text-[11px] gap-1 text-green-700 border-green-300 hover:bg-green-50 w-full mt-1"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setCerrandoViaje(v);
                                    }}
                                  >
                                    <Coins size={12} /> Cargar remito / importe
                                  </Button>
                                )}

                                <div className="pt-2 flex justify-between items-center">
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="xs"
                                      className="h-7 px-2 text-primary hover:text-[#0277BD] hover:bg-[#E1F5FE] text-[11px] gap-1"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setAuditTrailViajeId(v.id);
                                        setAuditTrailOpen(true);
                                      }}
                                    >
                                      <Clock size={12} /> Historial
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="xs"
                                      className="h-7 px-2 text-muted-foreground hover:text-foreground hover:bg-muted text-[11px] gap-1"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (v.facturado) {
                                          setConfirmEditViaje(v);
                                        } else {
                                          setEditingViaje(v);
                                        }
                                      }}
                                    >
                                      <Pencil size={12} /> Editar
                                    </Button>
                                  </div>
                                  {deletingId === v.id ? (
                                    <div className="flex items-center gap-2">
                                      <span className="text-[11px] text-red-600 font-medium">¿Confirmar?</span>
                                      <Button
                                        variant="destructive"
                                        size="xs"
                                        className="h-6 px-2 text-[10px]"
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          const res = await deleteViajeAction(v.id);
                                          if (res && res.ok) {
                                            setRows((prev) => prev.filter((item) => item.id !== v.id));
                                            setExpandedId(null);
                                          }
                                          setDeletingId(null);
                                        }}
                                      >
                                        Sí, borrar
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="xs"
                                        className="h-6 px-2 text-[10px]"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setDeletingId(null);
                                        }}
                                      >
                                        No
                                      </Button>
                                    </div>
                                  ) : (
                                    <Button
                                      variant="ghost"
                                      size="xs"
                                      className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 text-[11px] gap-1"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDeletingId(v.id);
                                      }}
                                    >
                                      <Trash2 size={12} /> Eliminar Viaje
                                    </Button>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <ViajeDocumentosPanel viajeId={v.id} />

                        <ViajeGastosPanel
                          viajeId={v.id}
                          formData={gastoFormData}
                          montoFlete={v.monto_flete ?? null}
                          moneda={v.moneda ?? "ARS"}
                          esVacio={v.es_vacio}
                        />
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            ))
          )}
        </TableBody>
      </Table>
      </div>

      {/* Resumen de totales sobre los viajes cargados */}
      {!loading && !error && rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3 border-t border-border bg-muted/30 text-xs">
          <span className="text-muted-foreground/80 font-semibold uppercase tracking-wide">
            Totales <span className="font-normal normal-case">(sobre {rows.length} cargados)</span>
          </span>
          <span className="text-muted-foreground">
            KM:{" "}
            <span className="font-mono font-semibold text-foreground">
              {totales.km.toLocaleString("es-AR")}
            </span>
          </span>
          <span className="text-muted-foreground">
            KM vacíos:{" "}
            <span className="font-mono font-semibold text-[#C00000]">
              {totales.kmVacios.toLocaleString("es-AR")}
            </span>
          </span>
          <span className="text-muted-foreground">
            Toneladas:{" "}
            <span className="font-mono font-semibold text-foreground">
              {totales.toneladas.toLocaleString("es-AR")} tn
            </span>
          </span>
          <span className="text-muted-foreground">
            Flete:{" "}
            <span className="font-mono font-semibold text-[#10B981]">
              $ {totales.flete.toLocaleString("es-AR")}
            </span>
          </span>
        </div>
      )}

      {/* Cargar más / fin de resultados */}
      {!loading && (hasMore || allLoaded) && (
        <div className="flex justify-center px-5 py-4 border-t border-border">
          {hasMore ? (
            <Button
              variant="outline"
              size="sm"
              onClick={loadMore}
              disabled={isPending}
              aria-label="Cargar más viajes"
            >
              {isPending ? (
                <>
                  <Loader2 size={14} className="animate-spin mr-1" />
                  Cargando...
                </>
              ) : (
                "Cargar más"
              )}
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground/80">
              Todos los resultados cargados — {rows.length} viaje{rows.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      )}

      {/* Dialog cerrar viaje */}
      {cerrandoViaje && (
        <CerrarViajeDialog
          viaje={cerrandoViaje}
          open={!!cerrandoViaje}
          onOpenChange={(v) => { if (!v) setCerrandoViaje(null); }}
          onSuccess={(patch) => {
            setRows((prev) =>
              prev.map((item) =>
                item.id === cerrandoViaje.id ? { ...item, ...patch } : item
              )
            );
            setCerrandoViaje(null);
          }}
        />
      )}

      {/* Confirm edit facturado */}
      {confirmEditViaje && (
        <Dialog open={!!confirmEditViaje} onOpenChange={(v) => { if (!v) setConfirmEditViaje(null); }}>
          <DialogContent className="sm:max-w-[420px] p-6 gap-0">
            <DialogHeader className="border-b border-border pb-4 -mx-6 px-6 pt-1">
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center size-11 rounded-full bg-amber-100 text-amber-600 shrink-0">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <DialogTitle className="text-foreground text-base font-bold">
                    Viaje con remito
                  </DialogTitle>
                  <DialogDescription className="text-muted-foreground text-xs mt-0.5">
                    {confirmEditViaje.codigo} · {confirmEditViaje.cliente}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="py-4 space-y-2">
              <p className="text-sm text-foreground font-medium">
                Este viaje ya tiene el remito cargado (con remito y valor).
              </p>
              <p className="text-sm text-muted-foreground">
                Podés editar los datos igual: si cambiás el monto, el viaje se recalcula solo
                (con monto queda &quot;REMITO&quot;; sin monto vuelve a &quot;SIN REMITO&quot;).
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-border -mx-6 px-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmEditViaje(null)}
                className="h-9 px-5 text-sm"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                className="h-9 px-5 text-sm bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                onClick={() => {
                  setEditingViaje(confirmEditViaje);
                  setConfirmEditViaje(null);
                }}
              >
                Entendido, editar igual
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Viaje Dialog */}
      {editingViaje && (
        <EditViajeDialog
          viaje={editingViaje}
          open={!!editingViaje}
          onOpenChange={(v) => { if (!v) setEditingViaje(null); }}
          onSuccess={(patch) => {
            setRows((prev) =>
              prev.map((item) =>
                item.id === editingViaje.id ? { ...item, ...patch } : item
              )
            );
            setEditingViaje(null);
          }}
        />
      )}

      {/* Audit Trail Drawer */}
      {auditTrailViajeId && (
        <AuditTrailDrawer
          viajeId={auditTrailViajeId}
          open={auditTrailOpen}
          onOpenChange={setAuditTrailOpen}
        />
      )}

      {/* Facturación en bloque */}
      {facturarOpen && selectedFacturables.length > 0 && (
        <FacturarBloqueDialog
          viajes={selectedFacturables}
          open={facturarOpen}
          onOpenChange={setFacturarOpen}
          onSuccess={onFacturadoEnBloque}
        />
      )}

    </div>
  );
}
