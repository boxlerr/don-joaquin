"use client";

import { useState, useTransition, useCallback, useRef, useEffect } from "react";
import {
  X,
  Clock,
  User,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ShieldAlert,
  ListChecks,
  MapPin,
  Banknote,
  Users,
  IdCard,
  Truck,
  ShieldCheck,
  LogIn,
  Settings,
  Search,
} from "lucide-react";
import {
  getGlobalAuditLogsAction,
  type AuditLogEntry,
  type AuditLogsResult,
  type GetAuditLogsParams,
} from "../actions";
import { Combobox } from "@/components/ui/combobox";
import { accionLabel, accionClasses, entidadLabel, ACCION_LABELS, type RefsMap } from "@/lib/audit-catalog";

const PAGE_SIZE = 25;

type UsuarioOption = { id: string; nombre: string; apellido: string | null };

type Filters = {
  desde: string;
  hasta: string;
  usuario_id: string;
  entidad_tipos: string[];
  accion: string;
};

// Tabs por ÁREA (grupos del sidebar): cada uno junta los tipos de entidad que
// pertenecen a esa área, para filtrar la auditoría como se navega el sistema.
const ENTIDAD_TABS = [
  { key: "todas", label: "Todas", icon: ListChecks, tipos: [] as string[] },
  { key: "logistica", label: "Logística", icon: MapPin, tipos: ["viaje", "hoja_ruta", "ruta", "carga_combustible", "planilla_diaria"] },
  { key: "flota", label: "Flota", icon: Truck, tipos: ["camion", "mantenimiento", "rotura_goma", "insumo_catalogo"] },
  { key: "seguridad", label: "Seguridad", icon: ShieldAlert, tipos: ["siniestro", "extintor"] },
  { key: "rrhh", label: "RR.HH.", icon: IdCard, tipos: ["chofer", "entrevista", "rotacion_baja", "pesos_score_chofer"] },
  { key: "comercial", label: "Comercial", icon: Users, tipos: ["cliente", "tarifa"] },
  { key: "finanzas", label: "Finanzas", icon: Banknote, tipos: ["cheque", "caja", "gasto", "impuesto", "form931", "prestamo", "prestamo_cuota"] },
  { key: "compliance", label: "Compliance", icon: ShieldCheck, tipos: ["compliance_liq_loma", "compliance_dm_ypf", "compliance_documentos"] },
  { key: "sistema", label: "Sistema", icon: Settings, tipos: ["usuarios", "roles", "rol_areas", "rol_secciones", "usuario_areas", "usuario_secciones", "parametro_sistema", "configuracion_notificaciones"] },
  { key: "accesos", label: "Accesos", icon: LogIn, tipos: ["usuario"] },
] as const;

const ACCION_OPTIONS = Object.entries(ACCION_LABELS).map(([id, label]) => ({ id, label }));

// Etiquetas y colores de acciones/entidades: ver @/lib/audit-catalog.

/** Recurso legible desde metadata cuando la entidad no tiene id resuelto
 *  (ej. permisos de rol → rol; accesos → email). Evita filas con recurso "—". */
function recursoDesdeMetadata(entry: AuditLogEntry): string | null {
  const m = entry.metadata as Record<string, unknown> | null | undefined;
  if (!m) return null;
  if (typeof m.rol_nombre === "string" && m.rol_nombre) return m.rol_nombre;
  if (typeof m.rol_codigo === "string" && m.rol_codigo)
    return m.rol_codigo.charAt(0).toUpperCase() + m.rol_codigo.slice(1);
  if (typeof m.email === "string" && m.email) return m.email;
  return null;
}

export default function AuditoriaClient({
  initialData,
  usuarios,
}: {
  initialData: AuditLogsResult;
  usuarios: UsuarioOption[];
}) {
  const [entries, setEntries] = useState<AuditLogEntry[]>(initialData.data);
  const [refs, setRefs] = useState<RefsMap>(initialData.refs);
  const [total, setTotal] = useState(initialData.total);
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState<Filters>({
    desde: "",
    hasta: "",
    usuario_id: "",
    entidad_tipos: [],
    accion: "",
  });
  const [q, setQ] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null);
  const [isPending, startTransition] = useTransition();

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Cache de páginas ya traídas (por combinación de filtros): re-navegar es instantáneo.
  const cacheRef = useRef<Map<string, { data: AuditLogEntry[]; refs: RefsMap; total: number }>>(new Map());

  const paramsBase = (f: Filters): Omit<GetAuditLogsParams, "page" | "withCount"> => ({
    desde: f.desde || undefined,
    hasta: f.hasta || undefined,
    usuario_id: f.usuario_id || undefined,
    entidad_tipos: f.entidad_tipos.length > 0 ? f.entidad_tipos : undefined,
    accion: f.accion || undefined,
  });

  const claveFiltros = (f: Filters) =>
    JSON.stringify({ ...paramsBase(f), entidad_tipos: [...f.entidad_tipos].sort() });

  // Trae en silencio (sin spinner) la página siguiente, para que "Siguiente" sea instantáneo.
  const prefetch = useCallback((f: Filters, nextPage: number, fKey: string, tot: number) => {
    if (nextPage < 0) return;
    if (tot > 0 && nextPage >= Math.ceil(tot / PAGE_SIZE)) return;
    const key = `${fKey}#${nextPage}`;
    if (cacheRef.current.has(key)) return;
    void getGlobalAuditLogsAction({ ...paramsBase(f), page: nextPage, withCount: false }).then((r) => {
      if (!("error" in r)) cacheRef.current.set(key, { data: r.data, refs: r.refs, total: r.total });
    });
  }, []);

  const fetchData = useCallback(
    (newFilters: Filters, newPage: number, withCount: boolean) => {
      const fKey = claveFiltros(newFilters);
      const cacheKey = `${fKey}#${newPage}`;
      const cached = cacheRef.current.get(cacheKey);
      if (cached) {
        setEntries(cached.data);
        setRefs(cached.refs);
        prefetch(newFilters, newPage + 1, fKey, total);
        return;
      }
      startTransition(async () => {
        const result = await getGlobalAuditLogsAction({ ...paramsBase(newFilters), page: newPage, withCount });
        if ("error" in result) return;
        setEntries(result.data);
        setRefs(result.refs);
        const tot = result.total >= 0 ? result.total : total;
        if (result.total >= 0) setTotal(result.total);
        cacheRef.current.set(cacheKey, { data: result.data, refs: result.refs, total: tot });
        prefetch(newFilters, newPage + 1, fKey, tot);
      });
    },
    [prefetch, total],
  );

  // Al cambiar filtros: limpia la cache y recalcula el total (la parte cara).
  const aplicarFiltros = (newFilters: Filters) => {
    cacheRef.current.clear();
    setFilters(newFilters);
    setPage(0);
    fetchData(newFilters, 0, true);
  };

  const handleFilterChange = <K extends Exclude<keyof Filters, "entidad_tipos">>(
    key: K,
    value: string,
  ) => {
    aplicarFiltros({ ...filters, [key]: value });
  };

  const toggleEntidad = (tipos: readonly string[]) => {
    let next: string[];
    if (tipos.length === 0) {
      next = []; // "Todas"
    } else {
      const yaActivos = tipos.every((t) => filters.entidad_tipos.includes(t));
      next = yaActivos
        ? filters.entidad_tipos.filter((v) => !tipos.includes(v))
        : Array.from(new Set([...filters.entidad_tipos, ...tipos]));
    }
    aplicarFiltros({ ...filters, entidad_tipos: next });
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 0 || newPage >= totalPages || newPage === page) return;
    setPage(newPage);
    fetchData(filters, newPage, false); // paginar reusa el total: no recuenta
  };

  const clearFilters = () => {
    setQ("");
    aplicarFiltros({ desde: "", hasta: "", usuario_id: "", entidad_tipos: [], accion: "" });
  };

  // Salto directo a una página (input editable en el pie).
  const [jumpTo, setJumpTo] = useState("1");
  useEffect(() => {
    setJumpTo(String(page + 1));
  }, [page]);
  const commitJump = () => {
    const n = parseInt(jumpTo, 10);
    if (!Number.isFinite(n)) {
      setJumpTo(String(page + 1));
      return;
    }
    const destino = Math.min(Math.max(n, 1), totalPages);
    setJumpTo(String(destino));
    handlePageChange(destino - 1);
  };

  const hasFilters =
    !!filters.desde ||
    !!filters.hasta ||
    !!filters.usuario_id ||
    !!filters.accion ||
    !!q ||
    filters.entidad_tipos.length > 0;
  const rangeFrom = page * PAGE_SIZE + 1;
  const rangeTo = Math.min((page + 1) * PAGE_SIZE, total);

  // Búsqueda por texto: filtra lo cargado en la página actual (no toca el server).
  const filtroTexto = q.trim().toLowerCase();
  const entriesFiltradas = filtroTexto
    ? entries.filter((e) =>
        [
          e.entidad_label,
          e.entidad_detalle,
          accionLabel(e.accion),
          entidadLabel(e.entidad_tipo),
          e.usuario ? `${e.usuario.apellido} ${e.usuario.nombre}` : "",
          typeof e.metadata?.email === "string" ? e.metadata.email : "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(filtroTexto),
      )
    : entries;

  return (
    <>
      {/* Entity tabs (multi-select) */}
      <div className="bg-card rounded-lg border border-border px-2 py-1 mb-4 flex items-center gap-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {ENTIDAD_TABS.map((t) => {
          const Icon = t.icon;
          const isAll = t.tipos.length === 0;
          const active = isAll
            ? filters.entidad_tipos.length === 0
            : t.tipos.every((tipo) => filters.entidad_tipos.includes(tipo));
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => toggleEntidad(t.tipos)}
              className={
                "inline-flex items-center gap-1.5 px-3 h-9 text-xs font-semibold rounded-md transition-colors whitespace-nowrap " +
                (active
                  ? "bg-[#E1F5FE] text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted")
              }
              title={
                isAll
                  ? "Mostrar todas las entidades"
                  : active
                    ? `Quitar ${t.label}`
                    : `Agregar ${t.label}`
              }
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Filter bar */}
      <div className="bg-card rounded-lg border border-border px-5 py-4 mb-4 flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
            Desde
          </label>
          <input
            type="date"
            value={filters.desde}
            onChange={(e) => handleFilterChange("desde", e.target.value)}
            className="border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#0088D1]/30 focus:border-[#0088D1]"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
            Hasta
          </label>
          <input
            type="date"
            value={filters.hasta}
            onChange={(e) => handleFilterChange("hasta", e.target.value)}
            className="border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#0088D1]/30 focus:border-[#0088D1]"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
            Usuario
          </label>
          <Combobox
            value={filters.usuario_id}
            onValueChange={(v) => handleFilterChange("usuario_id", v)}
            options={[
              { id: "", label: "Todos los usuarios" },
              ...usuarios.map((u) => ({
                id: u.id,
                label: u.apellido ? `${u.apellido}, ${u.nombre}` : u.nombre,
              })),
            ]}
            searchPlaceholder="Buscar usuario..."
            triggerClassName="h-9 min-w-[180px]"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
            Acción
          </label>
          <Combobox
            value={filters.accion}
            onValueChange={(v) => handleFilterChange("accion", v)}
            options={[{ id: "", label: "Todas las acciones" }, ...ACCION_OPTIONS]}
            searchPlaceholder="Buscar acción..."
            triggerClassName="h-9 min-w-[180px]"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
            Buscar recurso
          </label>
          <div className="relative">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60"
            />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filtrar en esta página..."
              className="border border-border rounded-lg pl-8 pr-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#0088D1]/30 focus:border-[#0088D1] min-w-[200px]"
            />
          </div>
        </div>

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:bg-muted border border-border transition-colors"
          >
            <X size={13} />
            Limpiar
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <p className="text-sm text-muted-foreground">
            {filtroTexto
              ? `${entriesFiltradas.length} resultado(s) en esta página`
              : total === 0
                ? "Sin registros"
                : `Mostrando ${rangeFrom}–${rangeTo} de ${total} registros`}
          </p>
          {isPending && (
            <span className="text-xs text-muted-foreground/70">Actualizando...</span>
          )}
        </div>

        {entriesFiltradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/70">
            <ShieldAlert size={32} className="mb-3 opacity-40" />
            <p className="text-sm">Sin registros de auditoría</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Fecha
                </th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Usuario
                </th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Acción
                </th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Entidad
                </th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Recurso afectado
                </th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entriesFiltradas.map((entry) => (
                <tr key={entry.id} className="hover:bg-muted/40 transition-colors">
                  <td className="px-5 py-3 text-muted-foreground whitespace-nowrap">
                    {new Date(entry.created_at).toLocaleString("es-AR", { hour12: false })}
                  </td>
                  <td className="px-5 py-3 text-foreground">
                    {entry.usuario ? (
                      `${entry.usuario.apellido}, ${entry.usuario.nombre}`
                    ) : (
                      <span className="text-muted-foreground/70">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                        accionClasses(entry.accion)
                      }`}
                    >
                      {accionLabel(entry.accion)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {entidadLabel(entry.entidad_tipo)}
                  </td>
                  <td className="px-5 py-3">
                    {entry.entidad_label ? (
                      <div className="leading-tight">
                        <div className="text-foreground text-sm">{entry.entidad_label}</div>
                        {entry.entidad_detalle && (
                          <div className="text-[10px] font-mono text-muted-foreground">
                            {entry.entidad_detalle}
                          </div>
                        )}
                      </div>
                    ) : recursoDesdeMetadata(entry) ? (
                      <div className="text-foreground text-sm">{recursoDesdeMetadata(entry)}</div>
                    ) : (
                      <span className="text-muted-foreground/60 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {(entry.valores_anteriores || entry.valores_nuevos) && (
                      <button
                        onClick={() => setSelectedEntry(entry)}
                        className="text-primary hover:text-[#0277BD] text-xs font-semibold hover:underline transition-colors"
                      >
                        Ver detalles
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-border">
            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePageChange(0)}
                disabled={page === 0}
                title="Primera página"
                className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronsLeft size={15} />
              </button>
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 0}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={14} />
                Anterior
              </button>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Página</span>
              <input
                type="number"
                min={1}
                max={totalPages}
                value={jumpTo}
                onChange={(e) => setJumpTo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
                onBlur={commitJump}
                aria-label="Ir a la página"
                className="w-14 text-center rounded-md border border-border bg-card px-1 py-1 text-sm text-foreground tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0088D1]/30 focus:border-[#0088D1] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span>de {totalPages}</span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages - 1}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Siguiente
                <ChevronRight size={14} />
              </button>
              <button
                onClick={() => handlePageChange(totalPages - 1)}
                disabled={page >= totalPages - 1}
                title="Última página"
                className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronsRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail drawer */}
      {selectedEntry && (
        <AuditDetailDrawer
          entry={selectedEntry}
          onClose={() => setSelectedEntry(null)}
          refs={refs}
        />
      )}
    </>
  );
}

function AuditDetailDrawer({
  entry,
  onClose,
  refs,
}: {
  entry: AuditLogEntry;
  onClose: () => void;
  refs: RefsMap;
}) {
  return (
    <div
      className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="fixed right-0 top-0 h-full w-[min(500px,calc(100vw-2rem))] bg-card shadow-2xl border-l border-border flex flex-col animate-in slide-in-from-right"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-full bg-[#E1F5FE] text-primary inline-flex items-center justify-center">
              <Clock size={18} />
            </div>
            <div>
              <h2 className="text-foreground font-semibold">Detalle del registro</h2>
              <p className="text-muted-foreground text-xs">
                {new Date(entry.created_at).toLocaleString("es-AR", { hour12: false })}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-8 rounded-full text-muted-foreground hover:bg-muted inline-flex items-center justify-center"
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </div>

        {/* Meta */}
        <div className="px-5 py-4 border-b border-border space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-semibold ${accionClasses(
                entry.accion,
              )}`}
            >
              {accionLabel(entry.accion)}
            </span>
            <span className="text-muted-foreground/70 text-xs">·</span>
            <span className="text-[12px] text-muted-foreground">
              {entidadLabel(entry.entidad_tipo)}
            </span>
          </div>

          {/* Recurso afectado — chofer, camión, cliente, viaje, etc. */}
          {entry.entidad_label && (
            <div className="bg-muted/40 border border-border rounded-md px-3 py-2 space-y-0.5">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                {entidadLabel(entry.entidad_tipo)} afectado
              </p>
              <p className="text-sm font-semibold text-foreground">{entry.entidad_label}</p>
              {entry.entidad_detalle && (
                <p className="text-[11px] font-mono text-muted-foreground">{entry.entidad_detalle}</p>
              )}
            </div>
          )}

          {entry.usuario && (
            <p className="text-[12px] text-muted-foreground flex items-center gap-1">
              <User size={11} className="text-primary" />
              <span className="text-muted-foreground/80">Modificado por:</span>{" "}
              {entry.usuario.apellido}, {entry.usuario.nombre}
            </p>
          )}
        </div>

        {/* Diff */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <FriendlyDiff entry={entry} refs={refs} />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Render legible del cambio (sin JSON crudo)
// ============================================================================

const FIELD_LABELS: Record<string, Record<string, string>> = {
  camion: {
    patente: "Patente",
    marca: "Marca",
    modelo: "Modelo",
    ano: "Año",
    capacidad_tn: "Capacidad (TN)",
    tipo_camion: "Tipo",
    estado: "Estado",
    observaciones: "Observaciones",
    archivo: "Archivo",
    nota: "Nota",
    es_principal: "Es principal",
    era_principal: "Era la foto principal",
  },
  chofer: {
    nombre: "Nombre",
    apellido: "Apellido",
    dni: "DNI",
    telefono: "Teléfono",
    email: "Email",
    localidad: "Localidad",
    direccion: "Dirección",
    domicilio: "Domicilio",
    provincia: "Provincia",
    fecha_ingreso: "Fecha de ingreso",
    fecha_egreso: "Fecha de egreso",
    fecha_nacimiento: "Fecha de nacimiento",
    cbu: "CBU",
    alias_cbu: "Alias CBU",
    banco: "Banco",
    telefono_emergencia: "Teléfono de emergencia",
    estado: "Estado",
    observaciones: "Observaciones",
    // Documentos
    tipo_documento: "Tipo de documento",
    archivo: "Archivo",
    numero: "Número",
    fecha_emision: "Fecha de emisión",
    fecha_vencimiento: "Fecha de vencimiento",
  },
  viaje: {
    numero: "Número",
    estado: "Estado",
    fecha_salida: "Fecha de salida",
    fecha_llegada: "Fecha de llegada",
    origen: "Origen",
    destino: "Destino",
    km_oficial: "KM oficial",
    km_calculado: "KM calculado",
    tarifa: "Tarifa",
    chofer_id: "Chofer",
    camion_id: "Camión",
    cliente_id: "Cliente",
    observaciones: "Observaciones",
  },
  cheque: {
    numero: "Número",
    importe: "Importe",
    monto: "Monto",
    moneda: "Moneda",
    tipo: "Tipo",
    estado: "Estado",
    fecha_emision: "Fecha de emisión",
    fecha_vencimiento: "Fecha de vencimiento",
    fecha_recepcion: "Fecha de recepción",
    fecha_entrega: "Fecha de entrega",
    fecha_deposito: "Fecha de depósito",
    fecha_rechazo: "Fecha de rechazo",
    fecha_estado_actual: "Fecha del estado",
    librador_nombre: "Librador",
    librador_cuit: "CUIT del librador",
    sucursal_banco: "Sucursal del banco",
    cuenta_corriente: "Cuenta corriente",
    recibido_de: "Recibido de",
    entregado_a: "Entregado a",
    banco_deposito: "Banco de depósito",
    motivo: "Motivo",
    motivo_rechazo: "Motivo del rechazo",
    motivo_rechazo_detalle: "Detalle del rechazo",
    concepto: "Concepto",
    observaciones: "Observaciones",
  },
  caja: {
    tipo: "Tipo",
    concepto: "Concepto",
    descripcion: "Descripción",
    monto: "Monto",
    medio: "Medio de pago",
    categoria: "Categoría",
    fecha: "Fecha",
    moneda: "Moneda",
    observaciones: "Observaciones",
  },
  cliente: {
    razon_social: "Razón social",
    nombre_comercial: "Nombre comercial",
    cuit: "CUIT",
    condicion_iva: "Condición IVA",
    domicilio_fiscal: "Domicilio fiscal",
    localidad: "Localidad",
    provincia: "Provincia",
    pais: "País",
    email: "Email",
    telefono: "Teléfono",
    es_multinacional: "Es multinacional",
    estado: "Estado",
    observaciones: "Observaciones",
    // Contactos / sucursales / requisitos
    nombre: "Nombre",
    cargo: "Cargo",
    es_principal: "Es principal",
    domicilio: "Domicilio",
    tipo: "Tipo",
    descripcion: "Descripción",
    frecuencia: "Frecuencia",
    proxima_fecha: "Próxima fecha",
    formato_requerido: "Formato requerido",
    responsable_interno: "Responsable interno",
  },
  usuario_secciones: {
    seccion_codigo: "Sección",
    area_codigo: "Área",
    nivel: "Nivel",
    vence_en: "Vence",
    motivo: "Motivo",
  },
  usuario_areas: {
    area_codigo: "Área",
    nivel: "Nivel",
    vence_en: "Vence",
    motivo: "Motivo",
  },
  rol_areas: { rol_id: "Rol", area_codigo: "Área", nivel: "Nivel" },
  rol_secciones: { rol_id: "Rol", seccion_codigo: "Sección", nivel: "Nivel" },
  prestamo: {
    banco: "Banco",
    detalle: "Detalle",
    tasa: "Tasa (%)",
    importe_cuota: "Importe de cuota",
    cuotas_total: "Cantidad de cuotas",
    primer_vencimiento: "Primer vencimiento",
    estado: "Estado",
    observaciones: "Observaciones",
  },
  prestamo_cuota: {
    nro: "Cuota N°",
    fecha_vencimiento: "Vencimiento",
    importe: "Importe",
    pagada: "Pagada",
    pagada_en: "Pagada el",
  },
  impuesto: {
    nombre: "Nombre",
    organismo: "Organismo",
    periodo: "Período",
    fecha_vencimiento: "Vencimiento",
    presentado: "Presentado",
    observaciones: "Observaciones",
  },
  insumo_catalogo: {
    nombre: "Nombre",
    tipo: "Tipo",
    marca: "Marca",
    precio: "Precio",
    moneda: "Moneda",
    estado: "Estado",
  },
  siniestro: {
    camion_id: "Camión",
    chofer_id: "Chofer",
    fecha: "Fecha",
    tipo_siniestro: "Tipo",
    tipo_siniestro_detalle: "Detalle del tipo",
    estado: "Estado",
    descripcion: "Descripción",
    monto_danos: "Monto de daños",
    compania_seguro: "Compañía de seguro",
    numero_siniestro_seguro: "N° de siniestro",
    terceros_involucrados: "Terceros involucrados",
  },
  gasto: {
    tipo_gasto_id: "Tipo de gasto",
    fecha: "Fecha",
    monto: "Monto",
    medio_pago: "Medio de pago",
    descripcion: "Descripción",
    proveedor: "Proveedor",
    numero_comprobante: "N° de comprobante",
    viaje_id: "Viaje",
    camion_id: "Camión",
    chofer_id: "Chofer",
  },
  rotacion_baja: {
    nombre: "Nombre",
    chofer_id: "Chofer",
    fecha_ingreso: "Fecha de ingreso",
    fecha_egreso: "Fecha de egreso",
    anio: "Año",
    antiguedad_meses: "Antigüedad (meses)",
    tipo_baja: "Tipo de baja",
    motivo: "Motivo",
    base_zona: "Base / zona",
    observaciones: "Observaciones",
  },
};

const VALUE_TRANSLATIONS: Record<string, string> = {
  // Estado camión
  activo: "Activo",
  inactivo: "Inactivo",
  baja: "Baja",
  en_mantenimiento: "En mantenimiento",
  // Tipo camión
  tractor: "Tractor",
  chasis_rigido: "Chasis rígido",
  batea: "Batea",
  otro: "Otro",
  // Condición IVA
  responsable_inscripto: "Responsable inscripto",
  monotributo: "Monotributo",
  exento: "Exento",
  consumidor_final: "Consumidor final",
  no_categorizado: "No categorizado",
  // Caja - tipo movimiento
  ingreso: "Ingreso",
  egreso: "Egreso",
  // Caja - medio de pago
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  cheque: "Cheque",
  // Caja - categoría
  cobro_cliente: "Cobro a cliente",
  pago_proveedor: "Pago a proveedor",
  entrega_viatico: "Entrega de viático",
  rendicion_vuelto: "Rendición / vuelto",
  gasto_operativo: "Gasto operativo",
  pago_chofer: "Pago a chofer",
  transferencia_interna: "Transferencia interna",
  ajuste: "Ajuste",
  // Cheques - estado
  cartera: "En cartera",
  entregado: "Entregado",
  depositado: "Depositado",
  acreditado: "Acreditado",
  rechazado: "Rechazado",
  anulado: "Anulado",
  // Cheques - tipo
  comun: "Común",
  diferido: "Diferido",
  electronico: "Electrónico",
  // Cheques - motivo rechazo
  sin_fondos: "Sin fondos",
  firma_no_corresponde: "Firma no corresponde",
  cuenta_cerrada: "Cuenta cerrada",
  formal: "Defecto formal",
  // Cliente - estado
  suspendido: "Suspendido",
  // Contactos - cargo
  comercial: "Comercial",
  administrativo: "Administrativo",
  logistica: "Logística",
  // Requisitos - tipo
  habilitacion_proveedor: "Habilitación de proveedor",
  documentacion_chofer: "Documentación de chofer",
  documentacion_camion: "Documentación de camión",
  reporte_periodico: "Reporte periódico",
  auditoria: "Auditoría",
  // Requisitos - frecuencia
  unica: "Única",
  mensual: "Mensual",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
  // Requisitos - estado
  pendiente: "Pendiente",
  cumplido: "Cumplido",
  vencido: "Vencido",
  // Niveles de permiso (permisos de usuario/rol)
  read: "Lectura",
  write: "Edición",
  admin: "Admin",
  none: "Sin acceso",
  // Rotación — tipo de baja
  renuncia_voluntaria: "Renuncia voluntaria",
  despido: "Despido",
  jubilacion: "Jubilación",
  abandono: "Abandono",
  // Gastos — medio de pago
  efectivo_caja: "Efectivo (caja)",
  tarjeta_empresa: "Tarjeta empresa",
  cuenta_corriente: "Cuenta corriente",
};

function humanizeKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\bid\b/gi, "")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value === "number") return value.toLocaleString("es-AR");
  if (typeof value === "object") return Array.isArray(value) ? `${value.length} elemento(s)` : "—";
  const s = String(value);
  // Fecha ISO sólo día: parsear como local para no correrse por timezone
  const dateOnly = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const [, y, m, d] = dateOnly;
    return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString("es-AR");
  }
  // Fecha con hora
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toLocaleDateString("es-AR");
  }
  // Traducción de enum común
  if (VALUE_TRANSLATIONS[s]) return VALUE_TRANSLATIONS[s];
  return s;
}

/** Igual que formatValue, pero si el campo es un *_id conocido lo muestra resuelto a nombre. */
function displayValue(key: string, value: unknown, refs: RefsMap): string {
  if (typeof value === "string" && refs[key]?.[value]) return refs[key][value];
  return formatValue(value);
}

function fieldLabel(entidad: string, key: string): string {
  return FIELD_LABELS[entidad]?.[key] ?? humanizeKey(key);
}

type DiffRow = { key: string; antes: unknown; despues: unknown };

const HIDDEN_KEYS = new Set([
  "foto_url",
  // FKs que el panel todavía no resuelve a un nombre legible: se ocultan.
  // (Los *_id que sí se resuelven —chofer, camión, cliente, etc.— se muestran.)
  "gasto_id",
  "viatico_id",
  "factura_id",
  "pago_cliente_id",
  "archivos",
]);

function computeDiff(
  antes: Record<string, unknown> | null,
  despues: Record<string, unknown> | null,
): DiffRow[] {
  const keys = new Set<string>([
    ...Object.keys(antes ?? {}),
    ...Object.keys(despues ?? {}),
  ]);
  const rows: DiffRow[] = [];
  for (const key of keys) {
    if (key.endsWith("_at") || key.endsWith("_by") || key === "id") continue;
    if (HIDDEN_KEYS.has(key)) continue;
    const a = antes?.[key];
    const d = despues?.[key];
    if (antes && despues) {
      if (JSON.stringify(a) !== JSON.stringify(d)) {
        rows.push({ key, antes: a, despues: d });
      }
    } else {
      rows.push({ key, antes: a, despues: d });
    }
  }
  return rows;
}

function FotoPreview({ url, deleted }: { url: string; deleted?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 overflow-hidden">
      <div className="relative aspect-[4/3] bg-black/5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt="Foto del registro"
          className={`w-full h-full object-contain ${deleted ? "opacity-60" : ""}`}
          loading="lazy"
        />
        {deleted && (
          <span className="absolute top-2 left-2 px-2 py-0.5 text-[10px] font-semibold bg-red-50 text-[#7F1D1D] border border-[#FECACA] rounded">
            Foto eliminada
          </span>
        )}
      </div>
    </div>
  );
}

function FriendlyDiff({ entry, refs }: { entry: AuditLogEntry; refs: RefsMap }) {
  const antes = entry.valores_anteriores;
  const despues = entry.valores_nuevos;
  const entidad = entry.entidad_tipo;
  const esFotoEntry = entry.accion.startsWith("foto_") || entry.accion === "nota_foto";
  const fotoUrl =
    (despues?.foto_url as string | undefined) ?? (antes?.foto_url as string | undefined) ?? null;

  const diff = computeDiff(antes, despues);

  if (diff.length === 0 && !fotoUrl) {
    return (
      <p className="text-sm text-muted-foreground/70 text-center py-8">
        Sin cambios para mostrar.
      </p>
    );
  }

  // Sólo "después" → creación / foto_agregada / foto_principal
  if (!antes && despues) {
    return (
      <div className="space-y-3">
        {esFotoEntry && fotoUrl && <FotoPreview url={fotoUrl} />}
        <p className="text-[12px] text-muted-foreground">
          {esFotoEntry ? "Datos de la foto:" : "Se registraron estos datos:"}
        </p>
        <div className="rounded-lg border border-[#A7F3D0] bg-[#ECFDF5] divide-y divide-[#A7F3D0]/60">
          {diff.map((row) => (
            <div key={row.key} className="px-3 py-2 flex items-start justify-between gap-3">
              <span className="text-[12px] font-semibold text-[#065F46]">
                {fieldLabel(entidad, row.key)}
              </span>
              <span className="text-[12px] text-[#065F46] text-right break-words">
                {displayValue(row.key, row.despues, refs)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Sólo "antes" → eliminación / foto_eliminada
  if (antes && !despues) {
    return (
      <div className="space-y-3">
        {esFotoEntry && fotoUrl && <FotoPreview url={fotoUrl} deleted />}
        <p className="text-[12px] text-muted-foreground">
          {esFotoEntry ? "Datos de la foto eliminada:" : "Se eliminó un registro con estos datos:"}
        </p>
        <div className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] divide-y divide-[#FECACA]/60">
          {diff.map((row) => (
            <div key={row.key} className="px-3 py-2 flex items-start justify-between gap-3">
              <span className="text-[12px] font-semibold text-[#7F1D1D]">
                {fieldLabel(entidad, row.key)}
              </span>
              <span className="text-[12px] text-[#7F1D1D] text-right break-words line-through">
                {displayValue(row.key, row.antes, refs)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Actualización → diff antes→después por campo (incluye nota_foto)
  return (
    <div className="space-y-3">
      {esFotoEntry && fotoUrl && <FotoPreview url={fotoUrl} />}
      <p className="text-[12px] text-muted-foreground">
        {diff.length === 1
          ? "Se modificó 1 campo:"
          : `Se modificaron ${diff.length} campos:`}
      </p>
      <div className="space-y-2">
        {diff.map((row) => (
          <div
            key={row.key}
            className="rounded-lg border border-border bg-card px-3 py-2"
          >
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              {fieldLabel(entidad, row.key)}
            </p>
            <div className="flex items-center gap-2 text-[13px] flex-wrap">
              <span className="px-2 py-0.5 rounded bg-[#FEE2E2] text-[#7F1D1D] line-through break-words">
                {displayValue(row.key, row.antes, refs)}
              </span>
              <span className="text-muted-foreground/70 text-xs">→</span>
              <span className="px-2 py-0.5 rounded bg-[#DCFCE7] text-[#14532D] font-semibold break-words">
                {displayValue(row.key, row.despues, refs)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
