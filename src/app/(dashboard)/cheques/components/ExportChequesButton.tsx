"use client";

import ExportButton from "@/components/ExportButton";
import { ChequesExcelService } from "@/domain/cheques/cheques-excel";
import { getAllChequesForExportAction } from "../actions";

export default function ExportChequesButton() {
  const handleExport = async () => {
    const data = await getAllChequesForExportAction();

    if (!data || data.length === 0) {
      throw new Error("No hay cheques registrados para exportar.");
    }

    ChequesExcelService.exportChequesToExcel(data, "cheques");
  };

  return <ExportButton onClick={handleExport} label="Exportar" />;
}
