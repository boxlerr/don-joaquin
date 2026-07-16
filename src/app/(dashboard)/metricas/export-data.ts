import "server-only";

// Arma las planillas de gestión del mes (las del padre) desde los datos
// cargados, en una estructura neutra que consumen el export a Excel y la vista
// imprimible (PDF). Replica el formato del cliente: cada planilla se separa en
// BLOQUES por flota (Escalables 35 / Escalables 37 / Tolvas), y cada bloque
// lleva su fila TOTAL y su PROMEDIO POR CAMIÓN, igual que los Excel originales.

import type { MetricasData, MetricaChofer } from "./actions";

export type PlanillaCol = { header: string; width: number; align: "l" | "r"; money?: boolean; dec?: number };
export type Fila = (string | number | null)[];
export type PlanillaSeccion = { label: string; rows: Fila[]; subtotals?: Fila[] };
export type Planilla = {
  id: string;
  titulo: string;
  fuente?: string;
  columnas: PlanillaCol[];
  /** Formato plano (sin bloques) — lo usa la planilla de costos. */
  filas?: Fila[];
  totales?: Fila;
  /** Formato por bloques de flota (lo normal). */
  secciones?: PlanillaSeccion[];
};

export const PLANILLA_IDS = ["sueldo", "factkm", "costo", "vacios", "km100", "toneladas"] as const;
export type PlanillaId = (typeof PLANILLA_IDS)[number];

const FUENTE = "Fuente: Sistema de gestión Don Joaquín — datos verificados contra las planillas del Drive.";

// ── helpers ──────────────────────────────────────────────────────────────
const sum = (chs: MetricaChofer[], f: (c: MetricaChofer) => number) => chs.reduce((s, c) => s + (f(c) || 0), 0);
const avg = (chs: MetricaChofer[], f: (c: MetricaChofer) => number) => (chs.length ? sum(chs, f) / chs.length : 0);
const ratio = (num: number, den: number) => (den > 0 ? num / den : 0);
const pctFact = (c: MetricaChofer) => (c.facturacion > 0 ? (c.sueldoTotal / c.facturacion) * 100 : 0);

// Bloques por flota, en el orden de las planillas del cliente. `porTipo` separa
// los escalables en 35 / 37 (solo TONELADAS lo hace así; el resto usa un único
// bloque "Escalables", como en los PDF originales).
function bloquesPorFlota(ch: MetricaChofer[], porTipo: boolean): { label: string; choferes: MetricaChofer[] }[] {
  const defs: { label: string; test: (c: MetricaChofer) => boolean }[] = porTipo
    ? [
        { label: "Escalables 35", test: (c) => c.flota === "escalables" && c.escalTipo === 35 },
        { label: "Escalables 37", test: (c) => c.flota === "escalables" && c.escalTipo === 37 },
        { label: "Escalables", test: (c) => c.flota === "escalables" && !c.escalTipo },
        { label: "Tolvas", test: (c) => c.flota === "tolvas" },
      ]
    : [
        { label: "Escalables", test: (c) => c.flota === "escalables" },
        { label: "Tolvas", test: (c) => c.flota === "tolvas" },
      ];
  return defs
    .map((d) => ({ label: d.label, choferes: ch.filter(d.test) }))
    .filter((b) => b.choferes.length > 0);
}

/** Arma las secciones (una por bloque) para una planilla dada. */
function secciones(
  ch: MetricaChofer[],
  sortFn: (a: MetricaChofer, b: MetricaChofer) => number,
  rowOf: (c: MetricaChofer) => Fila,
  resumen: (chs: MetricaChofer[]) => Fila[],
  porTipo = false,
): PlanillaSeccion[] {
  return bloquesPorFlota(ch, porTipo).map((b) => ({
    label: b.label,
    rows: [...b.choferes].sort(sortFn).map(rowOf),
    subtotals: resumen(b.choferes),
  }));
}

export function armarPlanillas(data: MetricasData, cuales: PlanillaId[]): Planilla[] {
  const out: Planilla[] = [];
  const ch = data.choferes;

  if (cuales.includes("sueldo")) {
    // Tabla principal: facturación → sueldo, ordenada por % s/fact (como el cliente).
    out.push({
      id: "sueldo",
      titulo: "Sueldo sobre facturación",
      fuente: FUENTE,
      columnas: [
        { header: "Chofer", width: 24, align: "l" },
        { header: "Facturación", width: 16, align: "r", money: true },
        { header: "Sueldo total", width: 15, align: "r", money: true },
        { header: "Sueldo neto", width: 15, align: "r", money: true },
        { header: "% s/fact", width: 10, align: "r", dec: 2 },
      ],
      secciones: secciones(
        ch,
        (a, b) => pctFact(b) - pctFact(a),
        (c) => [c.nombre, c.facturacion, c.sueldoTotal, c.sueldoNeto, pctFact(c)],
        (chs) => [
          ["TOTAL", sum(chs, (c) => c.facturacion), sum(chs, (c) => c.sueldoTotal), sum(chs, (c) => c.sueldoNeto),
            ratio(sum(chs, (c) => c.sueldoTotal), sum(chs, (c) => c.facturacion)) * 100],
          ["PROMEDIO POR CAMIÓN", avg(chs, (c) => c.facturacion), avg(chs, (c) => c.sueldoTotal), avg(chs, (c) => c.sueldoNeto),
            avg(chs, pctFact)],
        ],
      ),
    });
    // Página de retenciones (aparte, como el PDF), ordenada alfabéticamente.
    out.push({
      id: "sueldo-ret",
      titulo: "Sueldo — retenciones y neto",
      fuente: FUENTE,
      columnas: [
        { header: "Chofer", width: 24, align: "l" },
        { header: "Retenciones", width: 13, align: "r", money: true },
        { header: "Adelantos", width: 13, align: "r", money: true },
        { header: "Devol. prést.", width: 13, align: "r", money: true },
        { header: "Embargo jud.", width: 13, align: "r", money: true },
        { header: "Aguinaldo", width: 13, align: "r", money: true },
        { header: "Neto", width: 15, align: "r", money: true },
        { header: "Total", width: 15, align: "r", money: true },
        { header: "KM al 100", width: 11, align: "r" },
      ],
      secciones: secciones(
        ch,
        (a, b) => a.nombre.localeCompare(b.nombre),
        (c) => [c.nombre, c.retenciones, c.adelantos, c.devolPrestamo, c.embargoJudicial, c.aguinaldo, c.sueldoNeto, c.sueldoTotal, c.km100],
        (chs) => [
          ["TOTAL", sum(chs, (c) => c.retenciones ?? 0), sum(chs, (c) => c.adelantos ?? 0), sum(chs, (c) => c.devolPrestamo ?? 0),
            sum(chs, (c) => c.embargoJudicial ?? 0), sum(chs, (c) => c.aguinaldo ?? 0), sum(chs, (c) => c.sueldoNeto), sum(chs, (c) => c.sueldoTotal), sum(chs, (c) => c.km100)],
          ["PROMEDIO POR CAMIÓN", avg(chs, (c) => c.retenciones ?? 0), avg(chs, (c) => c.adelantos ?? 0), avg(chs, (c) => c.devolPrestamo ?? 0),
            avg(chs, (c) => c.embargoJudicial ?? 0), avg(chs, (c) => c.aguinaldo ?? 0), avg(chs, (c) => c.sueldoNeto), avg(chs, (c) => c.sueldoTotal), avg(chs, (c) => c.km100)],
        ],
      ),
    });
  }

  if (cuales.includes("factkm")) {
    out.push({
      id: "factkm",
      titulo: "Facturación por km",
      fuente: FUENTE,
      columnas: [
        { header: "Chofer", width: 24, align: "l" },
        { header: "KM", width: 11, align: "r" },
        { header: "Facturación", width: 16, align: "r", money: true },
        { header: "$/km", width: 11, align: "r", money: true, dec: 2 },
      ],
      secciones: secciones(
        ch,
        (a, b) => ratio(b.facturacion, b.km) - ratio(a.facturacion, a.km),
        (c) => [c.nombre, c.km, c.facturacion, ratio(c.facturacion, c.km)],
        (chs) => [
          ["TOTAL", sum(chs, (c) => c.km), sum(chs, (c) => c.facturacion), ratio(sum(chs, (c) => c.facturacion), sum(chs, (c) => c.km))],
          ["PROMEDIO POR CAMIÓN", avg(chs, (c) => c.km), avg(chs, (c) => c.facturacion), avg(chs, (c) => ratio(c.facturacion, c.km))],
        ],
      ),
    });
  }

  if (cuales.includes("costo")) {
    // Serie mensual (no es por chofer): se deja plana.
    out.push({
      id: "costo",
      titulo: "Facturación vs costo por km (estudio)",
      fuente: FUENTE,
      columnas: [
        { header: "Mes", width: 14, align: "l" },
        { header: "Facturación $/km", width: 16, align: "r", money: true, dec: 2 },
        { header: "Costo estudio $/km", width: 17, align: "r", money: true, dec: 2 },
        { header: "Prom. km", width: 12, align: "r" },
      ],
      filas: data.serieCosto.map((r) => [r.mes.slice(0, 7), r.factKm, r.costoKm, r.promKm]),
    });
  }

  if (cuales.includes("vacios")) {
    out.push({
      id: "vacios",
      titulo: "KM vacíos",
      fuente: FUENTE,
      columnas: [
        { header: "Chofer", width: 24, align: "l" },
        { header: "KM", width: 11, align: "r" },
        { header: "KM vacíos", width: 12, align: "r" },
        { header: "% vacíos", width: 10, align: "r", dec: 2 },
      ],
      secciones: secciones(
        ch,
        (a, b) => ratio(a.kmVacios, a.km) - ratio(b.kmVacios, b.km),
        (c) => [c.nombre, c.km, c.kmVacios, ratio(c.kmVacios, c.km) * 100],
        (chs) => [
          ["TOTAL", sum(chs, (c) => c.km), sum(chs, (c) => c.kmVacios), ratio(sum(chs, (c) => c.kmVacios), sum(chs, (c) => c.km)) * 100],
          ["PROMEDIO POR CAMIÓN", avg(chs, (c) => c.km), avg(chs, (c) => c.kmVacios), avg(chs, (c) => ratio(c.kmVacios, c.km) * 100)],
        ],
      ),
    });
  }

  if (cuales.includes("km100")) {
    out.push({
      id: "km100",
      titulo: "KM al 100%",
      fuente: FUENTE,
      columnas: [
        { header: "Chofer", width: 24, align: "l" },
        { header: "KM", width: 11, align: "r" },
        { header: "KM al 100", width: 12, align: "r" },
        { header: "% al 100", width: 10, align: "r", dec: 2 },
      ],
      secciones: secciones(
        ch,
        (a, b) => ratio(b.km100, b.km) - ratio(a.km100, a.km),
        (c) => [c.nombre, c.km, c.km100, ratio(c.km100, c.km) * 100],
        (chs) => [
          ["TOTAL", sum(chs, (c) => c.km), sum(chs, (c) => c.km100), ratio(sum(chs, (c) => c.km100), sum(chs, (c) => c.km)) * 100],
          ["PROMEDIO POR CAMIÓN", avg(chs, (c) => c.km), avg(chs, (c) => c.km100), avg(chs, (c) => ratio(c.km100, c.km) * 100)],
        ],
      ),
    });
  }

  if (cuales.includes("toneladas")) {
    const conTon = ch.filter((c) => c.toneladas > 0);
    out.push({
      id: "toneladas",
      titulo: "Toneladas promedio",
      fuente: FUENTE,
      columnas: [
        { header: "Chofer", width: 24, align: "l" },
        { header: "KM", width: 11, align: "r" },
        { header: "Ton. promedio", width: 14, align: "r", dec: 2 },
      ],
      secciones: secciones(
        conTon,
        (a, b) => b.toneladas - a.toneladas,
        (c) => [c.nombre, c.km, c.toneladas],
        (chs) => [
          ["TOTAL", sum(chs, (c) => c.km), null],
          ["PROMEDIO POR CAMIÓN", avg(chs, (c) => c.km), avg(chs, (c) => c.toneladas)],
        ],
        true, // toneladas separa escalables en 35 / 37
      ),
    });
  }

  return out;
}

export function parsearPlanillasParam(param: string | null): PlanillaId[] {
  if (!param || param === "todas") return [...PLANILLA_IDS];
  return param.split(",").filter((p): p is PlanillaId => (PLANILLA_IDS as readonly string[]).includes(p));
}
