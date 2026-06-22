import * as XLSX from "xlsx";
import type { VacacionesSaldoChofer, VacacionesPeriodo } from "./lib";

type Semana = { start: string; end: string; label: string };

function semaforoTexto(s: string): string {
  if (s === "🔴") return "Urgente";
  if (s === "🟠") return "Mucho acumulado";
  if (s === "🟡") return "Atención";
  return "OK";
}

/** Exporta saldos + períodos + cronograma a un .xlsx descargable. */
export function exportarVacacionesXlsx(
  saldos: VacacionesSaldoChofer[],
  periodos: VacacionesPeriodo[],
  semanas: Semana[],
  finPeriodoY: number,
  hoyISO: string,
) {
  const wb = XLSX.utils.book_new();

  // --- Hoja 1: Saldos ---
  const saldosAoA: (string | number)[][] = [
    [
      "Sector", "Empleado", "Ingreso", "Años", "Hito",
      `Saldo ${finPeriodoY - 1}`, `Días ${finPeriodoY}`, "Total", "Tomados", "Disponibles",
      "Vence saldo", "Próximo hito", "Estado",
    ],
  ];
  for (const s of saldos) {
    saldosAoA.push([
      s.sector,
      `${s.apellido}, ${s.nombre}`,
      s.fecha_ingreso ?? "—",
      s.anios,
      s.hito.replace("★ ", ""),
      s.adeudados,
      s.corresponden,
      s.total,
      s.tomados,
      s.disponibles,
      s.vence_saldo ?? "—",
      s.proximo_hito,
      semaforoTexto(s.semaforo),
    ]);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(saldosAoA), "Saldos");

  // --- Hoja 2: Períodos ---
  const periodosAoA: (string | number)[][] = [
    ["Empleado", "Desde", "Hasta", "Días", "Estado", "Observaciones"],
  ];
  for (const p of [...periodos].sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio))) {
    periodosAoA.push([
      `${p.apellido}, ${p.nombre}`,
      p.fecha_inicio,
      p.fecha_fin,
      p.dias,
      p.estado,
      p.observaciones ?? "",
    ]);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(periodosAoA), "Períodos");

  // --- Hoja 3: Cronograma (matriz empleado × semana de la ventana visible) ---
  const enVentana = periodos.filter(
    (p) => p.fecha_inicio <= semanas[semanas.length - 1]!.end && p.fecha_fin >= semanas[0]!.start,
  );
  const ids = [...new Set(enVentana.map((p) => p.chofer_id))]
    .map((id) => enVentana.find((p) => p.chofer_id === id)!)
    .sort((a, b) => a.apellido.localeCompare(b.apellido));
  const cronoAoA: (string | number)[][] = [["Empleado", ...semanas.map((s) => s.label)]];
  for (const info of ids) {
    const ps = enVentana.filter((p) => p.chofer_id === info.chofer_id);
    const fila: (string | number)[] = [`${info.apellido}, ${info.nombre}`];
    for (const sem of semanas) {
      const cubre = ps.some((p) => p.fecha_inicio <= sem.end && p.fecha_fin >= sem.start);
      fila.push(cubre ? "X" : "");
    }
    cronoAoA.push(fila);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cronoAoA), "Cronograma");

  XLSX.writeFile(wb, `vacaciones-${hoyISO}.xlsx`);
}
