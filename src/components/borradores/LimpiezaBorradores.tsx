"use client";

import { useEffect } from "react";
import { limpiarVencidos } from "@/lib/borrador-local";

/**
 * Se lleva los borradores vencidos, una vez por sesión al entrar.
 *
 * Sin esto, la pantalla que se dejó de usar deja su borrador ocupando lugar en
 * el navegador para siempre, y el día que alguien vuelve se le ofrece algo de
 * hace tres meses.
 */
export default function LimpiezaBorradores() {
  useEffect(() => {
    limpiarVencidos();
  }, []);

  return null;
}
