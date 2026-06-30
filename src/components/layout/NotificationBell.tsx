"use client";

import { useState, useEffect, useRef, useContext } from "react";
import { Bell, Check, CheckCheck } from "lucide-react";
import Link from "next/link";
import { NotificacionesContext } from "@/components/notificaciones/NotificacionesProvider";
import type { Severidad } from "@/app/(dashboard)/notificaciones/utils";

const severidadDot: Record<Severidad, string> = {
  critica: "bg-[#EF4444]",
  advertencia: "bg-[#F59E0B]",
  info: "bg-[#0088D1]",
};

// Color del badge según la severidad más alta sin leer (rojo > ámbar > marca).
const badgeColor: Record<Severidad, string> = {
  critica: "bg-[#EF4444]",
  advertencia: "bg-[#F59E0B]",
  info: "bg-[#0088D1]",
};
const pingColor: Record<Severidad, string> = {
  critica: "bg-[#F87171]",
  advertencia: "bg-[#FBBF24]",
  info: "bg-[#38BDF8]",
};
const SEV_RANK: Record<Severidad, number> = { critica: 3, advertencia: 2, info: 1 };

export default function NotificationBell({ initialCount }: { initialCount: number }) {
  const ctx = useContext(NotificacionesContext);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Sin provider (caso degradado sin sesión): ícono estático con el conteo inicial.
  const count = ctx?.count ?? initialCount;
  const items = ctx?.items ?? [];
  const loading = ctx?.loading ?? false;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Severidad dominante para teñir el badge/halo. Si todavía no llegó el primer
  // poll (items vacíos pero count>0), usamos rojo para no pasar desapercibido.
  const sevMax: Severidad = items.reduce<Severidad>((acc, it) => (SEV_RANK[it.severidad] > SEV_RANK[acc] ? it.severidad : acc), items.length ? "info" : "critica");

  const handleOpen = () => {
    setOpen((prev) => {
      if (!prev) ctx?.refresh();
      return !prev;
    });
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={handleOpen}
        className={`relative flex items-center justify-center w-8 h-8 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card ${
          count > 0
            ? "bg-brand-50 text-primary hover:bg-brand-100"
            : "text-muted-foreground hover:bg-muted hover:text-primary"
        }`}
        aria-label={count > 0 ? `Notificaciones (${count} sin leer)` : "Notificaciones"}
      >
        {/* key={count} re-dispara el balanceo de una pasada cuando entra algo nuevo */}
        <Bell
          key={count}
          size={18}
          className={count > 0 && !open ? "motion-safe:animate-[wiggle_0.7s_ease-in-out_1]" : undefined}
        />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center">
            {!open && (
              <span
                className={`absolute inline-flex w-full h-full rounded-full opacity-75 motion-safe:animate-ping [animation-iteration-count:3] ${pingColor[sevMax]}`}
              />
            )}
            <span
              className={`relative flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full ring-2 ring-card text-white text-[10px] font-bold leading-none tabular-nums ${badgeColor[sevMax]}`}
            >
              {count > 9 ? "9+" : count}
            </span>
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 bg-card rounded-xl border border-border shadow-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-sm font-semibold text-foreground">Notificaciones</span>
            {items.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  ctx?.marcarTodas();
                  setOpen(false);
                }}
                className="flex items-center gap-1 text-xs text-primary hover:text-[#0069A5] font-medium"
              >
                <CheckCheck size={13} />
                Marcar todas
              </button>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto">
            {loading && items.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground/70">Cargando...</div>
            ) : items.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground/70">
                Sin alertas pendientes
              </div>
            ) : (
              items.map((item) => {
                const content = (
                  <>
                    <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${severidadDot[item.severidad]}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{item.titulo}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.mensaje}</p>
                    </div>
                  </>
                );
                return (
                  <div
                    key={item.id}
                    className="group flex items-start gap-3 px-4 py-3 hover:bg-muted/40 border-b border-[#F1F5F9] last:border-0"
                  >
                    {item.href ? (
                      <Link
                        href={item.href}
                        onClick={() => {
                          ctx?.marcarVista(item.id);
                          setOpen(false);
                        }}
                        className="flex items-start gap-3 flex-1 min-w-0"
                      >
                        {content}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          ctx?.marcarVista(item.id);
                          setOpen(false);
                        }}
                        className="flex items-start gap-3 flex-1 min-w-0 text-left"
                      >
                        {content}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => ctx?.marcarVista(item.id)}
                      className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-5 h-5 rounded text-muted-foreground/70 hover:text-primary hover:bg-[#E1F5FE] transition-all shrink-0 mt-0.5"
                      aria-label="Marcar como vista"
                    >
                      <Check size={12} />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {items.length > 0 && (
            <div className="px-4 py-2.5 border-t border-border bg-muted/40">
              <a
                href="/notificaciones"
                className="block text-center text-xs text-primary hover:text-[#0069A5] font-medium"
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
