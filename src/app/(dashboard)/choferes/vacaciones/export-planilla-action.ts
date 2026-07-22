"use server";

import { requireSeccion } from "@/lib/auth";
import {
  buildMultiSheetWorkbook,
  type ProColumn,
  type CellValue,
  type ProSection,
} from "@/lib/excel/professional-sheet";
import type { VacacionesSaldoChofer } from "./lib";

// Arma el Excel "formato planilla": las 3 hojas del VACACIONES_FINAL que usa
// Bárbara (resumen con semáforo, por sector y urgentes), con los datos vivos
// del sistema y el estilo profesional. Es para poder seguir compartiendo la
// planilla de siempre aunque la fuente de verdad ya sea el sistema.

type SheetSpec = Parameters<typeof buildMultiSheetWorkbook>[0][number];

function fechaCell(iso: string | null): Date | null {
  return iso ? new Date(`${iso.slice(0, 10)}T12:00:00`) : null;
}

export async function exportarPlanillaBarbaraAction(
  saldos: VacacionesSaldoChofer[],
  finPeriodoY: number,
  hoyISO: string,
): Promise<{ filename: string; base64: string }> {
  await requireSeccion("choferes_vacaciones", "read");

  const hoy = hoyISO.slice(0, 10).split("-").reverse().join("/");
  const anioPrev = finPeriodoY - 1;

  const columnas = (conSector: boolean): ProColumn[] => [
    { header: "", width: 4, align: "c" },
    { header: "EMPLEADO", width: 26, align: "l" },
    ...(conSector ? ([{ header: "SECTOR", width: 10, align: "c" }] as ProColumn[]) : []),
    { header: "INGRESO", width: 12, align: "c", numFmt: "dd/mm/yyyy" },
    { header: `AÑOS 31/12/${String(finPeriodoY).slice(2)}`, width: 10, align: "c", numFmt: "#,##0" },
    { header: "HITO ANTIGÜEDAD", width: 15, align: "c" },
    { header: `SALDO ${anioPrev}`, width: 11, align: "c", numFmt: "#,##0" },
    { header: `DÍAS ${finPeriodoY}`, width: 11, align: "c", numFmt: "#,##0" },
    { header: "TOTAL A OTORGAR", width: 12, align: "c", numFmt: "#,##0" },
    { header: "DISPONIBLES HOY", width: 12, align: "c", numFmt: "#,##0" },
    { header: `VENCE ${anioPrev}`, width: 12, align: "c" },
    { header: `VENCE ${finPeriodoY}`, width: 12, align: "c" },
    { header: "PRÓXIMO HITO", width: 19, align: "l" },
  ];

  const fila = (s: VacacionesSaldoChofer, conSector: boolean): CellValue[] => [
    s.semaforo,
    `${s.apellido}, ${s.nombre}`,
    ...(conSector ? [s.sector] : []),
    fechaCell(s.fecha_ingreso),
    s.anios,
    s.hito === "—" ? "" : s.hito,
    s.adeudados,
    s.corresponden,
    s.adeudados + s.corresponden,
    s.disponibles,
    s.adeudados > 0 ? `31/12/${finPeriodoY}` : "—",
    s.vence_periodo,
    s.proximo_hito,
  ];

  const ordenados = [...saldos].sort(
    (a, b) => b.adeudados + b.corresponden - (a.adeudados + a.corresponden) || a.apellido.localeCompare(b.apellido),
  );

  const sheets: SheetSpec[] = [];

  // ── Hoja 1: resumen general (ordenado por total a otorgar) ─────────────────
  sheets.push({
    name: `VACACIONES ${anioPrev}-${finPeriodoY}`,
    opts: {
      title: `CRONOGRAMA DE VACACIONES — Saldo ${anioPrev} y Período ${finPeriodoY}`,
      subtitle: `Días ${anioPrev} = saldo pendiente (vence 31/12/${finPeriodoY}) · Días ${finPeriodoY} = por antigüedad al 31/12 · ★ = hito de antigüedad · 🔴 urgente / 🟠 mucho acumulado / 🟡 atención / 🟢 ok`,
      fuente: `Generado por el sistema el ${hoy} — los saldos descuentan automáticamente los períodos cargados`,
      columns: columnas(true),
      rows: ordenados.map((s) => fila(s, true)),
    },
  });

  // ── Hoja 2: por sector (Choferes / Oficina / Taller) ───────────────────────
  const sectores = ["Chofer", "Oficina", "Taller"] as const;
  const sections: ProSection[] = sectores
    .map((sec) => ({
      label: sec === "Chofer" ? "CHOFERES" : sec.toUpperCase(),
      rows: ordenados.filter((s) => s.sector === sec).map((s) => fila(s, false)),
    }))
    .filter((x) => x.rows.length > 0);
  sheets.push({
    name: "POR SECTOR",
    opts: {
      title: `VACACIONES POR SECTOR — Saldo ${anioPrev} y Período ${finPeriodoY}`,
      subtitle: `Exportado el ${hoy}`,
      columns: columnas(false),
      sections,
    },
  });

  // ── Hoja 3: urgentes (con saldo viejo por vencer) ──────────────────────────
  const urgentes = ordenados.filter((s) => s.adeudados > 0).sort((a, b) => b.adeudados - a.adeudados);
  sheets.push({
    name: "URGENTES",
    opts: {
      title: `EMPLEADOS CON SALDO ${anioPrev} PENDIENTE — Vencen el 31/12/${finPeriodoY}`,
      subtitle: `${urgentes.length} empleado(s) · ${urgentes.reduce((a, s) => a + s.adeudados, 0)} días en riesgo · exportado el ${hoy}`,
      columns: columnas(true),
      rows: urgentes.map((s) => fila(s, true)),
    },
  });

  const buf = await buildMultiSheetWorkbook(sheets);
  return {
    filename: `VACACIONES_FINAL-${hoyISO.slice(0, 10)}.xlsx`,
    base64: buf.toString("base64"),
  };
}
