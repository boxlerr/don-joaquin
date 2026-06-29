"use client";

import * as XLSX from "xlsx";
import ExportButton from "@/components/ExportButton";
import { getCargasParaExportAction } from "../actions";

/**
 * Exporta a Excel las cargas de combustible del período seleccionado
 * (mismo filtro de mes que el resto de la página).
 */
export default function ExportCombustibleButton({ month }: { month?: string }) {
  const handleExport = async () => {
    const data = await getCargasParaExportAction(month);
    if (!data || data.length === 0) {
      throw new Error("No hay cargas para exportar en este período.");
    }

    const rows = data.map((c) => ({
      Fecha: new Date(c.fecha).toLocaleDateString("es-AR"),
      Patente: c.patente,
      "Marca/Modelo": c.marca_modelo,
      Chofer: c.chofer,
      "Tipo de carga": c.lugar_carga,
      Estación: c.estacion,
      "Tipo de combustible": c.tipo,
      "KM odómetro": c.km_odometro,
      Litros: c.litros,
      "Importe ($)": c.importe_total,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 12 }, { wch: 12 }, { wch: 22 }, { wch: 24 }, { wch: 16 },
      { wch: 18 }, { wch: 20 }, { wch: 14 }, { wch: 12 }, { wch: 14 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Combustible");
    XLSX.writeFile(wb, `combustible_${month || "mes-actual"}.xlsx`);
  };

  return <ExportButton onClick={handleExport} label="Exportar" />;
}
