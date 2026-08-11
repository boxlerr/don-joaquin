import type { OrganismoChecklistRow } from "../types";
import { exportarOrganismoXlsxAction } from "./export-action";

/**
 * Descarga el checklist del organismo en .xlsx. El armado del archivo corre en
 * el server (`export-action.ts`); acá sólo se dispara la descarga.
 */
export async function exportarOrganismoXlsx(
  nombreOrganismo: string,
  rows: OrganismoChecklistRow[],
) {
  try {
    // Fecha local del navegador (sv-SE da yyyy-mm-dd) para nombre y subtítulo.
    const hoyISO = new Date().toLocaleDateString("sv-SE");
    const { filename, base64 } = await exportarOrganismoXlsxAction(nombreOrganismo, rows, hoyISO);
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
    alert("No se pudo generar el Excel del checklist.");
  }
}
