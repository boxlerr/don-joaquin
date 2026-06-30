"use client";

import ExportButton from "@/components/ExportButton";
import { descargarExport } from "@/lib/download-export";

/**
 * Exporta a Excel las cargas de combustible del período seleccionado
 * (mismo filtro de mes que el resto de la página). El archivo lo genera el
 * route handler con el estilo corporativo común.
 */
export default function ExportCombustibleButton({ month }: { month?: string }) {
  const handleExport = () =>
    descargarExport(
      `/combustible/export?month=${month ?? ""}`,
      `combustible_${month || "mes-actual"}.xlsx`,
    );

  return <ExportButton onClick={handleExport} label="Exportar" />;
}
