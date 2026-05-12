"use client";

import { useEffect, useState, useTransition } from "react";
import { ArrowRight, Check, History, RotateCcw, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getHistorialParametro,
  revertirParametro,
  type HistorialEvento,
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

function formatValor(valor: string | null, tipo: string): string {
  if (valor === null || valor === "") return "—";
  if (tipo === "boolean") return valor === "true" ? "Activado" : "Desactivado";
  return valor;
}

export default function HistorialDrawer({
  open,
  onClose,
  parametroId,
  parametroDescripcion,
  parametroClave,
  parametroTipo,
}: {
  open: boolean;
  onClose: () => void;
  parametroId: string;
  parametroDescripcion: string;
  parametroClave: string;
  parametroTipo: string;
}) {
  const [eventos, setEventos] = useState<HistorialEvento[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  const [revertidoId, setRevertidoId] = useState<string | null>(null);
  const [revertError, setRevertError] = useState<string | null>(null);
  const [isPendingRevert, startTransitionRevert] = useTransition();

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const fetchEventos = async () => {
      setLoading(true);
      try {
        const data = await getHistorialParametro(parametroId);
        if (!cancelled) {
          setEventos(data);
          setConfirmandoId(null);
          setRevertidoId(null);
          setRevertError(null);
        }
      } catch (e) {
        console.error("Error obteniendo historial:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchEventos();
    return () => {
      cancelled = true;
    };
  }, [open, parametroId, refreshKey]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (confirmandoId) {
          setConfirmandoId(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, confirmandoId]);

  function onConfirmarRevert(evento: HistorialEvento) {
    if (!evento.valor_anterior) return;
    setRevertError(null);
    startTransitionRevert(async () => {
      const result = await revertirParametro(
        parametroId,
        evento.valor_anterior!,
        evento.id,
        evento.created_at,
      );
      if ("error" in result) {
        setRevertError(result.error);
        setConfirmandoId(null);
        return;
      }
      setRevertidoId(evento.id);
      setConfirmandoId(null);
      setTimeout(() => {
        setRefreshKey((k) => k + 1);
      }, 800);
    });
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40 transition-opacity"
          onClick={() => {
            if (confirmandoId) {
              setConfirmandoId(null);
            } else {
              onClose();
            }
          }}
        />
      )}

      <div
        className={`fixed top-0 right-0 h-full w-[460px] max-w-[90vw] bg-white shadow-2xl z-50 transform transition-transform duration-200 flex flex-col ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="bg-gradient-to-r from-[#0088D1] to-[#0077B6] text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <History size={16} />
              <h2 className="text-base font-bold truncate">{parametroDescripcion}</h2>
            </div>
            <p className="text-xs text-blue-100 mt-0.5 font-mono truncate">
              {parametroClave}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors shrink-0"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {revertError && (
            <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-4 py-2.5 text-sm text-[#7F1D1D]">
              {revertError}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-7 w-7 border-2 border-[#0088D1] border-t-transparent" />
            </div>
          ) : eventos.length === 0 ? (
            <div className="text-center py-16 text-[#475569]">
              <History size={32} className="mx-auto text-[#CBD5E1] mb-3" />
              <p className="text-sm">Sin cambios registrados</p>
              <p className="text-xs mt-1 text-[#94A3B8]">
                Cuando alguien edite este parámetro, aparecerá acá
              </p>
            </div>
          ) : (
            eventos.map((ev, idx) => {
              const puedeRevertir = idx > 0 && ev.valor_anterior !== null;
              const isConfirmando = confirmandoId === ev.id;
              const isRevertido = revertidoId === ev.id;

              return (
                <div
                  key={ev.id}
                  className={`border rounded-lg p-3.5 transition-colors ${
                    isConfirmando
                      ? "border-[#FFB300] bg-[#FFFBEB]"
                      : isRevertido
                        ? "border-[#10B981] bg-[#ECFDF5]"
                        : "border-[#E2E8F0] hover:border-[#CBD5E1]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-[#E1F5FE] flex items-center justify-center shrink-0">
                        <User size={12} className="text-[#0088D1]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#0F172A] truncate">
                          {ev.usuario_nombre ?? ev.usuario_email ?? "Sistema"}
                        </p>
                        {ev.usuario_nombre && ev.usuario_email && (
                          <p className="text-[11px] text-[#94A3B8] truncate">
                            {ev.usuario_email}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="text-[11px] text-[#64748B] shrink-0 mt-1">
                      {fmtDate(ev.created_at)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap text-xs mb-2.5">
                    <span className="font-mono bg-[#FEF2F2] text-[#7F1D1D] px-2 py-0.5 rounded border border-[#FECACA]">
                      {formatValor(ev.valor_anterior, parametroTipo)}
                    </span>
                    <ArrowRight size={12} className="text-[#94A3B8]" />
                    <span className="font-mono bg-[#ECFDF5] text-[#064E3B] px-2 py-0.5 rounded border border-[#A7F3D0]">
                      {formatValor(ev.valor_nuevo, parametroTipo)}
                    </span>
                  </div>

                  {isRevertido ? (
                    <div className="flex items-center gap-1.5 text-xs text-[#10B981] font-medium">
                      <Check size={12} />
                      Restaurado — recargando…
                    </div>
                  ) : isConfirmando ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-[#78350F]">
                        ¿Volver a{" "}
                        <span className="font-mono font-semibold">
                          {formatValor(ev.valor_anterior, parametroTipo)}
                        </span>
                        ?
                      </span>
                      <Button
                        type="button"
                        variant="brand"
                        size="xs"
                        onClick={() => onConfirmarRevert(ev)}
                        disabled={isPendingRevert}
                      >
                        <Check size={11} />
                        {isPendingRevert ? "Restaurando…" : "Confirmar"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => setConfirmandoId(null)}
                        disabled={isPendingRevert}
                      >
                        Cancelar
                      </Button>
                    </div>
                  ) : puedeRevertir ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={() => setConfirmandoId(ev.id)}
                      className="text-[#475569] hover:text-[#0088D1] hover:border-[#0088D1]"
                    >
                      <RotateCcw size={11} />
                      Volver a {formatValor(ev.valor_anterior, parametroTipo)}
                    </Button>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
