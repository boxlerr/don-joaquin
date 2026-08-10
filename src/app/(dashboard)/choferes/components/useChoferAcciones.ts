"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  updateChoferEstadoAction,
  reactivarChoferAction,
  deleteChoferAction,
} from "../actions";

/**
 * Las acciones de un legajo (activar/inactivar, egresar, reactivar, eliminar)
 * en un solo lugar.
 *
 * Vivían adentro de la tarjeta. Al agregarse la vista de tabla había que
 * copiarlas a la fila, y con dos copias arreglar algo en una vista deja a la
 * otra con el comportamiento viejo — que es peor que no tenerla.
 */
type ChoferAccionable = { id: string; estado: string };

/** El mensaje de error de un server action, venga como venga la respuesta. */
function errorDe(res: unknown): string | null {
  if (res && typeof res === "object" && "error" in res) {
    const e = (res as { error?: unknown }).error;
    if (typeof e === "string" && e) return e;
  }
  return null;
}

export function useChoferAcciones(chofer: ChoferAccionable) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [egresarOpen, setEgresarOpen] = useState(false);

  const esBaja = chofer.estado === "baja";

  /** Corre la acción y devuelve si salió bien, para que quien llama cierre su confirmación. */
  const correr = async (fn: () => Promise<unknown>): Promise<boolean> => {
    setLoading(true);
    setError(null);
    const msg = errorDe(await fn());
    if (msg) setError(msg);
    else router.refresh();
    setLoading(false);
    return !msg;
  };

  return {
    loading,
    error,
    setError,
    egresarOpen,
    setEgresarOpen,
    /** Abre el diálogo de egreso (o el de completar datos, si ya está egresado). */
    abrirEgresar: () => {
      setError(null);
      setEgresarOpen(true);
    },
    toggleEstado: () =>
      esBaja
        ? Promise.resolve(false)
        : correr(() =>
            updateChoferEstadoAction(
              chofer.id,
              chofer.estado === "activo" ? "inactivo" : "activo",
            ),
          ),
    reactivar: () => correr(() => reactivarChoferAction(chofer.id)),
    eliminar: () => correr(() => deleteChoferAction(chofer.id)),
    refrescar: () => router.refresh(),
  };
}
