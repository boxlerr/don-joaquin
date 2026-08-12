"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Quién está usando el sistema, disponible en cualquier componente de cliente.
 *
 * Existe por los borradores: la clave con la que se guarda lo que alguien está
 * tipeando lleva el usuario adentro, y en la oficina se comparten máquinas.
 * Sin esto, cada diálogo tendría que recibir el id por props desde la página,
 * y son más de treinta.
 */
const UsuarioActualContext = createContext<string | null>(null);

export function UsuarioActualProvider({
  userId,
  children,
}: {
  userId: string | null;
  children: ReactNode;
}) {
  return <UsuarioActualContext.Provider value={userId}>{children}</UsuarioActualContext.Provider>;
}

/** `null` fuera del dashboard (login) o si todavía no cargó la sesión. */
export function useUsuarioActualId(): string | null {
  return useContext(UsuarioActualContext);
}
