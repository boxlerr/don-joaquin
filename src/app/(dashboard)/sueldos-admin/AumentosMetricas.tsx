"use client";

import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown, Clock, LineChart as LineIcon, Flame, Info } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import type { SueldoAdminEmpleado, AumentoRow } from "./actions";
import type { InflacionData } from "@/lib/inflacion";

const MESES_CORTO = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MESES_FULL = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const pesos = (n: number) => `$ ${Math.round(n).toLocaleString("es-AR")}`;
const pct = (n: number, d = 1) => `${n >= 0 ? "+" : ""}${n.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d })}%`;
const mesCorto = (iso: string) => `${MESES_CORTO[parseInt(iso.slice(5, 7), 10) - 1]} ${iso.slice(2, 4)}`;
const mesLargo = (iso: string) => `${MESES_FULL[parseInt(iso.slice(5, 7), 10) - 1]} ${iso.slice(0, 4)}`;

/** Inflación acumulada (compuesta) entre dos meses "YYYY-MM" inclusive, en %. */
function inflAcum(serie: { mes: string; valor: number }[], desde: string, hasta: string): number | null {
  const tramo = serie.filter((s) => s.mes >= desde && s.mes <= hasta);
  if (!tramo.length) return null;
  return (tramo.reduce((a, s) => a * (1 + s.valor / 100), 1) - 1) * 100;
}

// Ayuda: ícono con tooltip explicativo.
function InfoTip({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="text-muted-foreground/40 hover:text-muted-foreground cursor-help inline-flex"><Info size={13} /></span>} />
      <TooltipContent side="top" className="max-w-[250px] text-xs leading-relaxed">{children}</TooltipContent>
    </Tooltip>
  );
}

const PERIODOS: { id: number; label: string }[] = [
  { id: 0, label: "Todo" },
  { id: 12, label: "12m" },
  { id: 6, label: "6m" },
  { id: 3, label: "3m" },
];

export default function AumentosMetricas({
  empleados, aumentosPorEmpleado, mesActualIso, inflacion,
}: {
  empleados: SueldoAdminEmpleado[];
  aumentosPorEmpleado: Record<string, AumentoRow[]>;
  mesActualIso: string; // "YYYY-MM"
  inflacion: InflacionData;
}) {
  const [periodoN, setPeriodoN] = useState(0); // 0 = todo; si no, últimas N columnas

  // Meses con datos (vigente_desde), ascendente.
  const mesesSet = new Set<string>();
  for (const arr of Object.values(aumentosPorEmpleado)) for (const a of arr) mesesSet.add(a.vigente_desde.slice(0, 10));
  const mesesTodos = [...mesesSet].sort();
  if (mesesTodos.length === 0) return null;

  // Ventana de comparación según el período elegido.
  const desdeIso = periodoN === 0 ? mesesTodos[0]! : mesesTodos[Math.max(0, mesesTodos.length - periodoN)]!;
  const hastaIso = mesesTodos[mesesTodos.length - 1]!;
  const desde7 = desdeIso.slice(0, 7);
  const hasta7 = hastaIso.slice(0, 7);
  const mesesVentana = mesesTodos.filter((m) => m >= desdeIso && m <= hastaIso);

  const baseEn = (choferId: string, mesIso: string): number | null => {
    const a = (aumentosPorEmpleado[choferId] ?? []).find((x) => x.vigente_desde.slice(0, 10) <= mesIso);
    return a ? a.sueldo_base : null;
  };

  // Masa salarial BASE mes a mes en la ventana.
  const masaSerie = mesesVentana.map((m) => ({
    mes: m,
    label: mesCorto(m),
    total: empleados.reduce((s, e) => s + (baseEn(e.chofer_id, m) ?? 0), 0),
  }));
  const masaHasta = masaSerie[masaSerie.length - 1]?.total ?? 0;
  const masaDesde = masaSerie[0]?.total ?? 0;
  const varMasa = masaDesde > 0 ? ((masaHasta - masaDesde) / masaDesde) * 100 : null;

  // Aumento acumulado por empleado en la ventana (base al inicio vs base al final) + vs inflación.
  const inflVentana = inflAcum(inflacion.serie, desde7, hasta7);
  const acumEmp = empleados
    .map((e) => {
      const bDesde = baseEn(e.chofer_id, desdeIso);
      const bHasta = baseEn(e.chofer_id, hastaIso);
      if (!bDesde || bDesde <= 0 || bHasta == null) return null;
      const acum = (bHasta / bDesde - 1) * 100;
      const real = inflVentana != null ? ((1 + acum / 100) / (1 + inflVentana / 100) - 1) * 100 : null;
      return { e, acum, real };
    })
    .filter((x): x is NonNullable<typeof x> => x != null)
    .sort((a, b) => b.acum - a.acum);

  const promedioAcum = acumEmp.length ? acumEmp.reduce((s, x) => s + x.acum, 0) / acumEmp.length : null;
  const realPromedio = promedioAcum != null && inflVentana != null ? ((1 + promedioAcum / 100) / (1 + inflVentana / 100) - 1) * 100 : null;

  // Atrasados de aumento: meses desde el último aumento vs el mes actual (no depende del período).
  const mesActual7 = mesActualIso.slice(0, 7);
  const mesesEntre = (a: string, b: string) => {
    const [ay, am] = a.split("-").map(Number);
    const [by, bm] = b.split("-").map(Number);
    return (by! - ay!) * 12 + (bm! - am!);
  };
  const UMBRAL = 3;
  const atrasados = empleados
    .map((e) => {
      const arr = aumentosPorEmpleado[e.chofer_id] ?? [];
      if (!arr.length) return null;
      const ultimo = arr.reduce((mx, a) => (a.vigente_desde > mx ? a.vigente_desde : mx), arr[0]!.vigente_desde).slice(0, 7);
      const m = mesesEntre(ultimo, mesActual7);
      return m >= UMBRAL ? { e, meses: m } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x != null)
    .sort((a, b) => b.meses - a.meses);

  const rangoLabel = `${mesLargo(desdeIso)} → ${mesLargo(hastaIso)}`;
  const card = "bg-card border border-border rounded-[8px] p-4";

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Selector de período de comparación */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Período de comparación</span>
          <div className="flex items-center gap-1 bg-muted p-0.5 rounded-lg">
            {PERIODOS.map((p) => (
              <button key={p.id} type="button" onClick={() => setPeriodoN(p.id)}
                className={`px-2.5 h-7 text-xs font-medium rounded-md transition-all ${periodoN === p.id ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                {p.label}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-muted-foreground capitalize">{rangoLabel}</span>
        </div>

        {/* Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* Inflación */}
          <div className={card}>
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                Inflación (INDEC)
                <InfoTip>Variación mensual del IPC (INDEC), traída automáticamente de una fuente pública. <strong>Acum. período</strong> = inflación compuesta del rango elegido. <strong>Próx. dato</strong> = fecha estimada en que INDEC publica el mes siguiente.</InfoTip>
              </p>
              <span className="p-1.5 rounded-lg bg-orange-500/10 text-orange-600"><Flame size={15} /></span>
            </div>
            {inflacion.ultimoValor != null && inflacion.ultimoMes ? (
              <>
                <p className="text-2xl font-black text-foreground mt-1">{inflacion.ultimoValor.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%</p>
                <p className="text-[11px] text-muted-foreground capitalize">{mesLargo(`${inflacion.ultimoMes}-01`)}{inflVentana != null && ` · acum. período ${pct(inflVentana)}`}</p>
                {inflacion.proximoAnuncio && (
                  <p className="text-[11px] text-muted-foreground/80 mt-1">
                    Próx. dato ({inflacion.proximoAnuncio.mesLabel}): ~{parseInt(inflacion.proximoAnuncio.fecha.slice(8, 10), 10)} {MESES_CORTO[parseInt(inflacion.proximoAnuncio.fecha.slice(5, 7), 10) - 1]}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground mt-2">Sin dato de inflación disponible.</p>
            )}
          </div>

          {/* Aumentos vs inflación */}
          <div className={card}>
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                Aumentos vs inflación
                <InfoTip>Aumento promedio de los <strong>sueldos base</strong> en el período elegido, comparado con la inflación del mismo período. <strong>Real</strong> = cuánto le ganó (o perdió) a la inflación.</InfoTip>
              </p>
              <span className={`p-1.5 rounded-lg ${(realPromedio ?? 0) >= 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"}`}>
                {(realPromedio ?? 0) >= 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
              </span>
            </div>
            {promedioAcum != null ? (
              <>
                <p className="text-2xl font-black text-foreground mt-1">{pct(promedioAcum)}</p>
                <p className="text-[11px] text-muted-foreground">aumento promedio del período</p>
                {realPromedio != null ? (
                  <p className={`text-[11px] font-semibold mt-1 ${realPromedio >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {realPromedio >= 0 ? "Le ganó a la inflación" : "Perdió contra la inflación"} por {pct(Math.abs(realPromedio)).replace("+", "")} real
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground/80 mt-1">Sin dato de inflación para comparar.</p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground mt-2">Sin aumentos en el período elegido.</p>
            )}
          </div>

          {/* Atrasados de aumento */}
          <div className={card}>
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                Atrasados de aumento
                <InfoTip>Personas cuyo <strong>último aumento</strong> fue hace {UMBRAL} o más meses (respecto al mes actual). Sirve para no olvidarse de actualizarles el sueldo. No depende del período de comparación.</InfoTip>
              </p>
              <span className={`p-1.5 rounded-lg ${atrasados.length ? "bg-amber-500/10 text-amber-600" : "bg-emerald-500/10 text-emerald-600"}`}><Clock size={15} /></span>
            </div>
            <p className="text-2xl font-black text-foreground mt-1">{atrasados.length}</p>
            <p className="text-[11px] text-muted-foreground">sin aumento hace {UMBRAL}+ meses</p>
            {atrasados.length > 0 && (
              <p className="text-[11px] text-muted-foreground/80 mt-1 truncate" title={atrasados.map((a) => `${a.e.nombre} (${a.meses}m)`).join(", ")}>
                {atrasados.slice(0, 2).map((a) => a.e.nombre.split(",")[0]).join(", ")}{atrasados.length > 2 ? ` +${atrasados.length - 2}` : ""}
              </p>
            )}
          </div>
        </div>

        {/* Evolución + acumulado por empleado */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Evolución del costo salarial base */}
          <div className="bg-card border border-border rounded-[8px] p-4">
            <div className="flex items-center gap-2 mb-3">
              <LineIcon size={15} className="text-primary" />
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                Evolución del costo salarial
                <InfoTip>Suma de los <strong>sueldos base</strong> de todo el personal, mes a mes, en el período elegido. (Las variables —comisión, combustible, etc.— solo existen para el mes actual, por eso el gráfico es sobre la base.)</InfoTip>
              </h3>
              <span className="text-[11px] text-muted-foreground ml-auto">masa de sueldos base</span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={masaSerie} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#64748B" }} tickLine={false} axisLine={{ stroke: "#E2E8F0" }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: "#64748B" }} tickLine={false} axisLine={false} width={44} tickFormatter={(v) => `$${(v / 1e6).toFixed(0)}M`} />
                <RTooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0]!.payload as { mes: string; total: number };
                    return (
                      <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-md text-xs">
                        <p className="font-semibold text-foreground capitalize">{mesLargo(`${d.mes.slice(0, 7)}-01`)}</p>
                        <p className="text-primary font-semibold">{pesos(d.total)}</p>
                      </div>
                    );
                  }}
                />
                <Line type="monotone" dataKey="total" stroke="#0088D1" strokeWidth={2.5} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
            {varMasa != null && (
              <p className={`text-[11px] font-semibold mt-1 ${varMasa >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {pct(varMasa)} en el período · total base {pesos(masaHasta)}
              </p>
            )}
          </div>

          {/* Aumento acumulado por empleado */}
          <div className="bg-card border border-border rounded-[8px] p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={15} className="text-emerald-600" />
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                Aumento acumulado por empleado
                <InfoTip>Cuánto subió el <strong>sueldo base</strong> de cada persona en el período elegido, y cuánto es en términos <strong>reales</strong> (descontada la inflación del período).</InfoTip>
              </h3>
              <span className="text-[11px] text-muted-foreground ml-auto">del período · vs inflación</span>
            </div>
            {acumEmp.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">Sin empleados con aumentos en el período elegido.</p>
            ) : (
              <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1">
                {acumEmp.map((x) => (
                  <div key={x.e.chofer_id} className="flex items-center gap-2 text-xs">
                    <span className="truncate flex-1 text-foreground">{x.e.nombre}</span>
                    <span className={`font-mono font-semibold w-14 text-right ${x.acum > 0 ? "text-emerald-600" : "text-muted-foreground"}`}>{pct(x.acum)}</span>
                    {x.real != null && (
                      <span className={`w-16 text-right font-semibold ${x.real >= 0 ? "text-emerald-600" : "text-red-600"}`} title="Aumento real (descontada la inflación)">
                        {pct(x.real)} real
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
