import "server-only";

// Arma las 6 planillas de gestión del mes (las del padre) desde los datos
// cargados, en una estructura neutra que consumen el export a Excel y la
// vista imprimible (PDF). Una planilla = título + columnas + filas + totales.

import type { MetricasData, MetricaChofer } from "./actions";

export type PlanillaCol = { header: string; width: number; align: "l" | "r"; money?: boolean; dec?: number };
export type Planilla = {
  id: string;
  titulo: string;
  columnas: PlanillaCol[];
  filas: (string | number | null)[][];
  totales: (string | number | null)[];
};

export const PLANILLA_IDS = ["sueldo", "factkm", "costo", "vacios", "km100", "toneladas"] as const;
export type PlanillaId = (typeof PLANILLA_IDS)[number];

const flotaLabel = (c: MetricaChofer) =>
  c.flota === "tolvas" ? "Tolvas" : c.escalTipo ? `Escalables ${c.escalTipo}` : "Escalables";

export function armarPlanillas(data: MetricasData, cuales: PlanillaId[]): Planilla[] {
  const out: Planilla[] = [];
  const ch = data.choferes;
  const sum = (f: (c: MetricaChofer) => number) => ch.reduce((s, c) => s + f(c), 0);

  if (cuales.includes("sueldo")) {
    const filas = [...ch]
      .sort((a, b) => (b.facturacion > 0 ? b.sueldoTotal / b.facturacion : 0) - (a.facturacion > 0 ? a.sueldoTotal / a.facturacion : 0))
      .map((c) => [
        c.nombre, flotaLabel(c), c.facturacion, c.sueldoTotal, c.sueldoNeto,
        c.facturacion > 0 ? (c.sueldoTotal / c.facturacion) * 100 : null,
        c.retenciones, c.adelantos, c.devolPrestamo, c.embargoJudicial, c.aguinaldo,
      ]);
    out.push({
      id: "sueldo",
      titulo: "Sueldo sobre facturación",
      columnas: [
        { header: "Chofer", width: 24, align: "l" }, { header: "Flota", width: 14, align: "l" },
        { header: "Facturación", width: 16, align: "r", money: true }, { header: "Sueldo total", width: 15, align: "r", money: true },
        { header: "Sueldo neto", width: 15, align: "r", money: true }, { header: "% s/fact", width: 10, align: "r", dec: 2 },
        { header: "Retenciones", width: 13, align: "r", money: true }, { header: "Adelantos", width: 13, align: "r", money: true },
        { header: "Devol. prést.", width: 13, align: "r", money: true }, { header: "Embargo jud.", width: 13, align: "r", money: true },
        { header: "Aguinaldo", width: 13, align: "r", money: true },
      ],
      filas,
      totales: [
        "TOTALES", "", sum((c) => c.facturacion), sum((c) => c.sueldoTotal), sum((c) => c.sueldoNeto),
        sum((c) => c.facturacion) > 0 ? (sum((c) => c.sueldoTotal) / sum((c) => c.facturacion)) * 100 : null,
        sum((c) => c.retenciones ?? 0), sum((c) => c.adelantos ?? 0), sum((c) => c.devolPrestamo ?? 0),
        sum((c) => c.embargoJudicial ?? 0), sum((c) => c.aguinaldo ?? 0),
      ],
    });
  }

  if (cuales.includes("factkm")) {
    const filas = [...ch]
      .sort((a, b) => (b.km > 0 ? b.facturacion / b.km : 0) - (a.km > 0 ? a.facturacion / a.km : 0))
      .map((c) => [c.nombre, flotaLabel(c), c.km, c.facturacion, c.km > 0 ? c.facturacion / c.km : null]);
    out.push({
      id: "factkm",
      titulo: "Facturación por km",
      columnas: [
        { header: "Chofer", width: 24, align: "l" }, { header: "Flota", width: 14, align: "l" },
        { header: "KM", width: 11, align: "r" }, { header: "Facturación", width: 16, align: "r", money: true },
        { header: "$/km", width: 11, align: "r", money: true, dec: 2 },
      ],
      filas,
      totales: ["TOTALES", "", sum((c) => c.km), sum((c) => c.facturacion), sum((c) => c.km) > 0 ? sum((c) => c.facturacion) / sum((c) => c.km) : null],
    });
  }

  if (cuales.includes("costo")) {
    out.push({
      id: "costo",
      titulo: "Facturación vs costo por km (estudio)",
      columnas: [
        { header: "Mes", width: 14, align: "l" }, { header: "Facturación $/km", width: 16, align: "r", money: true, dec: 2 },
        { header: "Costo estudio $/km", width: 17, align: "r", money: true, dec: 2 }, { header: "Prom. km", width: 12, align: "r" },
      ],
      filas: data.serieCosto.map((r) => [r.mes.slice(0, 7), r.factKm, r.costoKm, r.promKm]),
      totales: [],
    });
  }

  if (cuales.includes("vacios")) {
    const filas = [...ch]
      .sort((a, b) => (a.km > 0 ? a.kmVacios / a.km : 0) - (b.km > 0 ? b.kmVacios / b.km : 0))
      .map((c) => [c.nombre, flotaLabel(c), c.km, c.kmVacios, c.km > 0 ? (c.kmVacios / c.km) * 100 : null]);
    out.push({
      id: "vacios",
      titulo: "KM vacíos",
      columnas: [
        { header: "Chofer", width: 24, align: "l" }, { header: "Flota", width: 14, align: "l" },
        { header: "KM", width: 11, align: "r" }, { header: "KM vacíos", width: 12, align: "r" },
        { header: "% vacíos", width: 10, align: "r", dec: 2 },
      ],
      filas,
      totales: ["TOTALES", "", sum((c) => c.km), sum((c) => c.kmVacios), sum((c) => c.km) > 0 ? (sum((c) => c.kmVacios) / sum((c) => c.km)) * 100 : null],
    });
  }

  if (cuales.includes("km100")) {
    const filas = [...ch]
      .sort((a, b) => (b.km > 0 ? b.km100 / b.km : 0) - (a.km > 0 ? a.km100 / a.km : 0))
      .map((c) => [c.nombre, flotaLabel(c), c.km, c.km100, c.km > 0 ? (c.km100 / c.km) * 100 : null]);
    out.push({
      id: "km100",
      titulo: "KM al 100%",
      columnas: [
        { header: "Chofer", width: 24, align: "l" }, { header: "Flota", width: 14, align: "l" },
        { header: "KM", width: 11, align: "r" }, { header: "KM al 100", width: 12, align: "r" },
        { header: "% al 100", width: 10, align: "r", dec: 2 },
      ],
      filas,
      totales: ["TOTALES", "", sum((c) => c.km), sum((c) => c.km100), sum((c) => c.km) > 0 ? (sum((c) => c.km100) / sum((c) => c.km)) * 100 : null],
    });
  }

  if (cuales.includes("toneladas")) {
    const conTon = ch.filter((c) => c.toneladas > 0);
    const filas = [...conTon]
      .sort((a, b) => b.toneladas - a.toneladas)
      .map((c) => [c.nombre, flotaLabel(c), c.km, c.toneladas]);
    out.push({
      id: "toneladas",
      titulo: "Toneladas promedio",
      columnas: [
        { header: "Chofer", width: 24, align: "l" }, { header: "Flota", width: 14, align: "l" },
        { header: "KM", width: 11, align: "r" }, { header: "Ton. promedio", width: 14, align: "r", dec: 2 },
      ],
      filas,
      totales: ["PROMEDIO", "", null, conTon.length ? conTon.reduce((s, c) => s + c.toneladas, 0) / conTon.length : null],
    });
  }

  return out;
}

export function parsearPlanillasParam(param: string | null): PlanillaId[] {
  if (!param || param === "todas") return [...PLANILLA_IDS];
  return param.split(",").filter((p): p is PlanillaId => (PLANILLA_IDS as readonly string[]).includes(p));
}
