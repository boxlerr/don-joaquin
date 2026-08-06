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
  // IDs ya marcados (optimista) en esta sesión: evita que un doble-click descuente
  // el badge dos veces por la misma alerta. El poll del finally reconcilia igual.
  const marcadasRef = useRef<Set<string>>(new Set());

  // Aplica la regla de toast sobre el resultado de un poll:
  //   - primer load de la sesión (no bootstrapped) → NINGÚN toast, sólo se toma
  //     nota de lo que ya existe. El "tenés N sin leer" de arranque lo hace ahora
  //     el ResumenDiarioModal, en el medio de la pantalla: el toast de la esquina
  //     no se veía y era lo único que avisaba del pendiente acumulado.
  //   - polls siguientes → 1 toast por cada alerta genuinamente nueva (dedup
  //     localStorage). Eso sigue: avisa en el momento, que es otra cosa.
  const aplicarReglaToast = useCallback(
    (nextItems: ResumenItem[], allIds: string[]) => {
      if (!isBootstrapped(userId)) {
        // Marcamos TODAS las no leídas como ya avisadas (no sólo el top-8 visible),
        // así una alerta vieja que después suba al top-8 no aparece como "nueva".
        // Sin esto, el poll siguiente escupiría las 48 viejas de una.
        addToasted(userId, allIds.length ? allIds : nextItems.map((i) => i.id));
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
      const data = (await res.json()) as { count: number; items: ResumenItem[]; allIds?: string[] };
      setCount(data.count);
      setItems(data.items);
      aplicarReglaToast(data.items, data.allIds ?? []);
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
    // 0 lo hace prácticamente inmediato → el badge queda al día apenas entra, y de
    // paso se toma nota de lo ya existente para no toastearlo después como nuevo.
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
      // "ya avisada". El badge sólo baja la primera vez que se marca ese id (evita
      // doble-decremento por doble-click); el poll del finally reconcilia con el server.
      const yaMarcada = marcadasRef.current.has(id);
      marcadasRef.current.add(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      if (!yaMarcada) setCount((c) => Math.max(0, c - 1));
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
