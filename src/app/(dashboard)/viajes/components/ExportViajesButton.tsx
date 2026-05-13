"use client";

import ExportButton from "@/components/ExportButton";
import { ViajesExcelService } from "@/domain/viajes/viajes-excel";
import { getAllViajesForExportAction } from "../actions";

interface ExportViajesButtonProps {
  choferId?: string;
  disabled?: boolean;
}

export default function ExportViajesButton({ choferId, disabled }: ExportViajesButtonProps) {
  const handleExport = async () => {
    // Obtener los datos completos desde el servidor
    const data = await getAllViajesForExportAction(choferId);
    
    if (!data || data.length === 0) {
      throw new Error("No hay viajes registrados para exportar.");
    }

    // Llamar al servicio de dominio para procesar y descargar el Excel
    ViajesExcelService.exportViajesToExcel(
      data,
      choferId ? `viajes_chofer_${choferId}` : "viajes"
    );
  };

  return <ExportButton onClick={handleExport} disabled={disabled} label="Exportar" />;
}
