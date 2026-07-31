"use client";

// Pestaña "Evolución": la planilla anual como la conocen del Excel — filas =
// meses, columnas = todas las métricas, con el mes visto resaltado y fila de
// totales/promedios abajo. Ideal para leer 13 meses de un vistazo.

import { useMemo } from "react";
import Link from "next/link";
import type { SerieMes, TotalesMes } from "../actions";
import type { Flota } from "../actions";
import { money, numAr, pct, mesLabel } from "./format";

type FlotaSel = Flota | "general";

export default function EvolucionTab({
  serie, mesActivo, flota, hoyMes,
}: {
  serie: SerieMes[];
  mesActivo: string;
  flota: FlotaSel;
  hoyMes: string;
}) {
  const filas = useMemo(
    () => serie.map((s) => ({ mes: s.mes, t: s[flota], costoKm: s.costoKm, esAgregado: s.esAgregado })),
    [serie, flota],
  );

  const conDatos = filas.filter((f): f is typeof f & { t: TotalesMes } => f.t != null);

  const totales = useMemo(() => {
    if (!conDatos.length) return null;
    const sum = (f: (t: TotalesMes) => number) => conDatos.reduce((s, r) => s + f(r.t), 0);
    const km = sum((t) => t.km);
    const fact = sum((t) => t.facturacion);
    const sueldo = sum((t) => t.sueldoTotal);
    const kmVacios = sum((t) => t.kmVacios);
    const km100 = sum((t) => t.km100);
    const tons = conDatos.filter((r) => r.t.toneladasProm != null);
    return {
      km, fact, sueldo,
      factPorKm: km > 0 ? fact / km : null,
      pctVacios: km > 0 ? (kmVacios / km) * 100 : null,
      pctKm100: km > 0 ? (km100 / km) * 100 : null,
      pctSueldo: fact > 0 ? (sueldo / fact) * 100 : null,
      tonProm: tons.length ? tons.reduce((s, r) => s + (r.t.toneladasProm ?? 0), 0) / tons.length : null,
    };
  }, [conDatos]);

  if (!conDatos.length) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Sin serie histórica para la flota elegida.</p>;
  }

  const th = "py-2 px-3 font-medium text-right whitespace-nowrap";
  const td = "py-1.5 px-3 text-right font-mono tabular-nums whitespace-nowrap";

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-md border border-border">
        {/* min-w subió con los montos completos (antes iban abreviados). */}
        <table className="w-full text-sm min-w-[1120px]">
          <thead>
            <tr className="bg-muted/80 text-xs text-muted-foreground border-b border-border">
              <th className="py-2 px-3 font-medium text-left">Mes</th>
              <th className={th}>Camiones</th>
              <th className={th}>KM</th>
              <th className={th}>Facturación</th>
              <th className={th}>$/km</th>
              <th className={th}>% vacíos</th>
              <th className={th}>% al 100</th>
              <th className={th}>% sueldo/fact</th>
              <th className={th}>Sueldos $</th>
              <th className={th}>Ton. prom</th>
              <th className={th}>Costo estudio $/km</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filas.map((f, i) => {
              const activo = f.mes === mesActivo;
              const esHoy = f.mes === hoyMes;
              if (!f.t) {
                return (
                  <tr key={f.mes} className={i % 2 ? "bg-muted/20" : ""}>
                    <td className="py-1.5 px-3 text-muted-foreground">{mesLabel(f.mes)}</td>
                    <td colSpan={10} className="py-1.5 px-3 text-xs text-muted-foreground/70 italic">
                      Sin planilla cargada{f.mes <= hoyMes ? " todavía" : ""}
                    </td>
                  </tr>
                );
              }
              const t = f.t;
              return (
                <tr
                  key={f.mes}
                  className={`${activo ? "bg-primary/10 font-medium" : i % 2 ? "bg-muted/20" : ""}`}
                >
                  <td className="py-1.5 px-3 whitespace-nowrap">
                    <Link
                      href={`/metricas?month=${f.mes.slice(0, 7)}`}
                      className={`hover:text-primary hover:underline ${activo ? "text-primary font-semibold" : "text-foreground"}`}
                      title="Ver este mes"
                    >
                      {mesLabel(f.mes)}
                    </Link>
                    {esHoy && <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary">HOY</span>}
                    {f.esAgregado && <span className="ml-1.5 text-[9px] text-muted-foreground" title="Mes histórico: solo agregados, sin detalle por chofer">agreg.</span>}
                  </td>
                  <td className={td}>{t.camiones || "—"}</td>
                  <td className={td}>{numAr(t.km)}</td>
                  <td className={td}>{money(t.facturacion)}</td>
                  <td className={td}>{money(t.factPorKm, 2)}</td>
                  <td className={td}>{pct(t.pctVacios)}</td>
                  <td className={td}>{pct(t.pctKm100)}</td>
                  <td className={td}>{pct(t.pctSueldoFact)}</td>
                  <td className={td}>{money(t.sueldoTotal)}</td>
                  <td className={td}>{numAr(t.toneladasProm, 2)}</td>
                  <td className={td}>{money(f.costoKm, 2)}</td>
                </tr>
              );
            })}
          </tbody>
          {totales && (
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/60 font-semibold text-foreground">
                <td className="py-2 px-3">TOTAL / PROM. ({conDatos.length} meses)</td>
                <td className={td} />
                <td className={td}>{numAr(totales.km)}</td>
                <td className={td}>{money(totales.fact)}</td>
                <td className={td}>{money(totales.factPorKm, 2)}</td>
                <td className={td}>{pct(totales.pctVacios)}</td>
                <td className={td}>{pct(totales.pctKm100)}</td>
                <td className={td}>{pct(totales.pctSueldo)}</td>
                <td className={td}>{money(totales.sueldo)}</td>
                <td className={td}>{numAr(totales.tonProm, 2)}</td>
                <td className={td} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">
        $/km, % y toneladas del total son ponderados sobre los {conDatos.length} meses con datos.
        Click en un mes para verlo en detalle.
      </p>
    </div>
  );
}
