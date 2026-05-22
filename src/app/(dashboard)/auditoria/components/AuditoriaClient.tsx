"use client";

import { useState, useTransition, useCallback } from "react";
import {
  X,
  Clock,
  User,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  ListChecks,
  MapPin,
  Banknote,
  Wallet,
  Users,
  IdCard,
  Truck,
} from "lucide-react";
import {
  getGlobalAuditLogsAction,
  type AuditLogEntry,
  type AuditLogsResult,
  type GetAuditLogsParams,
} from "../actions";

const PAGE_SIZE = 25;

type UsuarioOption = { id: string; nombre: string; apellido: string | null };

type Filters = {
  desde: string;
  hasta: string;
  usuario_id: string;
  entidad_tipos: string[];
};

const ENTIDAD_TABS = [
  { value: "", label: "Todas", icon: ListChecks },
  { value: "viaje", label: "Viajes", icon: MapPin },
  { value: "cheque", label: "Cheques", icon: Banknote },
  { value: "caja", label: "Caja", icon: Wallet },
  { value: "cliente", label: "Clientes", icon: Users },
  { value: "chofer", label: "Choferes", icon: IdCard },
  { value: "camion", label: "Camiones", icon: Truck },
] as const;

const ACCIONES_LABELS: Record<string, string> = {
  crear: "Creación",
  cambio_estado: "Cambio de estado",
  actualizar: "Actualización",
  eliminar: "Eliminación",
  foto_agregada: "Foto agregada",
  foto_eliminada: "Foto eliminada",
  foto_principal: "Foto marcada como principal",
  nota_foto: "Nota de foto actualizada",
  contacto_agregado: "Contacto agregado",
  contacto_eliminado: "Contacto eliminado",
  sucursal_agregada: "Sucursal agregada",
  sucursal_eliminada: "Sucursal eliminada",
  requisito_agregado: "Requisito agregado",
  requisito_eliminado: "Requisito eliminado",
  requisito_estado: "Estado de requisito",
  documento_agregado: "Documento agregado",
  documento_eliminado: "Documento eliminado",
};

const ACCIONES_COLORS: Record<string, string> = {
  crear: "bg-[#ECFDF5] text-[#065F46]",
  cambio_estado: "bg-[#E0E7FF] text-[#3730A3]",
  actualizar: "bg-[#FEF3C7] text-[#92400E]",
  eliminar: "bg-[#FEE2E2] text-[#7F1D1D]",
  foto_agregada: "bg-[#E0F2FE] text-[#075985]",
  foto_eliminada: "bg-[#FEE2E2] text-[#7F1D1D]",
  foto_principal: "bg-[#FEF3C7] text-[#92400E]",
  nota_foto: "bg-[#F3E8FF] text-[#6B21A8]",
  contacto_agregado: "bg-[#ECFDF5] text-[#065F46]",
  contacto_eliminado: "bg-[#FEE2E2] text-[#7F1D1D]",
  sucursal_agregada: "bg-[#ECFDF5] text-[#065F46]",
  sucursal_eliminada: "bg-[#FEE2E2] text-[#7F1D1D]",
  requisito_agregado: "bg-[#ECFDF5] text-[#065F46]",
  requisito_eliminado: "bg-[#FEE2E2] text-[#7F1D1D]",
  requisito_estado: "bg-[#E0E7FF] text-[#3730A3]",
  documento_agregado: "bg-[#E0F2FE] text-[#075985]",
  documento_eliminado: "bg-[#FEE2E2] text-[#7F1D1D]",
};

const ENTIDADES_LABELS: Record<string, string> = {
  viaje: "Viaje",
  cheque: "Cheque",
  caja: "Caja",
  cliente: "Cliente",
  chofer: "Chofer",
  camion: "Camión",
};

export default function AuditoriaClient({
  initialData,
  usuarios,
}: {
  initialData: AuditLogsResult;
  usuarios: UsuarioOption[];
}) {
  const [entries, setEntries] = useState<AuditLogEntry[]>(initialData.data);
  const [total, setTotal] = useState(initialData.total);
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState<Filters>({
    desde: "",
    hasta: "",
    usuario_id: "",
    entidad_tipos: [],
  });
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null);
  const [isPending, startTransition] = useTransition();

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const fetchData = useCallback(
    (newFilters: Filters, newPage: number) => {
      const params: GetAuditLogsParams = {
        desde: newFilters.desde || undefined,
        hasta: newFilters.hasta || undefined,
        usuario_id: newFilters.usuario_id || undefined,
        entidad_tipos: newFilters.entidad_tipos.length > 0 ? newFilters.entidad_tipos : undefined,
        page: newPage,
      };
      startTransition(async () => {
        const result = await getGlobalAuditLogsAction(params);
        if (!("error" in result)) {
          setEntries(result.data);
          setTotal(result.total);
        }
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const handleFilterChange = <K extends Exclude<keyof Filters, "entidad_tipos">>(
    key: K,
    value: string,
  ) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    setPage(0);
    fetchData(newFilters, 0);
  };

  const toggleEntidad = (value: string) => {
    let next: string[];
    if (value === "") {
      next = [];
    } else if (filters.entidad_tipos.includes(value)) {
      next = filters.entidad_tipos.filter((v) => v !== value);
    } else {
      next = [...filters.entidad_tipos, value];
    }
    const newFilters = { ...filters, entidad_tipos: next };
    setFilters(newFilters);
    setPage(0);
    fetchData(newFilters, 0);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchData(filters, newPage);
  };

  const clearFilters = () => {
    const empty: Filters = { desde: "", hasta: "", usuario_id: "", entidad_tipos: [] };
    setFilters(empty);
    setPage(0);
    fetchData(empty, 0);
  };

  const hasFilters =
    !!filters.desde ||
    !!filters.hasta ||
    !!filters.usuario_id ||
    filters.entidad_tipos.length > 0;
  const rangeFrom = page * PAGE_SIZE + 1;
  const rangeTo = Math.min((page + 1) * PAGE_SIZE, total);

  return (
    <>
      {/* Entity tabs (multi-select) */}
      <div className="bg-card rounded-lg border border-border px-2 py-1 mb-4 flex items-center gap-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {ENTIDAD_TABS.map((t) => {
          const Icon = t.icon;
          const isAll = t.value === "";
          const active = isAll
            ? filters.entidad_tipos.length === 0
            : filters.entidad_tipos.includes(t.value);
          return (
            <button
              key={t.value || "all"}
              type="button"
              onClick={() => toggleEntidad(t.value)}
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
          <select
            value={filters.usuario_id}
            onChange={(e) => handleFilterChange("usuario_id", e.target.value)}
            className="border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#0088D1]/30 focus:border-[#0088D1] min-w-[180px]"
          >
            <option value="">Todos los usuarios</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.apellido ? `${u.apellido}, ${u.nombre}` : u.nombre}
              </option>
            ))}
          </select>
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
            {total === 0
              ? "Sin registros"
              : `Mostrando ${rangeFrom}–${rangeTo} de ${total} registros`}
          </p>
          {isPending && (
            <span className="text-xs text-muted-foreground/70">Actualizando...</span>
          )}
        </div>

        {entries.length === 0 ? (
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
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entries.map((entry) => (
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
                        ACCIONES_COLORS[entry.accion] ?? "bg-muted text-muted-foreground"
                      }`}
                    >
                      {ACCIONES_LABELS[entry.accion] ?? entry.accion}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {ENTIDADES_LABELS[entry.entidad_tipo] ?? entry.entidad_tipo}
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
          <div className="flex items-center justify-between px-5 py-3 border-t border-border">
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={14} />
              Anterior
            </button>
            <span className="text-xs text-muted-foreground/70">
              Página {page + 1} de {totalPages}
            </span>
            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages - 1}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Siguiente
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Detail drawer */}
      {selectedEntry && (
        <AuditDetailDrawer
          entry={selectedEntry}
          onClose={() => setSelectedEntry(null)}
        />
      )}
    </>
  );
}

function AuditDetailDrawer({
  entry,
  onClose,
}: {
  entry: AuditLogEntry;
  onClose: () => void;
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
              className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                ACCIONES_COLORS[entry.accion] ?? "bg-muted text-muted-foreground"
              }`}
            >
              {ACCIONES_LABELS[entry.accion] ?? entry.accion}
            </span>
            <span className="text-muted-foreground/70 text-xs">·</span>
            <span className="text-[12px] text-muted-foreground">
              {ENTIDADES_LABELS[entry.entidad_tipo] ?? entry.entidad_tipo}
            </span>
          </div>
          {entry.usuario && (
            <p className="text-[12px] text-muted-foreground flex items-center gap-1">
              <User size={11} className="text-primary" />
              {entry.usuario.apellido}, {entry.usuario.nombre}
            </p>
          )}
        </div>

        {/* Diff */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <FriendlyDiff entry={entry} />
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

function fieldLabel(entidad: string, key: string): string {
  return FIELD_LABELS[entidad]?.[key] ?? humanizeKey(key);
}

type DiffRow = { key: string; antes: unknown; despues: unknown };

const HIDDEN_KEYS = new Set([
  "foto_url",
  // FKs internos: se guardan como UUIDs sin valor en el panel
  "gasto_id",
  "chofer_id",
  "cliente_id",
  "viaje_id",
  "viatico_id",
  "cheque_id",
  "camion_id",
  "factura_id",
  "pago_cliente_id",
  "banco_id",
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

function FriendlyDiff({ entry }: { entry: AuditLogEntry }) {
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
                {formatValue(row.despues)}
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
                {formatValue(row.antes)}
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
                {formatValue(row.antes)}
              </span>
              <span className="text-muted-foreground/70 text-xs">→</span>
              <span className="px-2 py-0.5 rounded bg-[#DCFCE7] text-[#14532D] font-semibold break-words">
                {formatValue(row.despues)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
