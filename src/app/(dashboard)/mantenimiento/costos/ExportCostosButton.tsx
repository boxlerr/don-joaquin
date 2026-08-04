"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { descargarExport } from "@/lib/download-export";
import { FileSpreadsheet, Loader2 } from "lucide-react";

/** Baja el Excel del período que se está viendo (o de todo, si no hay mes elegido). */
export default function ExportCostosButton({
  mes,
  busqueda,
  onDone,
  onError,
}: {
  mes: string | null;
  /** Lo que está filtrado en pantalla: el Excel tiene que traer lo mismo. */
  busqueda?: string;
  onDone?: () => void;
  onError?: (msg: string) => void;
}) {
  const [busy, setBusy] = useState(false);

  const bajar = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const params = new URLSearchParams();
      if (mes) params.set("mes", mes);
      if (busqueda?.trim()) params.set("q", busqueda.trim());
      const qs = params.toString();
      const url = `/mantenimiento/costos/export${qs ? `?${qs}` : ""}`;
      await descargarExport(url, `costos_repuestos_reparaciones${mes ? `_${mes.slice(0, 7)}` : ""}.xlsx`);
      onDone?.();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "No se pudo generar el Excel.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={bajar} disabled={busy}>
      {busy ? (
        <Loader2 size={14} className="animate-spin text-[#10B981]" />
      ) : (
        <FileSpreadsheet size={14} className="text-[#10B981]" />
      )}
      Exportar
    </Button>
  );
}
