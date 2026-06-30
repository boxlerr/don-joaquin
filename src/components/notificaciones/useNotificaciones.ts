"use client";

import { useContext } from "react";
import { NotificacionesContext, type NotificacionesCtx } from "./NotificacionesProvider";

/**
 * Acceso al estado compartido de notificaciones (un único poller). Lo consumen la
 * campana y el toaster, así no hay doble polling.
 */
export function useNotificaciones(): NotificacionesCtx {
  const ctx = useContext(NotificacionesContext);
  if (!ctx) {
    throw new Error("useNotificaciones debe usarse dentro de <NotificacionesProvider>");
  }
  return ctx;
}
