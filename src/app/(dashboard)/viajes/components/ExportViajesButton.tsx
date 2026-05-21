"use client";

import ExportButton from "@/components/ExportButton";
import { ViajesExcelService } from "@/domain/viajes/viajes-excel";
import { getAllViajesForExportAction } from "../actions";

interface ExportViajesButtonProps {
  choferId?: string;
  desde?: string;
  hasta?: string;
  estado?: string;
  search?: string;
  disabled?: boolean;
}

export default function ExportViajesButton({
  choferId,
  desde,
  hasta,
  estado,
  search,
  disabled,
}: ExportViajesButtonProps) {
  const hayFiltros = !!(desde || hasta || estado || search);

  const handleExport = async () => {
    const data = await getAllViajesForExportAction({
      choferId,
      desde,
      hasta,
      estado,
      search,
    });

    if (!data || data.length === 0) {
      throw new Error("No hay viajes para exportar con los filtros actuales.");
    }

    let filename = choferId ? `viajes_chofer_${choferId}` : "viajes";
    if (desde || hasta) {
      const partes = [desde, hasta].filter(Boolean).join("_");
      filename += `_${partes}`;
    }

    ViajesExcelService.exportViajesToExcel(data, filename);
  };

  return (
    <ExportButton
      onClick={handleExport}
      disabled={disabled}
      label={hayFiltros ? "Exportar filtro" : "Exportar"}
    />
  );
}
