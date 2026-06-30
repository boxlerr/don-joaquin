"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { subscribe, getSnapshot, getServerSnapshot, dismissToast } from "./toastStore";
import ToastCard from "./ToastCard";

/**
 * Pila de toasts in-app. Portal a document.body para que floten por encima de
 * todo. Desktop: abajo-derecha. Mobile (<sm): arriba, ancho casi completo.
 */
export default function NotifToaster() {
  const toasts = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (typeof document === "undefined") return null;
  if (toasts.length === 0) return null;

  return createPortal(
    <div
      role="region"
      aria-label="Notificaciones"
      className="pointer-events-none fixed z-[100] flex flex-col gap-2 inset-x-2 top-2 sm:inset-x-auto sm:top-auto sm:bottom-4 sm:right-4 sm:w-80"
    >
      {toasts.map((t) => (
        <ToastCard key={t.key} toast={t} onDismiss={() => dismissToast(t.key)} />
      ))}
    </div>,
    document.body,
  );
}
