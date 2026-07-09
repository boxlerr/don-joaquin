import type { VacacionesSaldoChofer, VacacionesPeriodo } from "./lib";
import { exportarVacacionesXlsxAction } from "./export-action";

type Semana = { start: string; end: string; label: string };

/**
 * Exporta saldos + períodos + cronograma a un .xlsx descargable.
 * El armado del archivo (con el estilo profesional del sistema) corre en el
 * server (`export-action.ts`); acá sólo se dispara la descarga en el navegador.
 */
export async function exportarVacacionesXlsx(
  saldos: VacacionesSaldoChofer[],
  periodos: VacacionesPeriodo[],
  semanas: Semana[],
  finPeriodoY: number,
  hoyISO: string,
) {
  try {
    const { filename, base64 } = await exportarVacacionesXlsxAction(
      saldos,
      periodos,
      semanas,
      finPeriodoY,
      hoyISO,
    );
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
    alert("No se pudo generar el Excel de vacaciones.");
  }
}
