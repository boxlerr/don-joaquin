"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, Check, CheckCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { marcarAlertaVista, marcarTodasVistas } from "@/app/(dashboard)/notificaciones/actions";
import { alertaHref } from "@/app/(dashboard)/notificaciones/utils";

type Alerta = {
  id: string;
  tipo: string;
  severidad: "info" | "advertencia" | "critica";
  titulo: string;
  mensaje: string;
  fecha_disparo: string;
  fecha_vencimiento: string | null;
  entidad_tipo: string | null;
};

const severidadDot: Record<Alerta["severidad"], string> = {
  critica: "bg-red-500",
  advertencia: "bg-amber-400",
  info: "bg-blue-400",
};

export default function NotificationBell({ initialCount }: { initialCount: number }) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const fetchAlertas = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/alertas");
      const data = await res.json();
      setAlertas(data);
      setCount(data.length);
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    setOpen((prev) => {
      if (!prev) fetchAlertas();
      return !prev;
    });
  };

  const handleMarcarVista = async (id: string) => {
    setAlertas((prev) => prev.filter((a) => a.id !== id));
    setCount((prev) => Math.max(0, prev - 1));
    await marcarAlertaVista(id);
  };

  const handleMarcarTodas = async () => {
    setAlertas([]);
    setCount(0);
    setOpen(false);
    await marcarTodasVistas();
    router.refresh();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={handleOpen}
        className="relative flex items-center justify-center w-8 h-8 rounded-lg text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A] transition-colors"
        aria-label="Notificaciones"
      >
        <Bell size={18} />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 bg-white rounded-xl border border-[#E2E8F0] shadow-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#E2E8F0]">
            <span className="text-sm font-semibold text-[#0F172A]">Notificaciones</span>
            {alertas.length > 0 && (
              <button
                type="button"
                onClick={handleMarcarTodas}
                className="flex items-center gap-1 text-xs text-[#0088D1] hover:text-[#0069A5] font-medium"
              >
                <CheckCheck size={13} />
                Marcar todas
              </button>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto">
            {loading ? (
              <div className="py-8 text-center text-sm text-[#94A3B8]">Cargando...</div>
            ) : alertas.length === 0 ? (
              <div className="py-8 text-center text-sm text-[#94A3B8]">
                Sin alertas pendientes
              </div>
            ) : (
              alertas.map((alerta) => {
                const href = alertaHref(alerta);
                const content = (
                  <>
                    <span
                      className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${severidadDot[alerta.severidad]}`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[#0F172A] truncate">{alerta.titulo}</p>
                      <p className="text-xs text-[#64748B] mt-0.5 line-clamp-2">{alerta.mensaje}</p>
                    </div>
                  </>
                );
                return (
                  <div
                    key={alerta.id}
                    className="group flex items-start gap-3 px-4 py-3 hover:bg-[#F8FAFC] border-b border-[#F1F5F9] last:border-0"
                  >
                    {href ? (
                      <Link
                        href={href}
                        onClick={() => setOpen(false)}
                        className="flex items-start gap-3 flex-1 min-w-0"
                      >
                        {content}
                      </Link>
                    ) : (
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {content}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => handleMarcarVista(alerta.id)}
                      className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-5 h-5 rounded text-[#94A3B8] hover:text-[#0088D1] hover:bg-[#E1F5FE] transition-all shrink-0 mt-0.5"
                      aria-label="Marcar como vista"
                    >
                      <Check size={12} />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {alertas.length > 0 && (
            <div className="px-4 py-2.5 border-t border-[#E2E8F0] bg-[#F8FAFC]">
              <a
                href="/notificaciones"
                className="block text-center text-xs text-[#0088D1] hover:text-[#0069A5] font-medium"
                onClick={() => setOpen(false)}
              >
                Ver todas las alertas
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
