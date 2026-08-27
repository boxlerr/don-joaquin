"use client";

import type { Severidad } from "@/app/(dashboard)/notificaciones/utils";

/**
 * Store mínimo de toasts visibles, compatible con useSyncExternalStore (sin lib).
 * El provider hace push(); el <NotifToaster/> se suscribe y renderiza.
 */

export type ToastData = {
  // Para "single" = id de la alerta; para "resumen" = clave sintética.
  key: string;
  variant: "single" | "resumen";
  severidad: Severidad;
  titulo: string;
  mensaje: string;
  href: string | null;
  // Sólo en "single": id real de la alerta para marcarla leída al click.
  alertaId?: string;
  /** Columna de la matriz: da el ícono y el color, los mismos del resumen. */
  categoria?: string;
  /**
   * Avisos que no se pueden "marcar como leídos" y sólo se apagan haciendo lo
   * que piden (hoy: el cheque en cartera que vence hoy o que ya venció). Se
   * dibujan más grandes y no se cierran solos.
   */
  insistente?: boolean;
};

const MAX_VISIBLE = 3;

let toasts: ToastData[] = [];
const listeners = new Set<() => void>();

function emit() {
  toasts = [...toasts];
  listeners.forEach((l) => l());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): ToastData[] {
  return toasts;
}

// Referencia estable para SSR (evita el warning "getServerSnapshot should be cached").
const EMPTY: ToastData[] = [];
export function getServerSnapshot(): ToastData[] {
  return EMPTY;
}

export function pushToast(toast: ToastData): void {
  // Evitar duplicar un toast con la misma key si ya está visible.
  if (toasts.some((t) => t.key === toast.key)) return;
  toasts = [...toasts, toast];

  // Tope de visibles: descartar el más viejo NO crítico; los críticos tienen
  // prioridad de permanencia (el usuario los cierra a mano).
  if (toasts.length > MAX_VISIBLE) {
    const idxNoCritico = toasts.findIndex((t) => t.severidad !== "critica");
    if (idxNoCritico !== -1) {
      toasts = toasts.filter((_, i) => i !== idxNoCritico);
    } else {
      toasts = toasts.slice(toasts.length - MAX_VISIBLE);
    }
  }
  emit();
}

export function dismissToast(key: string): void {
  const next = toasts.filter((t) => t.key !== key);
  if (next.length !== toasts.length) {
    toasts = next;
    emit();
  }
}
