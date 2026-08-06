"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X, AlertOctagon, AlertTriangle, Info, Bell, ChevronRight } from "lucide-react";
import type { ToastData } from "./toastStore";
import { useNotificaciones } from "./useNotificaciones";

// Duración de auto-cierre por severidad. Las críticas NO se cierran solas: el
// usuario las descarta a mano (más molestas a propósito, como pidió el cliente).
const AUTO_MS: Record<ToastData["severidad"], number | null> = {
  info: 5_000,
  advertencia: 8_000,
  critica: null,
};

const SEV: Record<
  ToastData["severidad"],
  { border: string; bar: string; iconBg: string; iconColor: string; Icon: typeof Info }
> = {
  critica: {
    border: "border-l-[#EF4444]",
    bar: "bg-[#EF4444]",
    iconBg: "bg-[#FEE2E2]",
    iconColor: "text-[#DC2626]",
    Icon: AlertOctagon,
  },
  advertencia: {
    border: "border-l-[#F59E0B]",
    bar: "bg-[#F59E0B]",
    iconBg: "bg-[#FFFBEB]",
    iconColor: "text-[#D97706]",
    Icon: AlertTriangle,
  },
  info: {
    border: "border-l-[#0088D1]",
    bar: "bg-[#0088D1]",
    iconBg: "bg-brand-50",
    iconColor: "text-primary",
    Icon: Info,
  },
};

export default function ToastCard({ toast, onDismiss }: { toast: ToastData; onDismiss: () => void }) {
  const router = useRouter();
  const { marcarVista } = useNotificaciones();
  const [paused, setPaused] = useState(false);
  const closedRef = useRef(false);

  const sev = SEV[toast.severidad];
  const Icon = toast.variant === "resumen" ? Bell : sev.Icon;
  const autoMs = AUTO_MS[toast.severidad];

  // Tiempo restante real: el hover PAUSA (no reinicia) la cuenta regresiva.
  const remainingRef = useRef(autoMs ?? 0);
  const startRef = useRef(0);

  const close = () => {
    if (closedRef.current) return;
    closedRef.current = true;
    onDismiss();
  };

  // Auto-cierre con tiempo restante: al pausar descuenta lo transcurrido; al
  // reanudar arranca un timer por lo que queda. Las críticas (autoMs null) no cierran solas.
  useEffect(() => {
    if (autoMs == null || paused) return;
    startRef.current = Date.now();
    const t = setTimeout(close, remainingRef.current);
    return () => {
      clearTimeout(t);
      remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startRef.current));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoMs, paused]);

  const handleClick = () => {
    if (toast.variant === "single" && toast.alertaId) {
      // Click = leída (optimista) + navegar al destino.
      void marcarVista(toast.alertaId);
    }
    if (toast.href) router.push(toast.href);
    close();
  };

  return (
    <div
      role={toast.severidad === "critica" ? "alert" : "status"}
      aria-live={toast.severidad === "critica" ? "assertive" : "polite"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={`pointer-events-auto relative w-full sm:w-80 overflow-hidden rounded-xl border border-border ${sev.border} border-l-4 bg-card shadow-lg motion-safe:animate-[toast-in_0.22s_ease-out]`}
    >
      <button
        type="button"
        onClick={handleClick}
        className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
      >
        <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${sev.iconBg}`}>
          <Icon size={16} className={sev.iconColor} />
        </span>
        <span className="min-w-0 flex-1 pr-5">
          <span className="block text-sm font-semibold text-foreground truncate">{toast.titulo}</span>
          <span className="mt-0.5 block text-xs text-muted-foreground line-clamp-2">{toast.mensaje}</span>
          {toast.variant === "single" && toast.href && (
            <span className="mt-1 inline-flex items-center gap-0.5 text-[11px] font-medium text-primary/80">
              Ir <ChevronRight size={12} />
            </span>
          )}
        </span>
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          close();
        }}
        aria-label="Cerrar notificación"
        className="absolute right-1.5 top-1.5 flex h-9 w-9 sm:h-7 sm:w-7 items-center justify-center rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors"
      >
        <X size={15} />
      </button>

      {autoMs != null && (
        // Barra montada una sola vez; el hover la PAUSA (animation-play-state) en
        // vez de remontarla, así queda en sync con el tiempo restante real.
        <span
          className={`absolute bottom-0 left-0 h-0.5 ${sev.bar} motion-safe:animate-[toast-progress_linear_forwards] motion-reduce:hidden`}
          style={{ animationDuration: `${autoMs}ms`, animationPlayState: paused ? "paused" : "running" }}
        />
      )}
    </div>
  );
}
