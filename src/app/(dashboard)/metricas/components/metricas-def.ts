// Definición central de las métricas del módulo: una sola fuente de verdad
// que alimenta KPIs, pestañas, tablas, gráficos y el drawer del chofer.

import type { LucideIcon } from "lucide-react";
import { TrendingUp, Route, Gauge, Truck, Percent, Weight, Wallet } from "lucide-react";
import type { MetricaChofer, TotalesMes, ChoferHistPunto } from "../actions";
import { money, numAr, pct, compactMoney } from "./format";

export type MetricaId = "factkm" | "vacios" | "km100" | "toneladas" | "sueldo";

export type MetricaDef = {
  id: MetricaId;
  /** Nombre de la pestaña. */
  tab: string;
  /** Título largo (encabezado del panel). */
  titulo: string;
  /** Qué mide y de qué planilla sale. */
  descripcion: string;
  icon: LucideIcon;
  /** true → menos es mejor (% vacíos, % sueldo). */
  mejorMenos: boolean;
  /** true → la variación se muestra en puntos porcentuales. */
  enPuntos: boolean;
  fmt: (n: number | null | undefined) => string;
  valorChofer: (c: MetricaChofer) => number | null;
  valorTotales: (t: TotalesMes | null | undefined) => number | null;
  valorHist: (p: ChoferHistPunto) => number | null;
  /** Sección viva del sistema de la que proviene / se cruza el dato. */
  fuente: { label: string; href: string };
};

export const METRICAS: MetricaDef[] = [
  {
    id: "factkm",
    tab: "Facturación por km",
    titulo: "Facturación por km",
    descripcion: "Cuánto factura cada km recorrido. Sale de la planilla FACTURACION POR KM (hojas de ruta del mes).",
    icon: Gauge,
    mejorMenos: false,
    enPuntos: false,
    fmt: (n) => money(n, 0),
    valorChofer: (c) => (c.km > 0 ? c.facturacion / c.km : null),
    valorTotales: (t) => t?.factPorKm ?? null,
    valorHist: (p) => (p.km > 0 ? p.facturacion / p.km : null),
    fuente: { label: "Viajes del mes", href: "/viajes" },
  },
  {
    id: "vacios",
    tab: "KM vacíos",
    titulo: "% de km vacíos",
    descripcion: "Kilómetros recorridos sin carga sobre el total. Menos es mejor. Sale de la planilla KM VACIOS.",
    icon: Truck,
    mejorMenos: true,
    enPuntos: true,
    fmt: (n) => pct(n),
    valorChofer: (c) => (c.km > 0 ? (c.kmVacios / c.km) * 100 : null),
    valorTotales: (t) => t?.pctVacios ?? null,
    valorHist: (p) => (p.km > 0 ? (p.kmVacios / p.km) * 100 : null),
    fuente: { label: "Viajes del mes", href: "/viajes" },
  },
  {
    id: "km100",
    tab: "KM al 100%",
    titulo: "% de km al 100% de carga",
    descripcion: "Kilómetros hechos con el camión a carga completa sobre el total. Sale de la planilla KM AL 100%.",
    icon: Percent,
    mejorMenos: false,
    enPuntos: true,
    fmt: (n) => pct(n),
    valorChofer: (c) => (c.km > 0 ? (c.km100 / c.km) * 100 : null),
    valorTotales: (t) => t?.pctKm100 ?? null,
    valorHist: (p) => (p.km > 0 ? (p.km100 / p.km) * 100 : null),
    fuente: { label: "Viajes del mes", href: "/viajes" },
  },
  {
    id: "toneladas",
    tab: "Toneladas",
    titulo: "Toneladas promedio por viaje",
    descripcion: "Promedio de toneladas transportadas por viaje. Sale de la planilla TONELADAS (grupos ESCAL 35/37 y tolvas).",
    icon: Weight,
    mejorMenos: false,
    enPuntos: false,
    fmt: (n) => numAr(n, 2),
    valorChofer: (c) => (c.toneladas > 0 ? c.toneladas : null),
    valorTotales: (t) => t?.toneladasProm ?? null,
    valorHist: (p) => (p.toneladas > 0 ? p.toneladas : null),
    fuente: { label: "Viajes del mes", href: "/viajes" },
  },
  {
    id: "sueldo",
    tab: "Sueldo s/ facturación",
    titulo: "% de sueldo sobre facturación",
    descripcion: "Qué parte de lo facturado se va en el sueldo del chofer. Menos es mejor. Sale de la planilla SUELDO SOBRE FACTURACION (con desglose de retenciones).",
    icon: Wallet,
    mejorMenos: true,
    enPuntos: true,
    fmt: (n) => pct(n),
    valorChofer: (c) => (c.facturacion > 0 ? (c.sueldoTotal / c.facturacion) * 100 : null),
    valorTotales: (t) => t?.pctSueldoFact ?? null,
    valorHist: (p) => (p.facturacion > 0 ? (p.sueldoTotal / p.facturacion) * 100 : null),
    fuente: { label: "Sueldos (admin)", href: "/sueldos-admin" },
  },
];

export const metricaPorId = (id: MetricaId): MetricaDef => METRICAS.find((m) => m.id === id)!;

/** KPIs del encabezado (los 7 números grandes) — algunos no son pestaña. */
export type KpiDef = {
  id: string;
  label: string;
  icon: LucideIcon;
  subirEsBueno: boolean;
  enPuntos: boolean;
  /** Pestaña que abre al hacer click (si aplica). */
  metrica: MetricaId | null;
  fuente: { label: string; href: string } | null;
  valor: (t: TotalesMes | null | undefined) => number | null;
  fmt: (n: number | null | undefined) => string;
};

export const KPIS: KpiDef[] = [
  {
    id: "facturacion", label: "Facturación total", icon: TrendingUp,
    subirEsBueno: true, enPuntos: false, metrica: "factkm",
    fuente: { label: "Viajes", href: "/viajes" },
    valor: (t) => t?.facturacion ?? null,
    fmt: (n) => compactMoney(n),
  },
  {
    id: "km", label: "KM totales", icon: Route,
    subirEsBueno: true, enPuntos: false, metrica: null,
    fuente: { label: "Viajes", href: "/viajes" },
    valor: (t) => t?.km ?? null,
    fmt: (n) => (n == null ? "—" : `${numAr(n)} km`),
  },
  {
    id: "factkm", label: "Facturación por km", icon: Gauge,
    subirEsBueno: true, enPuntos: false, metrica: "factkm",
    fuente: { label: "Viajes", href: "/viajes" },
    valor: (t) => t?.factPorKm ?? null,
    fmt: (n) => money(n, 2),
  },
  {
    id: "vacios", label: "% KM vacíos", icon: Truck,
    subirEsBueno: false, enPuntos: true, metrica: "vacios",
    fuente: { label: "Viajes", href: "/viajes" },
    valor: (t) => t?.pctVacios ?? null,
    fmt: (n) => pct(n),
  },
  {
    id: "km100", label: "% KM al 100%", icon: Percent,
    subirEsBueno: true, enPuntos: true, metrica: "km100",
    fuente: { label: "Viajes", href: "/viajes" },
    valor: (t) => t?.pctKm100 ?? null,
    fmt: (n) => pct(n),
  },
  {
    id: "sueldo", label: "% Sueldo / facturación", icon: Wallet,
    subirEsBueno: false, enPuntos: true, metrica: "sueldo",
    fuente: { label: "Sueldos admin", href: "/sueldos-admin" },
    valor: (t) => t?.pctSueldoFact ?? null,
    fmt: (n) => pct(n),
  },
  {
    id: "toneladas", label: "Toneladas promedio", icon: Weight,
    subirEsBueno: true, enPuntos: false, metrica: "toneladas",
    fuente: { label: "Viajes", href: "/viajes" },
    valor: (t) => t?.toneladasProm ?? null,
    fmt: (n) => numAr(n, 2),
  },
];

/** Etiqueta de flota de una fila. */
export const flotaLabel = (c: Pick<MetricaChofer, "flota" | "escalTipo">) =>
  c.flota === "tolvas" ? "Tolvas" : c.escalTipo ? `Escal. ${c.escalTipo}` : "Escalables";
