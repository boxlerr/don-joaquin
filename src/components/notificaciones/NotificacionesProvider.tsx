"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { marcarAlertaVista, marcarTodasVistas } from "@/app/(dashboard)/notificaciones/actions";
import type { ResumenItem } from "@/lib/alertas-lecturas";
import type { Severidad } from "@/app/(dashboard)/notificaciones/utils";
import { pushToast, dismissToast } from "./toastStore";
import { addToasted, getToastedSet, isBootstrapped, setBootstrapped } from "./seenStore";

export type NotificacionesCtx = {
  count: number;
  items: ResumenItem[];
  loading: boolean;
  refresh: () => Promise<void>;
  marcarVista: (id: string) => Promise<void>;
  marcarTodas: () => Promise<void>;
};

export const NotificacionesContext = createContext<NotificacionesCtx | null>(null);

const POLL_MS = 60_000;
const MAX_BACKOFF_MS = 5 * 60_000;
const REFRESH_THROTTLE_MS = 5_000;

const SEV_RANK: Record<Severidad, number> = { critica: 3, advertencia: 2, info: 1 };

function maxSeveridad(items: ResumenItem[]): Severidad {
  let best: Severidad = "info";
  for (const it of items) if (SEV_RANK[it.severidad] > SEV_RANK[best]) best = it.severidad;
  return best;
}

export default function NotificacionesProvider({
  userId,
  initialCount,
  children,
}: {
  userId: string;
  initialCount: number;
  children: ReactNode;
}) {
  const [count, setCount] = useState(initialCount);
  const [items, setItems] = useState<ResumenItem[]>([]);
  const [loading, setLoading] = useState(false);

  const backoffRef = useRef(POLL_MS);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRefreshRef = useRef(0);
  const inFlightRef = useRef(false);

  // Aplica la regla de pop-up sobre el resultado de un poll:
  //   - primer load de la sesión (no bootstrapped) y hay sin leer → 1 toast RESUMEN.
  //   - polls siguientes → 1 toast por cada alerta genuinamente nueva (dedup localStorage).
  const aplicarReglaToast = useCallback(
    (nextItems: ResumenItem[], nextCount: number) => {
      if (!isBootstrapped(userId)) {
        if (nextCount > 0) {
          pushToast({
            key: "resumen",
            variant: "resumen",
            severidad: maxSeveridad(nextItems),
            titulo: `Tenés ${nextCount} ${nextCount === 1 ? "notificación sin leer" : "notificaciones sin leer"}`,
            mensaje: "Tocá para verlas todas.",
            href: "/notificaciones",
          });
        }
        // Marcamos lo visible como ya avisado para no repetirlo individualmente.
        addToasted(userId, nextItems.map((i) => i.id));
        setBootstrapped(userId);
        return;
      }

      const yaAvisadas = getToastedSet(userId);
      const nuevas = nextItems.filter((i) => !yaAvisadas.has(i.id));
      if (nuevas.length === 0) return;

      // Escribimos en el set ANTES de pushear (evita doble-toast entre polls/pestañas).
      addToasted(userId, nuevas.map((i) => i.id));
      for (const it of nuevas) {
        pushToast({
          key: it.id,
          variant: "single",
          severidad: it.severidad,
          titulo: it.titulo,
          mensaje: it.mensaje,
          href: it.href,
          alertaId: it.id,
        });
      }
    },
    [userId],
  );

  const poll = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setLoading(true);
    try {
      const res = await fetch("/api/alertas?mode=resumen", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { count: number; items: ResumenItem[] };
      setCount(data.count);
      setItems(data.items);
      aplicarReglaToast(data.items, data.count);
      backoffRef.current = POLL_MS; // éxito → vuelve al intervalo normal
    } catch {
      backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF_MS);
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, [aplicarReglaToast]);

  // Reloj único: se reprograma según backoff y se pausa con la pestaña oculta.
  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      if (typeof document === "undefined" || document.visibilityState === "visible") {
        await poll();
      }
      if (!cancelled) timerRef.current = setTimeout(tick, backoffRef.current);
    };

    // Primer disparo diferido (evita setState síncrono dentro del effect). El delay
    // 0 lo hace prácticamente inmediato → dispara el resumen de login si corresponde.
    timerRef.current = setTimeout(tick, 0);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        const now = Date.now();
        if (now - lastRefreshRef.current > REFRESH_THROTTLE_MS) {
          lastRefreshRef.current = now;
          poll();
        }
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [poll]);

  const refresh = useCallback(async () => {
    const now = Date.now();
    if (now - lastRefreshRef.current < REFRESH_THROTTLE_MS) return;
    lastRefreshRef.current = now;
    await poll();
  }, [poll]);

  const marcarVista = useCallback(
    async (id: string) => {
      // Optimista: sale de la lista, baja el badge, se cierra su toast y queda como
      // "ya avisada" para que no reaparezca.
      setItems((prev) => prev.filter((i) => i.id !== id));
      setCount((c) => Math.max(0, c - 1));
      dismissToast(id);
      addToasted(userId, [id]);
      try {
        await marcarAlertaVista(id);
      } finally {
        await poll();
      }
    },
    [poll, userId],
  );

  const marcarTodas = useCallback(async () => {
    const ids = items.map((i) => i.id);
    setItems([]);
    setCount(0);
    addToasted(userId, ids);
    try {
      await marcarTodasVistas();
    } finally {
      await poll();
    }
  }, [items, poll, userId]);

  return (
    <NotificacionesContext.Provider
      value={{ count, items, loading, refresh, marcarVista, marcarTodas }}
    >
      {children}
    </NotificacionesContext.Provider>
  );
}
