"use client";

// Tab Aumentos (pedido 21/07): el historial de aumentos de tarifa por cliente
// —los % que el cliente informa, ej. Loma Negra mes a mes— se gestiona acá.
// Es la misma tabla que alimenta "Aumentos: clientes vs sueldos" en /metricas:
// cargar o borrar un aumento acá impacta directo en esa métrica.

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer,
  Tooltip as RTooltip, XAxis, YAxis,
} from "recharts";
import {
  CalendarClock, CheckCircle2, Hash, Plus, Sigma, Trash2, TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ClienteOption } from "./actions";
import {
  eliminarAumentoClienteTarifasAction,
  obtenerAumentosClientes,
  type AumentoClienteHist,
} from "./actions-aumentos";
import CargarAumentoDialog from "./CargarAumentoDialog";

const MESES_CORTO = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MESES_FULL = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const mesCorto = (iso: string) => `${MESES_CORTO[parseInt(iso.slice(5, 7), 10) - 1]} ${iso.slice(2, 4)}`;
const mesLargo = (iso: string) => `${MESES_FULL[parseInt(iso.slice(5, 7), 10) - 1]} ${iso.slice(0, 4)}`;
const fechaCorta = (iso: string) =>
  `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}`;
const pctAr = (n: number, d = 2) =>
  `${n >= 0 ? "+" : ""}${n.toLocaleString("es-AR", { maximumFractionDigits: d })}%`;

function addMonths(mesISO: string, delta: number): string {
  const [y, m] = mesISO.split("-").map((n) => parseInt(n, 10));
  const total = y! * 12 + (m! - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}-01`;
}

/** Aumentos "solo interanual" (ej. YPF): la observación arranca con "Interanual". */
const esInteranual = (a: AumentoClienteHist) =>
  !!a.observaciones && a.observaciones.trim().toLowerCase().startsWith("interanual");

/** % compuesto de una lista de aumentos. */
const componer = (rows: AumentoClienteHist[]) =>
  (rows.reduce((acc, a) => acc * (1 + a.porcentaje / 100), 1) - 1) * 100;

type ClienteResumen = {
  nombre: string;
  clienteId: string | null;
  rows: AumentoClienteHist[]; // ascendente por vigencia
  interanual: number | null; // últimos 12 meses, compuesto
  total: number; // todo el historial, compuesto
  ultimo: AumentoClienteHist;
  soloInteranual: boolean;
};

export default function TabAumentos({
  aumentosIniciales,
  clientes,
  initialCliente,
  canWrite = false,
  canMetricas = false,
}: {
  aumentosIniciales: AumentoClienteHist[];
  clientes: ClienteOption[];
  initialCliente?: string;
  canWrite?: boolean;
  canMetricas?: boolean;
}) {
  const [aumentos, setAumentos] = useState(aumentosIniciales);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [savedFlash, setSavedFlash] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hoyMes = useMemo(() => {
    const hoy = new Date();
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-01`;
  }, []);
  const desde12m = addMonths(hoyMes, -12);
  const hasta12m = addMonths(hoyMes, 1);

  const resumenes = useMemo<ClienteResumen[]>(() => {
    const porCliente = new Map<string, AumentoClienteHist[]>();
    for (const a of aumentos) {
      const arr = porCliente.get(a.clienteNombre) ?? [];
      arr.push(a);
      porCliente.set(a.clienteNombre, arr);
    }
    const res: ClienteResumen[] = [];
    for (const [nombre, rows] of porCliente) {
      rows.sort((a, b) => a.vigenteDesde.localeCompare(b.vigenteDesde));
      // Misma ventana que la paridad de /metricas: [mes actual − 12, mes actual + 1).
      const en12m = rows.filter((r) => r.vigenteDesde >= desde12m && r.vigenteDesde < hasta12m);
      res.push({
        nombre,
        clienteId: rows.find((r) => r.clienteId)?.clienteId ?? null,
        rows,
        interanual: en12m.length ? componer(en12m) : null,
        total: componer(rows),
        ultimo: rows[rows.length - 1]!,
        soloInteranual: rows.every(esInteranual),
      });
    }
    res.sort((a, b) => (b.interanual ?? -Infinity) - (a.interanual ?? -Infinity));
    return res;
  }, [aumentos, desde12m, hasta12m]);

  const [seleccionado, setSeleccionado] = useState<string | null>(
    () => (initialCliente && aumentosIniciales.some((a) => a.clienteNombre === initialCliente)
      ? initialCliente
      : null),
  );
  const actual =
    resumenes.find((r) => r.nombre === seleccionado) ?? resumenes[0] ?? null;

  // Serie mensual continua para el gráfico: del primer aumento al mes actual.
  const serie = useMemo(() => {
    if (!actual) return [];
    const mensuales = actual.rows.filter((r) => !esInteranual(r));
    if (!mensuales.length) return [];
    const primerMes = `${mensuales[0]!.vigenteDesde.slice(0, 7)}-01`;
    const ultimoMes = `${mensuales[mensuales.length - 1]!.vigenteDesde.slice(0, 7)}-01`;
    const finMes = ultimoMes > hoyMes ? ultimoMes : hoyMes;
    const porMes = new Map(mensuales.map((r) => [r.vigenteDesde.slice(0, 7), r.porcentaje]));
    const out: { mes: string; label: string; pct: number | null; acumulado: number }[] = [];
    let acumulado = 1;
    for (let m = primerMes; m <= finMes; m = addMonths(m, 1)) {
      const pct = porMes.get(m.slice(0, 7)) ?? null;
      if (pct != null) acumulado *= 1 + pct / 100;
      out.push({ mes: m, label: mesCorto(m), pct, acumulado: (acumulado - 1) * 100 });
      if (out.length > 60) break; // tope sano
    }
    return out;
  }, [actual, hoyMes]);

  const refresh = () =>
    startTransition(async () => {
      setAumentos(await obtenerAumentosClientes());
    });

  const onSaved = () => {
    setDialogOpen(false);
    setSavedFlash("Aumento cargado");
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setSavedFlash(null), 2500);
    refresh();
  };

  const handleEliminar = async (a: AumentoClienteHist) => {
    if (!confirm(`¿Eliminar el aumento de ${a.clienteNombre} del ${fechaCorta(a.vigenteDesde)} (${pctAr(a.porcentaje)})?`)) return;
    const res = await eliminarAumentoClienteTarifasAction(a.id);
    if ("error" in res) {
      alert(res.error);
      return;
    }
    refresh();
  };

  const notaMetricas = (
    <p className="text-[11px] text-muted-foreground">
      Estos aumentos alimentan la sección{" "}
      <span className="font-medium">Aumentos: clientes vs sueldos</span>
      {canMetricas ? (
        <>
          {" "}de <Link href="/metricas" className="text-primary hover:underline">Métricas</Link>.
        </>
      ) : (
        " de Métricas."
      )}
    </p>
  );

  if (!resumenes.length) {
    return (
      <div className="space-y-4">
        <div className="bg-card rounded-[8px] border border-border shadow-sm p-10 text-center space-y-3">
          <p className="text-muted-foreground text-sm">
            Aún no hay aumentos de clientes cargados. Cuando el cliente informa un aumento de
            tarifa (ej. el % mensual de Loma Negra), cargalo acá para llevar el historial.
          </p>
          {canWrite && (
            <Button type="button" variant="brand" size="sm" onClick={() => setDialogOpen(true)}>
              <Plus size={13} /> Cargar aumento
            </Button>
          )}
          {notaMetricas}
        </div>
        {dialogOpen && (
          <CargarAumentoDialog
            open
            onClose={() => setDialogOpen(false)}
            onSaved={onSaved}
            clientes={clientes}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {notaMetricas}
        <div className="flex items-center gap-2">
          {savedFlash && (
            <span className="inline-flex items-center gap-1.5 text-xs text-[#10B981] font-medium">
              <CheckCircle2 size={12} />
              {savedFlash}
            </span>
          )}
          {canWrite && (
            <Button type="button" variant="brand" size="sm" onClick={() => setDialogOpen(true)}>
              <Plus size={13} /> Cargar aumento
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        {/* Lista de clientes con historial */}
        <div className="bg-card rounded-[8px] border border-border shadow-sm overflow-hidden self-start">
          <p className="px-3 py-2 border-b border-border text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Clientes con aumentos
          </p>
          <div className="divide-y divide-border">
            {resumenes.map((r) => {
              const activo = actual?.nombre === r.nombre;
              return (
                <button
                  key={r.nombre}
                  type="button"
                  onClick={() => setSeleccionado(r.nombre)}
                  className={`w-full px-3 py-2.5 text-left transition-colors ${
                    activo ? "bg-primary/5 border-l-2 border-l-[#0088D1]" : "hover:bg-muted/40 border-l-2 border-l-transparent"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground truncate">{r.nombre}</span>
                    <span className="font-mono text-xs font-semibold text-amber-600 dark:text-amber-400 shrink-0">
                      {r.interanual == null ? "—" : pctAr(r.interanual, 1)}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {r.rows.length} aumento{r.rows.length === 1 ? "" : "s"} · último {mesCorto(r.ultimo.vigenteDesde)}
                  </p>
                </button>
              );
            })}
          </div>
          <p className="px-3 py-2 border-t border-border text-[10px] text-muted-foreground">
            El % es el interanual (últimos 12 meses, compuesto).
          </p>
        </div>

        {/* Detalle del cliente seleccionado */}
        {actual && (
          <div className="space-y-4 min-w-0">
            {/* Cards de resumen */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
              {[
                {
                  icon: TrendingUp,
                  label: "Interanual (12m)",
                  valor: actual.interanual == null ? "—" : pctAr(actual.interanual, 1),
                  detalle: `${mesLargo(desde12m)} → hoy`,
                },
                {
                  icon: Sigma,
                  label: "Acumulado total",
                  valor: pctAr(actual.total, 1),
                  detalle: `desde ${mesLargo(actual.rows[0]!.vigenteDesde)}`,
                },
                {
                  icon: Hash,
                  label: "Aumentos cargados",
                  valor: String(actual.rows.length),
                  detalle: actual.soloInteranual ? "solo interanual" : "detalle mes a mes",
                },
                {
                  icon: CalendarClock,
                  label: "Último aumento",
                  valor: pctAr(actual.ultimo.porcentaje),
                  detalle: `vigente ${mesCorto(actual.ultimo.vigenteDesde)}`,
                },
              ].map((c) => (
                <div key={c.label} className="bg-card rounded-[8px] border border-border p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <c.icon size={12} className="text-amber-500" /> {c.label}
                  </p>
                  <p className="font-mono text-lg font-bold text-foreground mt-0.5">{c.valor}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">{c.detalle}</p>
                </div>
              ))}
            </div>

            {/* Evolución */}
            {serie.length > 0 && (
              <div className="bg-card rounded-[8px] border border-border shadow-sm p-4">
                <h3 className="text-sm font-semibold text-foreground mb-1">
                  Evolución de aumentos — {actual.nombre}
                </h3>
                <p className="text-[11px] text-muted-foreground mb-3">
                  Barras: % de cada mes. Línea: acumulado compuesto desde el primer aumento cargado.
                </p>
                <ResponsiveContainer width="100%" height={220}>
                  <ComposedChart data={serie} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" tickLine={false} />
                    <YAxis yAxisId="mes" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v}%`} />
                    <YAxis yAxisId="acum" orientation="right" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${Math.round(v)}%`} />
                    <RTooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0]!.payload as (typeof serie)[number];
                        return (
                          <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-md text-xs">
                            <p className="font-semibold text-foreground capitalize">{mesLargo(d.mes)}</p>
                            <p className="text-amber-600">{d.pct == null ? "Sin aumento" : `Aumento: ${pctAr(d.pct)}`}</p>
                            <p className="text-[#0088D1]">Acumulado: {pctAr(d.acumulado, 1)}</p>
                          </div>
                        );
                      }}
                    />
                    <Bar yAxisId="mes" dataKey="pct" fill="#F59E0B" radius={[3, 3, 0, 0]} maxBarSize={26} />
                    <Line yAxisId="acum" type="monotone" dataKey="acumulado" stroke="#0088D1" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
            {actual.rows.some(esInteranual) && (
              <p className="text-[11px] text-muted-foreground/80 -mt-2">
                {actual.nombre} tiene aumentos cargados como <span className="font-medium">interanual</span> (un
                solo % por el año, sin detalle mes a mes){serie.length ? "; no aparecen en el gráfico" : ""}.
              </p>
            )}

            {/* Historial */}
            <div className="bg-card rounded-[8px] border border-border shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b border-border">
                  <tr className="text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    <th className="px-4 py-2.5">Vigente desde</th>
                    <th className="px-4 py-2.5 text-right">Aumento</th>
                    <th className="px-4 py-2.5">Observaciones</th>
                    <th className="px-4 py-2.5">Cargado</th>
                    {canWrite && <th className="px-4 py-2.5 text-right">Acciones</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[...actual.rows].reverse().map((a) => (
                    <tr key={a.id} className="hover:bg-muted/40">
                      <td className="px-4 py-2.5 whitespace-nowrap text-foreground capitalize">
                        {mesLargo(a.vigenteDesde)}
                        {esInteranual(a) && (
                          <span className="ml-2 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">
                            Interanual
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                        {pctAr(a.porcentaje)}
                      </td>
                      <td className="px-4 py-2.5 text-[12px] text-muted-foreground max-w-[360px]">
                        <span className="line-clamp-2">{a.observaciones ?? "—"}</span>
                      </td>
                      <td className="px-4 py-2.5 text-[11px] text-muted-foreground whitespace-nowrap">
                        {fechaCorta(a.createdAt)}
                        {a.createdByNombre ? ` · ${a.createdByNombre}` : ""}
                      </td>
                      {canWrite && (
                        <td className="px-4 py-2.5 text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleEliminar(a)}
                            aria-label="Eliminar aumento"
                            className="text-muted-foreground hover:text-red-500"
                          >
                            <Trash2 size={12} />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {dialogOpen && (
        <CargarAumentoDialog
          open
          onClose={() => setDialogOpen(false)}
          onSaved={onSaved}
          clientes={clientes}
          defaultClienteId={actual?.clienteId ?? undefined}
          defaultClienteNombre={actual?.clienteId ? undefined : actual?.nombre}
        />
      )}
    </div>
  );
}
