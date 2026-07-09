import type { ComplianceEstadoRow } from "./types";
import { exportarComplianceChecklistXlsxAction } from "./export-action";

/**
 * Exporta el checklist de compliance (las filas visibles, en el orden del
 * tablero) a un .xlsx descargable. El armado del archivo (con el estilo
 * profesional del sistema) corre en el server (`export-action.ts`); acá sólo
 * se dispara la descarga en el navegador.
 */
export async function exportarComplianceChecklistXlsx(
  titulo: string,
  rows: ComplianceEstadoRow[],
) {
  try {
    // Fecha local del navegador (sv-SE da yyyy-mm-dd) para nombre y subtítulo.
    const hoyISO = new Date().toLocaleDateString("sv-SE");
    const { filename, base64 } = await exportarComplianceChecklistXlsxAction(titulo, rows, hoyISO);
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error(err);
    alert("No se pudo generar el Excel del checklist de compliance.");
  }
}
