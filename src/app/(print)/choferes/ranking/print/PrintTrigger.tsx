"use client";

import { useEffect } from "react";

export default function PrintTrigger() {
  useEffect(() => {
    // Dejar que el browser renderice antes de abrir el diálogo de impresión.
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, []);

  return null;
}
