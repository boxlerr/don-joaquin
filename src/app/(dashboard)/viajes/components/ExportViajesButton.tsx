"use client";

import ExportButton from "@/components/ExportButton";
import { descargarXlsxBase64 } from "@/lib/excel/download-client";
import { getAllViajesForExportAction } from "../actions";
import { exportarViajesXlsxAction } from "../export-action";

interface ExportViajesButtonProps {
  choferId?: string;
  desde?: string;
  hasta?: string;
  estado?: string;
  facturado?: boolean;
  esVacio?: boolean;
  search?: string;
  disabled?: boolean;
}

export default function ExportViajesButton({
  choferId,
  desde,
  hasta,
  estado,
  facturado,
  esVacio,
  search,
  disabled,
}: ExportViajesButtonProps) {
  const hayFiltros = !!(
    desde || hasta || estado || search || typeof facturado === "boolean" || typeof esVacio === "boolean"
  );

  const handleExport = async () => {
    const data = await getAllViajesForExportAction({
      choferId,
      desde,
      hasta,
      estado,
      facturado,
      esVacio,
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

    const { filename: nombre, base64 } = await exportarViajesXlsxAction(data, filename);
    descargarXlsxBase64(nombre, base64);
  };

  return (
    <ExportButton
      onClick={handleExport}
      disabled={disabled}
      label={hayFiltros ? "Exportar filtro" : "Exportar"}
    />
  );
}
