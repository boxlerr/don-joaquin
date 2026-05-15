"use client";

import { useState, useTransition, useCallback } from "react";
import { X, Clock, User, ChevronLeft, ChevronRight, ShieldAlert } from "lucide-react";
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
  entidad_tipo: string;
};

const ENTIDADES = [
  { value: "", label: "Todas las entidades" },
  { value: "viaje", label: "Viajes" },
  { value: "cheque", label: "Cheques" },
  { value: "caja", label: "Caja" },
  { value: "cliente", label: "Clientes" },
];

const ACCIONES_LABELS: Record<string, string> = {
  crear: "Creación",
  cambio_estado: "Cambio de estado",
  actualizar: "Actualización",
  eliminar: "Eliminación",
};

const ACCIONES_COLORS: Record<string, string> = {
  crear: "bg-[#ECFDF5] text-[#065F46]",
  cambio_estado: "bg-[#E0E7FF] text-[#3730A3]",
  actualizar: "bg-[#FEF3C7] text-[#92400E]",
  eliminar: "bg-[#FEE2E2] text-[#7F1D1D]",
};

const ENTIDADES_LABELS: Record<string, string> = {
  viaje: "Viaje",
  cheque: "Cheque",
  caja: "Caja",
  cliente: "Cliente",
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
    entidad_tipo: "",
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
        entidad_tipo: newFilters.entidad_tipo || undefined,
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

  const handleFilterChange = (key: keyof Filters, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    setPage(0);
    fetchData(newFilters, 0);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchData(filters, newPage);
  };

  const clearFilters = () => {
    const empty: Filters = { desde: "", hasta: "", usuario_id: "", entidad_tipo: "" };
    setFilters(empty);
    setPage(0);
    fetchData(empty, 0);
  };

  const hasFilters = Object.values(filters).some(Boolean);
  const rangeFrom = page * PAGE_SIZE + 1;
  const rangeTo = Math.min((page + 1) * PAGE_SIZE, total);

  return (
    <>
      {/* Filter bar */}
      <div className="bg-white rounded-lg border border-[#E2E8F0] px-5 py-4 mb-4 flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-[#475569] uppercase tracking-wide">
            Desde
          </label>
          <input
            type="date"
            value={filters.desde}
            onChange={(e) => handleFilterChange("desde", e.target.value)}
            className="border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-sm text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#0088D1]/30 focus:border-[#0088D1]"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-[#475569] uppercase tracking-wide">
            Hasta
          </label>
          <input
            type="date"
            value={filters.hasta}
            onChange={(e) => handleFilterChange("hasta", e.target.value)}
            className="border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-sm text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#0088D1]/30 focus:border-[#0088D1]"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-[#475569] uppercase tracking-wide">
            Usuario
          </label>
          <select
            value={filters.usuario_id}
            onChange={(e) => handleFilterChange("usuario_id", e.target.value)}
            className="border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-sm text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#0088D1]/30 focus:border-[#0088D1] min-w-[180px]"
          >
            <option value="">Todos los usuarios</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.apellido ? `${u.apellido}, ${u.nombre}` : u.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-[#475569] uppercase tracking-wide">
            Entidad
          </label>
          <select
            value={filters.entidad_tipo}
            onChange={(e) => handleFilterChange("entidad_tipo", e.target.value)}
            className="border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-sm text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#0088D1]/30 focus:border-[#0088D1] min-w-[180px]"
          >
            {ENTIDADES.map((e) => (
              <option key={e.value} value={e.value}>
                {e.label}
              </option>
            ))}
          </select>
        </div>

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-[#475569] hover:bg-[#F1F5F9] border border-[#E2E8F0] transition-colors"
          >
            <X size={13} />
            Limpiar
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-[#E2E8F0] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#E2E8F0]">
          <p className="text-sm text-[#475569]">
            {total === 0
              ? "Sin registros"
              : `Mostrando ${rangeFrom}–${rangeTo} de ${total} registros`}
          </p>
          {isPending && (
            <span className="text-xs text-[#94A3B8]">Actualizando...</span>
          )}
        </div>

        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[#94A3B8]">
            <ShieldAlert size={32} className="mb-3 opacity-40" />
            <p className="text-sm">Sin registros de auditoría</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-[#475569] uppercase tracking-wide">
                  Fecha
                </th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-[#475569] uppercase tracking-wide">
                  Usuario
                </th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-[#475569] uppercase tracking-wide">
                  Acción
                </th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-[#475569] uppercase tracking-wide">
                  Entidad
                </th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-[#F8FAFC] transition-colors">
                  <td className="px-5 py-3 text-[#475569] whitespace-nowrap">
                    {new Date(entry.created_at).toLocaleString("es-AR", { hour12: false })}
                  </td>
                  <td className="px-5 py-3 text-[#1E293B]">
                    {entry.usuario ? (
                      `${entry.usuario.apellido}, ${entry.usuario.nombre}`
                    ) : (
                      <span className="text-[#94A3B8]">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                        ACCIONES_COLORS[entry.accion] ?? "bg-[#F1F5F9] text-[#475569]"
                      }`}
                    >
                      {ACCIONES_LABELS[entry.accion] ?? entry.accion}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-[#475569]">
                    {ENTIDADES_LABELS[entry.entidad_tipo] ?? entry.entidad_tipo}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {(entry.valores_anteriores || entry.valores_nuevos) && (
                      <button
                        onClick={() => setSelectedEntry(entry)}
                        className="text-[#0088D1] hover:text-[#0277BD] text-xs font-semibold hover:underline transition-colors"
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
          <div className="flex items-center justify-between px-5 py-3 border-t border-[#E2E8F0]">
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-[#475569] hover:bg-[#F1F5F9] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={14} />
              Anterior
            </button>
            <span className="text-xs text-[#94A3B8]">
              Página {page + 1} de {totalPages}
            </span>
            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages - 1}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-[#475569] hover:bg-[#F1F5F9] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
        className="fixed right-0 top-0 h-full w-[min(500px,calc(100vw-2rem))] bg-white shadow-2xl border-l border-[#E2E8F0] flex flex-col animate-in slide-in-from-right"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-full bg-[#E1F5FE] text-[#0088D1] inline-flex items-center justify-center">
              <Clock size={18} />
            </div>
            <div>
              <h2 className="text-[#0F172A] font-semibold">Detalle del registro</h2>
              <p className="text-[#475569] text-xs">
                {new Date(entry.created_at).toLocaleString("es-AR", { hour12: false })}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-8 rounded-full text-[#475569] hover:bg-[#F1F5F9] inline-flex items-center justify-center"
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </div>

        {/* Meta */}
        <div className="px-5 py-4 border-b border-[#E2E8F0] space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                ACCIONES_COLORS[entry.accion] ?? "bg-[#F1F5F9] text-[#475569]"
              }`}
            >
              {ACCIONES_LABELS[entry.accion] ?? entry.accion}
            </span>
            <span className="text-[#94A3B8] text-xs">·</span>
            <span className="text-[12px] text-[#475569]">
              {ENTIDADES_LABELS[entry.entidad_tipo] ?? entry.entidad_tipo}
            </span>
          </div>
          {entry.usuario && (
            <p className="text-[12px] text-[#475569] flex items-center gap-1">
              <User size={11} className="text-[#0088D1]" />
              {entry.usuario.apellido}, {entry.usuario.nombre}
            </p>
          )}
        </div>

        {/* Diff */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {entry.valores_anteriores && (
            <div>
              <p className="text-[11px] font-semibold text-[#475569] mb-2">Antes:</p>
              <div className="bg-[#FEE2E2] text-[#7F1D1D] px-3 py-2 rounded text-[11px] font-mono break-words whitespace-pre-wrap max-h-64 overflow-y-auto">
                {JSON.stringify(entry.valores_anteriores, null, 2)}
              </div>
            </div>
          )}
          {entry.valores_nuevos && (
            <div>
              <p className="text-[11px] font-semibold text-[#475569] mb-2">Después:</p>
              <div className="bg-[#DCFCE7] text-[#14532D] px-3 py-2 rounded text-[11px] font-mono break-words whitespace-pre-wrap max-h-64 overflow-y-auto">
                {JSON.stringify(entry.valores_nuevos, null, 2)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
