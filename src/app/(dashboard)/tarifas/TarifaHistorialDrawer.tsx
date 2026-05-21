"use client";

import { useEffect, useState } from "react";
import { ArrowRight, History, User, X } from "lucide-react";
import {
  obtenerHistorialTarifa,
  type TarifaHistorialEvento,
} from "./actions";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const ACCION_LABEL: Record<string, { label: string; bg: string; text: string }> = {
  crear: { label: "Creación", bg: "bg-[#ECFDF5]", text: "text-[#064E3B]" },
  actualizar: { label: "Edición", bg: "bg-[#EFF6FF]", text: "text-[#1E3A8A]" },
  cambio_estado: { label: "Estado", bg: "bg-[#FFFBEB]", text: "text-[#78350F]" },
  eliminar: { label: "Baja", bg: "bg-[#FEF2F2]", text: "text-[#7F1D1D]" },
};

const CAMPO_LABEL: Record<string, string> = {
  cliente_id: "Cliente",
  ruta_id: "Ruta",
  modalidad: "Modalidad",
  valor: "Valor",
  moneda: "Moneda",
  vigencia_desde: "Vigencia desde",
  vigencia_hasta: "Vigencia hasta",
  observaciones: "Observaciones",
  activa: "Activa",
};

function formatCampo(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Sí" : "No";
  if (typeof v === "number") return v.toLocaleString("es-AR");
  return String(v);
}

function diffCampos(
  anteriores: Record<string, unknown> | null,
  nuevos: Record<string, unknown> | null,
): { campo: string; antes: unknown; despues: unknown }[] {
  if (!nuevos && !anteriores) return [];
  const keys = new Set([
    ...Object.keys(anteriores ?? {}),
    ...Object.keys(nuevos ?? {}),
  ]);
  const diffs: { campo: string; antes: unknown; despues: unknown }[] = [];
  for (const k of keys) {
    const a = anteriores?.[k] ?? null;
    const d = nuevos?.[k] ?? null;
    if (JSON.stringify(a) !== JSON.stringify(d)) {
      diffs.push({ campo: k, antes: a, despues: d });
    }
  }
  return diffs;
}

export default function TarifaHistorialDrawer({
  open,
  onClose,
  tarifaId,
  tarifaLabel,
}: {
  open: boolean;
  onClose: () => void;
  tarifaId: string | null;
  tarifaLabel: string;
}) {
  const [eventos, setEventos] = useState<TarifaHistorialEvento[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !tarifaId) return;

    let cancelled = false;
    const fetch = async () => {
      setLoading(true);
      try {
        const data = await obtenerHistorialTarifa(tarifaId);
        if (!cancelled) setEventos(data);
      } catch (e) {
        console.error("Error historial tarifa:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetch();
    return () => {
      cancelled = true;
    };
  }, [open, tarifaId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      <div
        className={`fixed top-0 right-0 h-full w-[480px] max-w-[90vw] bg-card shadow-2xl z-50 transform transition-transform duration-200 flex flex-col ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="bg-gradient-to-r from-[#0088D1] to-[#0077B6] text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <History size={16} />
              <h2 className="text-base font-bold truncate">Historial de tarifa</h2>
            </div>
            <p className="text-xs text-blue-100 mt-0.5 truncate">{tarifaLabel}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-card/20 rounded-lg transition-colors shrink-0"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-7 w-7 border-2 border-[#0088D1] border-t-transparent" />
            </div>
          ) : eventos.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <History size={32} className="mx-auto text-[#CBD5E1] mb-3" />
              <p className="text-sm">Sin cambios registrados</p>
            </div>
          ) : (
            eventos.map((ev) => {
              const meta = ACCION_LABEL[ev.accion] ?? {
                label: ev.accion,
                bg: "bg-muted",
                text: "text-muted-foreground",
              };
              const diffs = diffCampos(ev.valores_anteriores, ev.valores_nuevos);

              return (
                <div
                  key={ev.id}
                  className="border border-border rounded-lg p-3.5 hover:border-[#CBD5E1]"
                >
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-[#E1F5FE] flex items-center justify-center shrink-0">
                        <User size={12} className="text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {ev.usuario_nombre ?? ev.usuario_email ?? "Sistema"}
                        </p>
                        {ev.usuario_nombre && ev.usuario_email && (
                          <p className="text-[11px] text-muted-foreground/70 truncate">
                            {ev.usuario_email}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span
                        className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded ${meta.bg} ${meta.text}`}
                      >
                        {meta.label}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {fmtDate(ev.created_at)}
                      </span>
                    </div>
                  </div>

                  {diffs.length === 0 ? (
                    <p className="text-xs text-muted-foreground/70 italic">Sin diferencias</p>
                  ) : (
                    <div className="space-y-1.5 text-xs">
                      {diffs.map((d) => (
                        <div key={d.campo} className="flex items-start gap-2 flex-wrap">
                          <span className="text-muted-foreground font-medium min-w-[110px]">
                            {CAMPO_LABEL[d.campo] ?? d.campo}:
                          </span>
                          {ev.accion === "crear" ? (
                            <span className="font-mono bg-[#ECFDF5] text-[#064E3B] px-2 py-0.5 rounded border border-[#A7F3D0]">
                              {formatCampo(d.despues)}
                            </span>
                          ) : (
                            <>
                              <span className="font-mono bg-[#FEF2F2] text-[#7F1D1D] px-2 py-0.5 rounded border border-[#FECACA] break-all">
                                {formatCampo(d.antes)}
                              </span>
                              <ArrowRight size={12} className="text-muted-foreground/70 mt-1" />
                              <span className="font-mono bg-[#ECFDF5] text-[#064E3B] px-2 py-0.5 rounded border border-[#A7F3D0] break-all">
                                {formatCampo(d.despues)}
                              </span>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
