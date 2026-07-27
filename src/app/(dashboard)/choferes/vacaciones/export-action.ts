"use server";

import { requireSeccion } from "@/lib/auth";
import {
  buildMultiSheetWorkbook,
  type ProColumn,
  type CellValue,
} from "@/lib/excel/professional-sheet";
import type { VacacionesSaldoChofer, VacacionesPeriodo } from "./lib";

// Arma el Excel de vacaciones (saldos + períodos + cronograma) con el estilo
// profesional del sistema y lo devuelve en base64 para que el cliente dispare
// la descarga. Recibe los datos ya filtrados desde la vista.

type SheetSpec = Parameters<typeof buildMultiSheetWorkbook>[0][number];
type Semana = { start: string; end: string; label: string };

function semaforoTexto(s: string): string {
  if (s === "🔴") return "Urgente";
  if (s === "🟠") return "Mucho acumulado";
  if (s === "🟡") return "Atención";
  return "OK";
}

// Mediodía para esquivar corrimientos de zona horaria al formatear la fecha.
function fechaCell(iso: string | null): Date | null {
  return iso ? new Date(`${iso.slice(0, 10)}T12:00:00`) : null;
}

export async function exportarVacacionesXlsxAction(
  saldos: VacacionesSaldoChofer[],
  periodos: VacacionesPeriodo[],
  semanas: Semana[],
  finPeriodoY: number,
  hoyISO: string,
): Promise<{ filename: string; base64: string }> {
  await requireSeccion("choferes_vacaciones", "read");

  const hoy = hoyISO.slice(0, 10).split("-").reverse().join("/");
  const sheets: SheetSpec[] = [];

  // ── Hoja 1: Saldos ─────────────────────────────────────────────────────────
  {
    const columns: ProColumn[] = [
      { header: "Sector", width: 14, align: "l" },
      { header: "Empleado", width: 26, align: "l" },
      { header: "Ingreso", width: 12, align: "c", numFmt: "dd/mm/yyyy" },
      { header: "Años", width: 8, align: "c", numFmt: "#,##0" },
      { header: "Hito", width: 14, align: "c" },
      { header: `Saldo ${finPeriodoY - 1}`, width: 11, align: "c", numFmt: "#,##0" },
      { header: `Días ${finPeriodoY}`, width: 11, align: "c", numFmt: "#,##0" },
      { header: "Total", width: 9, align: "c", numFmt: "#,##0" },
      // Ojo: "Tomados" cuenta por FECHA (lo que salió este año) y "Disponibles"
      // es el saldo que queda por año. Total − Tomados NO da Disponibles cuando
      // alguien se tomó este año días imputados al año anterior; los nombres lo
      // dicen para que nadie haga esa resta.
      { header: `Tomados en ${finPeriodoY}`, width: 14, align: "c", numFmt: "#,##0" },
      { header: "Disponibles (saldo)", width: 17, align: "c", numFmt: "#,##0" },
      { header: "Vencidos", width: 10, align: "c", numFmt: "#,##0" },
      { header: "Vence saldo", width: 12, align: "c" },
      { header: "Vence período", width: 13, align: "c" },
      { header: "Próximo hito", width: 18, align: "l" },
      { header: "Estado", width: 16, align: "c" },
      { header: "Detalle por año", width: 40, align: "l" },
    ];
    const rows: CellValue[][] = saldos.map((s) => [
      s.sector,
      `${s.apellido}, ${s.nombre}`,
      fechaCell(s.fecha_ingreso),
      s.anios,
      s.hito.replace("★ ", ""),
      s.adeudados,
      s.corresponden,
      s.total,
      s.tomados,
      s.disponibles,
      s.dias_vencidos,
      s.vence_saldo ?? "—",
      s.vence_periodo,
      s.proximo_hito,
      semaforoTexto(s.semaforo),
      s.saldos_anio
        .map((a) => `${a.anio}: ${a.saldo} de ${a.otorgados}${a.usados > 0 ? ` (usados ${a.usados})` : ""}`)
        .join(" · ") || "—",
    ]);
    sheets.push({
      name: "Saldos",
      opts: {
        title: "Vacaciones — Saldos por empleado",
        subtitle: `${saldos.length} empleado(s) · exportado el ${hoy}`,
        columns,
        rows,
      },
    });
  }

  // ── Hoja 2: Períodos ───────────────────────────────────────────────────────
  {
    const columns: ProColumn[] = [
      { header: "Empleado", width: 26, align: "l" },
      { header: "Desde", width: 12, align: "c", numFmt: "dd/mm/yyyy" },
      { header: "Hasta", width: 12, align: "c", numFmt: "dd/mm/yyyy" },
      { header: "Días", width: 8, align: "c", numFmt: "#,##0" },
      { header: "Descuenta de", width: 13, align: "c" },
      { header: "Estado", width: 12, align: "c" },
      { header: "Observaciones", width: 36, align: "l" },
    ];
    const ordenados = [...periodos].sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio));
    const rows: CellValue[][] = ordenados.map((p) => [
      `${p.apellido}, ${p.nombre}`,
      fechaCell(p.fecha_inicio),
      fechaCell(p.fecha_fin),
      p.dias,
      p.anio_cargo != null ? String(p.anio_cargo) : "Histórico",
      p.estado,
      p.observaciones ?? null,
    ]);
    sheets.push({
      name: "Períodos",
      opts: {
        title: "Vacaciones — Períodos cargados",
        subtitle: `${ordenados.length} período(s) · exportado el ${hoy}`,
        columns,
        rows,
      },
    });
  }

  // ── Hoja 3: Cronograma (matriz empleado × semana de la ventana visible) ────
  if (semanas.length > 0) {
    const enVentana = periodos.filter(
      (p) => p.fecha_inicio <= semanas[semanas.length - 1]!.end && p.fecha_fin >= semanas[0]!.start,
    );
    const ids = [...new Set(enVentana.map((p) => p.chofer_id))]
      .map((id) => enVentana.find((p) => p.chofer_id === id)!)
      .sort((a, b) => a.apellido.localeCompare(b.apellido));
    const columns: ProColumn[] = [
      { header: "Empleado", width: 26, align: "l" },
      ...semanas.map((s): ProColumn => ({ header: s.label, width: 11, align: "c" })),
    ];
    const rows: CellValue[][] = ids.map((info) => {
      const ps = enVentana.filter((p) => p.chofer_id === info.chofer_id);
      return [
        `${info.apellido}, ${info.nombre}`,
        ...semanas.map((sem) =>
          ps.some((p) => p.fecha_inicio <= sem.end && p.fecha_fin >= sem.start) ? "X" : null,
        ),
      ];
    });
    sheets.push({
      name: "Cronograma",
      opts: {
        title: "Vacaciones — Cronograma por semana",
        // Con fecha completa: la ventana del cronograma ya puede ser un mes
        // pasado, y "del 20 jul al 27 sep" sin año no dice de cuándo es.
        subtitle: `Semanas del ${semanas[0]!.start} al ${semanas[semanas.length - 1]!.end}`,
        columns,
        rows,
      },
    });
  }

  const buf = await buildMultiSheetWorkbook(sheets);
  return {
    filename: `vacaciones-${hoyISO}.xlsx`,
    base64: buf.toString("base64"),
  };
}
