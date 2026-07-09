"use client";

import ExportButton from "@/components/ExportButton";
import { descargarXlsxBase64 } from "@/lib/excel/download-client";
import { getAllChequesForExportAction } from "../actions";
import { exportarChequesXlsxAction } from "../export-action";

export default function ExportChequesButton() {
  const handleExport = async () => {
    const data = await getAllChequesForExportAction();

    if (!data || data.length === 0) {
      throw new Error("No hay cheques registrados para exportar.");
    }

    const { filename, base64 } = await exportarChequesXlsxAction(data, "cheques");
    descargarXlsxBase64(filename, base64);
  };

  return <ExportButton onClick={handleExport} label="Exportar" />;
}
