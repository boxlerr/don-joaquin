"use client";

import { useState, useEffect } from "react";
import { X, Clock, User, ChevronDown, ChevronUp } from "lucide-react";
import { getViajeAuditTrail, type AuditTrailEntry } from "../actions";

interface AuditTrailDrawerProps {
  viajeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AuditTrailDrawer({
  viajeId,
  open,
  onOpenChange,
}: AuditTrailDrawerProps) {
  const [entries, setEntries] = useState<AuditTrailEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    setLoading(true);
    getViajeAuditTrail(viajeId).then((result) => {
      if ("data" in result && result.data) {
        setEntries(result.data);
      }
      setLoading(false);
    });
  }, [open, viajeId]);

  const getAccionLabel = (accion: string): string => {
    const labels: Record<string, string> = {
      crear: "Creación",
      cambio_estado: "Cambio de estado",
      actualizar: "Actualización",
      eliminar: "Eliminación",
    };
    return labels[accion] || accion;
  };

  const getAccionColor = (accion: string): string => {
    switch (accion) {
      case "crear":
        return "bg-[#ECFDF5] text-[#065F46]";
      case "cambio_estado":
        return "bg-[#E0E7FF] text-[#3730A3]";
      case "actualizar":
        return "bg-[#FEF3C7] text-[#92400E]";
      case "eliminar":
        return "bg-[#FEE2E2] text-[#7F1D1D]";
      default:
        return "bg-[#F1F5F9] text-[#475569]";
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
      onClick={() => onOpenChange(false)}
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
              <h2 className="text-[#0F172A] font-semibold">Historial de cambios</h2>
              <p className="text-[#475569] text-xs">Auditoría completa del viaje</p>
            </div>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="size-8 rounded-full text-[#475569] hover:bg-[#F1F5F9] inline-flex items-center justify-center"
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-[#94A3B8]">
              Cargando historial...
            </div>
          ) : entries.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-[#94A3B8] text-sm">
              Sin cambios registrados
            </div>
          ) : (
            <div className="divide-y divide-[#E2E8F0]">
              {entries.map((entry) => (
                <div key={entry.id} className="px-5 py-3">
                  {/* Entry header */}
                  <button
                    onClick={() =>
                      setExpandedId(expandedId === entry.id ? null : entry.id)
                    }
                    className="w-full flex items-start justify-between gap-3 hover:opacity-70 transition-opacity"
                  >
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold ${getAccionColor(
                            entry.accion,
                          )}`}
                        >
                          {getAccionLabel(entry.accion)}
                        </span>
                      </div>
                      <p className="text-[12px] text-[#94A3B8]">
                        {new Date(entry.created_at).toLocaleString("es-AR")}
                      </p>
                      {entry.usuario && (
                        <p className="text-[12px] text-[#475569] flex items-center gap-1 mt-1">
                          <User size={11} className="text-[#0088D1]" />
                          {entry.usuario.apellido}, {entry.usuario.nombre}
                        </p>
                      )}
                    </div>
                    {(entry.valores_anteriores || entry.valores_nuevos) && (
                      <div className="text-[#0088D1] hover:text-[#0277BD]">
                        {expandedId === entry.id ? (
                          <ChevronUp size={16} />
                        ) : (
                          <ChevronDown size={16} />
                        )}
                      </div>
                    )}
                  </button>

                  {/* Expanded details */}
                  {expandedId === entry.id &&
                    (entry.valores_anteriores || entry.valores_nuevos) && (
                      <div className="mt-3 pt-3 border-t border-[#E2E8F0] space-y-2">
                        {entry.valores_anteriores && (
                          <div>
                            <p className="text-[11px] font-semibold text-[#475569] mb-1">
                              Antes:
                            </p>
                            <div className="bg-[#FEE2E2] text-[#7F1D1D] px-3 py-2 rounded text-[11px] font-mono break-words max-h-32 overflow-y-auto">
                              {JSON.stringify(entry.valores_anteriores, null, 2)}
                            </div>
                          </div>
                        )}
                        {entry.valores_nuevos && (
                          <div>
                            <p className="text-[11px] font-semibold text-[#475569] mb-1">
                              Después:
                            </p>
                            <div className="bg-[#DCFCE7] text-[#14532D] px-3 py-2 rounded text-[11px] font-mono break-words max-h-32 overflow-y-auto">
                              {JSON.stringify(entry.valores_nuevos, null, 2)}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
