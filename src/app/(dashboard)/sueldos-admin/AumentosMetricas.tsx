"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown, Clock, LineChart as LineIcon, Flame } from "lucide-react";
import type { SueldoAdminEmpleado, AumentoRow } from "./actions";
import type { InflacionData } from "@/lib/inflacion";

const MESES_CORTO = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const pesos = (n: number) => `$ ${Math.round(n).toLocaleString("es-AR")}`;
const pct = (n: number, d = 1) =>
  `${n >= 0 ? "+" : ""}${n.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d })}%`;
const mesCorto = (iso: string) => `${MESES_CORTO[parseInt(iso.slice(5, 7), 10) - 1]} ${iso.slice(2, 4)}`;
const mesLargo = (iso: string) => {
  const full = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  return `${full[parseInt(iso.slice(5, 7), 10) - 1]} ${iso.slice(0, 4)}`;
};

/** Inflación acumulada (compuesta) entre dos meses "YYYY-MM" inclusive, en %. */
function inflAcum(serie: { mes: string; valor: number }[], desde: string, hasta: string): number | null {
  const tramo = serie.filter((s) => s.mes >= desde && s.mes <= hasta);
  if (!tramo.length) return null;
  return (tramo.reduce((a, s) => a * (1 + s.valor / 100), 1) - 1) * 100;
}

export default function AumentosMetricas({
  empleados, aumentosPorEmpleado, mesActualIso, inflacion,
}: {
  empleados: SueldoAdminEmpleado[];
  aumentosPorEmpleado: Record<string, AumentoRow[]>;
  mesActualIso: string; // "YYYY-MM"
  inflacion: InflacionData;
}) {
  // Meses con datos (vigente_desde), ascendente.
  const mesesSet = new Set<string>();
  for (const arr of Object.values(aumentosPorEmpleado)) for (const a of arr) mesesSet.add(a.vigente_desde.slice(0, 10));
  const meses = [...mesesSet].sort();
  if (meses.length === 0) return null;

  const baseEn = (choferId: string, mesIso: string): number | null => {
    const a = (aumentosPorEmpleado[choferId] ?? []).find((x) => x.vigente_desde.slice(0, 10) <= mesIso);
    return a ? a.sueldo_base : null;
  };

  // Masa salarial BASE mes a mes (variables solo existen para el mes actual).
  const masaSerie = meses.map((m) => ({
    mes: m,
    label: mesCorto(m),
    total: empleados.reduce((s, e) => s + (baseEn(e.chofer_id, m) ?? 0), 0),
  }));
  const masaActual = masaSerie[masaSerie.length - 1]?.total ?? 0;
  const masaPrev = masaSerie.length > 1 ? masaSerie[masaSerie.length - 2]!.total : null;
  const varMasa = masaPrev && masaPrev > 0 ? ((masaActual - masaPrev) / masaPrev) * 100 : null;

  // Aumento acumulado por empleado (primer → último mes con dato propio) + vs inflación.
  const acumEmp = empleados
    .map((e) => {
      const arr = (aumentosPorEmpleado[e.chofer_id] ?? []).slice().sort((a, b) => a.vigente_desde.localeCompare(b.vigente_desde));
      if (arr.length < 2 || !(arr[0]!.sueldo_base > 0)) return null;
      const desde = arr[0]!.vigente_desde.slice(0, 7);
      const hasta = arr[arr.length - 1]!.vigente_desde.slice(0, 7);
      const acum = (arr[arr.length - 1]!.sueldo_base / arr[0]!.sueldo_base - 1) * 100;
      const infl = inflAcum(inflacion.serie, desde, hasta);
      const real = infl != null ? ((1 + acum / 100) / (1 + infl / 100) - 1) * 100 : null;
      return { e, acum, infl, real, desde, hasta };
    })
    .filter((x): x is NonNullable<typeof x> => x != null)
    .sort((a, b) => b.acum - a.acum);

  const promedioAcum = acumEmp.length ? acumEmp.reduce((s, x) => s + x.acum, 0) / acumEmp.length : null;
  const periodoDesde = meses[0]!.slice(0, 7);
  const periodoHasta = meses[meses.length - 1]!.slice(0, 7);
  const inflPeriodo = inflAcum(inflacion.serie, periodoDesde, periodoHasta);
  const realPromedio = promedioAcum != null && inflPeriodo != null ? ((1 + promedioAcum / 100) / (1 + inflPeriodo / 100) - 1) * 100 : null;

  // Atrasados de aumento: meses desde el último aumento vs el mes actual.
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
      return m >= UMBRAL ? { e, meses: m, desde: ultimo } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x != null)
    .sort((a, b) => b.meses - a.meses);

  const card = "bg-card border border-border rounded-[8px] p-4";

  return (
    <div className="space-y-4">
      {/* Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Inflación */}
        <div className={card}>
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Inflación (INDEC)</p>
            <span className="p-1.5 rounded-lg bg-orange-500/10 text-orange-600"><Flame size={15} /></span>
          </div>
          {inflacion.ultimoValor != null && inflacion.ultimoMes ? (
            <>
              <p className="text-2xl font-black text-foreground mt-1">{inflacion.ultimoValor.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%</p>
              <p className="text-[11px] text-muted-foreground capitalize">{mesLargo(`${inflacion.ultimoMes}-01`)}{inflPeriodo != null && ` · acum. período ${pct(inflPeriodo)}`}</p>
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
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Aumentos vs inflación</p>
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
            <p className="text-sm text-muted-foreground mt-2">Faltan aumentos con progresión para calcular.</p>
          )}
        </div>

        {/* Atrasados de aumento */}
        <div className={card}>
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Atrasados de aumento</p>
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
            <h3 className="text-sm font-semibold text-foreground">Evolución del costo salarial</h3>
            <span className="text-[11px] text-muted-foreground ml-auto">masa de sueldos base</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={masaSerie} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#64748B" }} tickLine={false} axisLine={{ stroke: "#E2E8F0" }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: "#64748B" }} tickLine={false} axisLine={false} width={44} tickFormatter={(v) => `$${(v / 1e6).toFixed(0)}M`} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0]!;
                  const d = p.payload as { mes: string; total: number };
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
              {pct(varMasa)} vs el mes anterior · total base {pesos(masaActual)}
            </p>
          )}
        </div>

        {/* Aumento acumulado por empleado */}
        <div className="bg-card border border-border rounded-[8px] p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={15} className="text-emerald-600" />
            <h3 className="text-sm font-semibold text-foreground">Aumento acumulado por empleado</h3>
            <span className="text-[11px] text-muted-foreground ml-auto">del período · vs inflación</span>
          </div>
          {acumEmp.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">Todavía no hay empleados con progresión de aumentos.</p>
          ) : (
            <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1">
              {acumEmp.map((x) => (
                <div key={x.e.chofer_id} className="flex items-center gap-2 text-xs">
                  <span className="truncate flex-1 text-foreground">{x.e.nombre}</span>
                  <span className="font-mono font-semibold text-emerald-600 w-14 text-right">{pct(x.acum)}</span>
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
  );
}
