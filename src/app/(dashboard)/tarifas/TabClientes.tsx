"use client";

// Un solo lugar por cliente: sus tarifas y sus aumentos juntos. Antes eran dos
// pestañas separadas y había que acordarse en cuál estaba cada cosa; ahora se
// elige "YPF" y se ve todo lo suyo.
//
// Los aumentos son la misma tabla que alimenta "¿Los aumentos van a la par?" en
// /metricas: cargar o borrar uno acá impacta directo en esa comparación.

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer,
  Tooltip as RTooltip, XAxis, YAxis,
} from "recharts";
import {
  CalendarClock, CheckCircle2, Hash, History, PauseCircle, Pencil, Plus,
  Search, Sigma, Trash2, TrendingUp, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ModalNuevaTarifa from "./ModalNuevaTarifa";
import TarifaHistorialDrawer from "./TarifaHistorialDrawer";
import CargarAumentoDialog from "./CargarAumentoDialog";
import {
  cambiarEstadoTarifa,
  obtenerTarifas,
  type ClienteOption,
  type RutaOption,
  type TarifaConRelaciones,
} from "./actions";
import {
  eliminarAumentoClienteTarifasAction,
  obtenerAumentosClientes,
  type AumentoClienteHist,
} from "./actions-aumentos";
import { getModalidadMeta } from "./validaciones";

const MESES_CORTO = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MESES_FULL = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const mesCorto = (iso: string) => `${MESES_CORTO[parseInt(iso.slice(5, 7), 10) - 1]} ${iso.slice(2, 4)}`;
const mesLargo = (iso: string) => `${MESES_FULL[parseInt(iso.slice(5, 7), 10) - 1]} ${iso.slice(0, 4)}`;
const fechaCorta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}`;
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

/** Clave para cruzar el nombre de la tarifa con el del aumento (texto libre). */
const clave = (nombre: string) => nombre.trim().toUpperCase();

function fmtFecha(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00").toLocaleDateString("es-AR");
}
function fmtValor(valor: number, moneda: string): string {
  return `${moneda} ${valor.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type ClienteFicha = {
  nombre: string;
  clienteId: string | null;
  tarifas: TarifaConRelaciones[];
  aumentos: AumentoClienteHist[]; // ascendente por vigencia
  interanual: number | null;
  total: number | null;
  ultimo: AumentoClienteHist | null;
};

type Props = {
  tarifasIniciales: TarifaConRelaciones[];
  aumentosIniciales: AumentoClienteHist[];
  clientes: ClienteOption[];
  rutas: RutaOption[];
  canWrite?: boolean;
  canMetricas?: boolean;
  /** Cliente preseleccionado (link desde /metricas). */
  initialCliente?: string;
};

export default function TabClientes({
  tarifasIniciales,
  aumentosIniciales,
  clientes,
  rutas,
  canWrite = false,
  canMetricas = false,
  initialCliente,
}: Props) {
  const [tarifas, setTarifas] = useState(tarifasIniciales);
  const [aumentos, setAumentos] = useState(aumentosIniciales);
  const [busqueda, setBusqueda] = useState("");
  const [seleccionado, setSeleccionado] = useState<string | null>(initialCliente ?? null);
  const [savedFlash, setSavedFlash] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Diálogos
  const [modalTarifa, setModalTarifa] = useState(false);
  const [tarifaEditar, setTarifaEditar] = useState<TarifaConRelaciones | null>(null);
  const [historialId, setHistorialId] = useState<string | null>(null);
  const [historialLabel, setHistorialLabel] = useState("");
  const [aumentoOpen, setAumentoOpen] = useState(false);

  // Rango del gráfico (vacío = todo el historial del cliente).
  const [desdeMes, setDesdeMes] = useState("");
  const [hastaMes, setHastaMes] = useState("");

  const hoyMes = useMemo(() => {
    const hoy = new Date();
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-01`;
  }, []);
  const desde12m = addMonths(hoyMes, -12);
  const hasta12m = addMonths(hoyMes, 1);

  // Una ficha por cliente, con tarifas y aumentos cruzados por nombre.
  const fichas = useMemo<ClienteFicha[]>(() => {
    const porClave = new Map<string, ClienteFicha>();
    const tomar = (nombre: string): ClienteFicha => {
      const k = clave(nombre);
      let f = porClave.get(k);
      if (!f) {
        f = { nombre, clienteId: null, tarifas: [], aumentos: [], interanual: null, total: null, ultimo: null };
        porClave.set(k, f);
      }
      return f;
    };
    for (const t of tarifas) tomar(t.cliente_nombre).tarifas.push(t);
    for (const a of aumentos) {
      const f = tomar(a.clienteNombre);
      f.aumentos.push(a);
      if (a.clienteId) f.clienteId = a.clienteId;
    }
    const out = [...porClave.values()];
    for (const f of out) {
      f.aumentos.sort((a, b) => a.vigenteDesde.localeCompare(b.vigenteDesde));
      if (f.aumentos.length) {
        // Misma ventana que la paridad de /metricas: [mes actual − 12, mes actual + 1).
        const en12m = f.aumentos.filter((r) => r.vigenteDesde >= desde12m && r.vigenteDesde < hasta12m);
        f.interanual = en12m.length ? componer(en12m) : null;
        f.total = componer(f.aumentos);
        f.ultimo = f.aumentos[f.aumentos.length - 1]!;
      }
    }
    return out.sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [tarifas, aumentos, desde12m, hasta12m]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return fichas;
    return fichas.filter((f) => f.nombre.toLowerCase().includes(q));
  }, [fichas, busqueda]);

  const actual =
    fichas.find((f) => clave(f.nombre) === clave(seleccionado ?? "")) ?? visibles[0] ?? fichas[0] ?? null;

  // Serie del gráfico. A diferencia de antes, los aumentos "interanual" (un solo
  // % por el año, como los de YPF) TAMBIÉN entran, en su propia serie: si no, un
  // cliente cargado así no dibujaba nada y quedaba con otra cara que el resto.
  const rangoDefault = useMemo(() => {
    if (!actual?.aumentos.length) return null;
    const primero = `${actual.aumentos[0]!.vigenteDesde.slice(0, 7)}-01`;
    const ultimo = `${actual.aumentos[actual.aumentos.length - 1]!.vigenteDesde.slice(0, 7)}-01`;
    return { desde: primero, hasta: ultimo > hoyMes ? ultimo : hoyMes };
  }, [actual, hoyMes]);

  const serie = useMemo(() => {
    if (!rangoDefault || !actual) return [];
    const desde = desdeMes ? `${desdeMes}-01` : rangoDefault.desde;
    const hasta = hastaMes ? `${hastaMes}-01` : rangoDefault.hasta;
    if (desde > hasta) return [];
    const mensual = new Map<string, number>();
    const anual = new Map<string, number>();
    for (const r of actual.aumentos) {
      const m = r.vigenteDesde.slice(0, 7);
      const destino = esInteranual(r) ? anual : mensual;
      destino.set(m, (destino.get(m) ?? 0) + r.porcentaje);
    }
    const out: { mes: string; label: string; pct: number | null; anual: number | null; acumulado: number }[] = [];
    let acum = 1;
    for (let m = desde; m <= hasta; m = addMonths(m, 1)) {
      const k = m.slice(0, 7);
      const pct = mensual.get(k) ?? null;
      const anu = anual.get(k) ?? null;
      // El acumulado compone lo que se ve en el rango elegido.
      if (pct != null) acum *= 1 + pct / 100;
      if (anu != null) acum *= 1 + anu / 100;
      out.push({ mes: m, label: mesCorto(m), pct, anual: anu, acumulado: (acum - 1) * 100 });
      if (out.length > 180) break; // tope sano
    }
    return out;
  }, [actual, rangoDefault, desdeMes, hastaMes]);

  const hayInteranual = serie.some((s) => s.anual != null);

  const refrescarTodo = () =>
    startTransition(async () => {
      const [t, a] = await Promise.all([obtenerTarifas(), obtenerAumentosClientes()]);
      setTarifas(t);
      setAumentos(a);
    });

  const flash = (msg: string) => {
    setSavedFlash(msg);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setSavedFlash(null), 2500);
  };

  const onTarifaSaved = () => {
    const editando = !!tarifaEditar;
    setModalTarifa(false);
    setTarifaEditar(null);
    flash(editando ? "Tarifa actualizada" : "Tarifa creada");
    refrescarTodo();
  };

  const onAumentoSaved = () => {
    setAumentoOpen(false);
    flash("Aumento cargado");
    refrescarTodo();
  };

  const onToggleActiva = (t: TarifaConRelaciones) => {
    startTransition(async () => {
      const res = await cambiarEstadoTarifa(t.id, !t.activa);
      if ("error" in res) {
        alert(res.error);
        return;
      }
      setTarifas((prev) => prev.map((x) => (x.id === t.id ? { ...x, activa: !t.activa } : x)));
    });
  };

  const onEliminarAumento = async (a: AumentoClienteHist) => {
    if (!confirm(`¿Eliminar el aumento de ${a.clienteNombre} del ${fechaCorta(a.vigenteDesde)} (${pctAr(a.porcentaje)})?`)) return;
    const res = await eliminarAumentoClienteTarifasAction(a.id);
    if ("error" in res) {
      alert(res.error);
      return;
    }
    refrescarTodo();
  };

  if (!fichas.length) {
    return (
      <div className="bg-card rounded-[8px] border border-border shadow-sm p-10 text-center space-y-3">
        <p className="text-muted-foreground text-sm">
          Todavía no hay ningún cliente con tarifas ni aumentos cargados.
        </p>
        {canWrite && (
          <div className="flex items-center justify-center gap-2">
            <Button type="button" variant="brand" size="sm" onClick={() => setModalTarifa(true)}>
              <Plus size={13} /> Nueva tarifa
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setAumentoOpen(true)}>
              <Plus size={13} /> Cargar aumento
            </Button>
          </div>
        )}
        <ModalNuevaTarifa
          open={modalTarifa}
          onClose={() => setModalTarifa(false)}
          onSaved={onTarifaSaved}
          clientes={clientes}
          rutas={rutas}
          tarifa={null}
        />
        {aumentoOpen && (
          <CargarAumentoDialog open onClose={() => setAumentoOpen(false)} onSaved={onAumentoSaved} clientes={clientes} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[11px] text-muted-foreground">
          Los aumentos alimentan la sección{" "}
          <span className="font-medium">¿Los aumentos van a la par?</span>
          {canMetricas ? (
            <>
              {" "}de <Link href="/metricas" className="text-primary hover:underline">Métricas</Link>.
            </>
          ) : (
            " de Métricas."
          )}
        </p>
        {savedFlash && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#10B981]">
            <CheckCircle2 size={12} />
            {savedFlash}
          </span>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        {/* Clientes */}
        <div className="bg-card rounded-[8px] border border-border shadow-sm overflow-hidden self-start">
          <div className="border-b border-border p-2">
            <div className="relative">
              <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/70" />
              <Input
                type="search"
                placeholder="Buscar cliente…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="h-8 pl-7 text-xs"
              />
            </div>
          </div>
          <div className="max-h-[60vh] divide-y divide-border overflow-auto">
            {visibles.map((f) => {
              const activo = actual != null && clave(actual.nombre) === clave(f.nombre);
              return (
                <button
                  key={clave(f.nombre)}
                  type="button"
                  onClick={() => setSeleccionado(f.nombre)}
                  className={`w-full px-3 py-2.5 text-left transition-colors ${
                    activo
                      ? "border-l-2 border-l-[#0088D1] bg-primary/5"
                      : "border-l-2 border-l-transparent hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-foreground">{f.nombre}</span>
                    <span className="shrink-0 font-mono text-xs font-semibold text-amber-600 dark:text-amber-400">
                      {f.interanual == null ? "—" : pctAr(f.interanual, 1)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {f.tarifas.length} tarifa{f.tarifas.length === 1 ? "" : "s"} ·{" "}
                    {f.aumentos.length} aumento{f.aumentos.length === 1 ? "" : "s"}
                  </p>
                </button>
              );
            })}
            {visibles.length === 0 && (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">Ningún cliente coincide.</p>
            )}
          </div>
          <p className="border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
            El % es el interanual (últimos 12 meses, compuesto).
          </p>
        </div>

        {/* Detalle del cliente */}
        {actual && (
          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-foreground">{actual.nombre}</h2>
              {canWrite && (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setTarifaEditar(null);
                      setModalTarifa(true);
                    }}
                  >
                    <Plus size={13} /> Nueva tarifa
                  </Button>
                  <Button type="button" variant="brand" size="sm" onClick={() => setAumentoOpen(true)}>
                    <Plus size={13} /> Cargar aumento
                  </Button>
                </div>
              )}
            </div>

            {/* Resumen de aumentos */}
            <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
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
                  valor: actual.total == null ? "—" : pctAr(actual.total, 1),
                  detalle: actual.aumentos.length ? `desde ${mesLargo(actual.aumentos[0]!.vigenteDesde)}` : "sin aumentos",
                },
                {
                  icon: Hash,
                  label: "Aumentos cargados",
                  valor: String(actual.aumentos.length),
                  detalle: actual.aumentos.length
                    ? actual.aumentos.every(esInteranual)
                      ? "solo interanual"
                      : "detalle mes a mes"
                    : "—",
                },
                {
                  icon: CalendarClock,
                  label: "Último aumento",
                  valor: actual.ultimo ? pctAr(actual.ultimo.porcentaje) : "—",
                  detalle: actual.ultimo ? `vigente ${mesCorto(actual.ultimo.vigenteDesde)}` : "—",
                },
              ].map((c) => (
                <div key={c.label} className="rounded-[8px] border border-border bg-card p-3">
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <c.icon size={12} className="text-amber-500" /> {c.label}
                  </p>
                  <p className="mt-0.5 font-mono text-lg font-bold text-foreground">{c.valor}</p>
                  <p className="text-[10px] capitalize text-muted-foreground">{c.detalle}</p>
                </div>
              ))}
            </div>

            {/* Evolución — se dibuja siempre, tenga los aumentos que tenga */}
            <div className="rounded-[8px] border border-border bg-card p-4 shadow-sm">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Evolución de aumentos</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Barras: % de cada mes{hayInteranual ? " (las ámbar oscuras son interanuales: un solo % por el año)" : ""}.
                    Línea: acumulado compuesto en el rango elegido.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { k: "12m", d: addMonths(hoyMes, -11) },
                    { k: "24m", d: addMonths(hoyMes, -23) },
                    { k: "Todo", d: "" },
                  ].map((r) => {
                    const activo = (desdeMes ? `${desdeMes}-01` : "") === r.d && !hastaMes;
                    return (
                      <button
                        key={r.k}
                        type="button"
                        onClick={() => {
                          setDesdeMes(r.d ? r.d.slice(0, 7) : "");
                          setHastaMes("");
                        }}
                        className={`h-7 rounded-[6px] border px-2 text-[11px] transition-colors ${
                          activo
                            ? "border-primary/50 bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {r.k}
                      </button>
                    );
                  })}
                  <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    Desde
                    <input
                      type="month"
                      value={desdeMes || (rangoDefault?.desde.slice(0, 7) ?? "")}
                      onChange={(e) => setDesdeMes(e.target.value)}
                      className="h-7 rounded-[6px] border border-border bg-background px-1.5 text-[11px] text-foreground"
                    />
                  </label>
                  <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    Hasta
                    <input
                      type="month"
                      value={hastaMes || (rangoDefault?.hasta.slice(0, 7) ?? "")}
                      onChange={(e) => setHastaMes(e.target.value)}
                      className="h-7 rounded-[6px] border border-border bg-background px-1.5 text-[11px] text-foreground"
                    />
                  </label>
                </div>
              </div>

              {serie.length > 0 ? (
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
                          <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
                            <p className="font-semibold capitalize text-foreground">{mesLargo(d.mes)}</p>
                            {d.anual != null && <p className="text-amber-700">Interanual: {pctAr(d.anual)}</p>}
                            {d.pct != null && <p className="text-amber-600">Aumento del mes: {pctAr(d.pct)}</p>}
                            {d.pct == null && d.anual == null && <p className="text-muted-foreground">Sin aumento</p>}
                            <p className="text-[#0088D1]">Acumulado: {pctAr(d.acumulado, 1)}</p>
                          </div>
                        );
                      }}
                    />
                    <Bar yAxisId="mes" dataKey="pct" fill="#F59E0B" radius={[3, 3, 0, 0]} maxBarSize={26} />
                    <Bar yAxisId="mes" dataKey="anual" fill="#B45309" radius={[3, 3, 0, 0]} maxBarSize={26} />
                    <Line yAxisId="acum" type="monotone" dataKey="acumulado" stroke="#0088D1" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="grid h-[220px] place-items-center rounded-[6px] border border-dashed border-border">
                  <p className="max-w-sm px-4 text-center text-xs text-muted-foreground">
                    {actual.aumentos.length === 0
                      ? `Todavía no hay aumentos cargados de ${actual.nombre}. A medida que los cargues, el gráfico se arma solo.`
                      : "No hay aumentos en el rango elegido."}
                  </p>
                </div>
              )}
            </div>

            {/* Tarifas del cliente */}
            <div className="overflow-hidden rounded-[8px] border border-border bg-card shadow-sm">
              <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
                <h3 className="text-sm font-semibold text-foreground">Tarifas</h3>
                <span className="text-[11px] text-muted-foreground">
                  {actual.tarifas.length} cargada{actual.tarifas.length === 1 ? "" : "s"}
                </span>
              </div>
              {actual.tarifas.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-muted-foreground">
                  {actual.nombre} no tiene tarifas propias: los fletes se calculan con los valores base de la Calculadora.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-muted/40">
                    <tr className="text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      <th className="px-4 py-2.5">Ruta</th>
                      <th className="px-4 py-2.5">Modalidad</th>
                      <th className="px-4 py-2.5 text-right">Valor</th>
                      <th className="px-4 py-2.5">Vigencia</th>
                      <th className="px-4 py-2.5">Estado</th>
                      <th className="px-4 py-2.5 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {actual.tarifas.map((t) => {
                      const meta = getModalidadMeta(t.modalidad);
                      return (
                        <tr key={t.id} className="hover:bg-muted/40">
                          <td className="px-4 py-3 text-foreground">
                            {t.ruta_label ?? <span className="italic text-muted-foreground/70">Sin ruta específica</span>}
                            {t.ruta_km !== null && <p className="text-[11px] text-muted-foreground/70">{t.ruta_km} km</p>}
                          </td>
                          <td className="px-4 py-3">
                            <span className="rounded bg-[#E1F5FE] px-2 py-0.5 text-xs font-medium text-[#004A99]">{meta.label}</span>
                            <p className="mt-0.5 text-[11px] text-muted-foreground/70">{meta.unidad}</p>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-semibold text-foreground">
                            {fmtValor(Number(t.valor), t.moneda)}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            <p>Desde: {fmtFecha(t.vigencia_desde)}</p>
                            <p>Hasta: {fmtFecha(t.vigencia_hasta)}</p>
                          </td>
                          <td className="px-4 py-3">
                            {t.activa ? (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-[#10B981]">
                                <CheckCircle2 size={12} /> Activa
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground/70">
                                <XCircle size={12} /> Inactiva
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              {canWrite && (
                                <>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() => {
                                      setTarifaEditar(t);
                                      setModalTarifa(true);
                                    }}
                                    aria-label="Editar"
                                  >
                                    <Pencil size={12} />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() => onToggleActiva(t)}
                                    aria-label={t.activa ? "Desactivar" : "Activar"}
                                    className={t.activa ? "text-[#FFB300]" : "text-[#10B981]"}
                                  >
                                    {t.activa ? <PauseCircle size={12} /> : <CheckCircle2 size={12} />}
                                  </Button>
                                </>
                              )}
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => {
                                  setHistorialId(t.id);
                                  setHistorialLabel(`${t.cliente_nombre} · ${t.ruta_label ?? "Sin ruta específica"}`);
                                }}
                                aria-label="Ver historial"
                                className="text-muted-foreground/70 hover:text-primary"
                              >
                                <History size={12} />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Historial de aumentos */}
            <div className="overflow-hidden rounded-[8px] border border-border bg-card shadow-sm">
              <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
                <h3 className="text-sm font-semibold text-foreground">Aumentos</h3>
                <span className="text-[11px] text-muted-foreground">
                  {actual.aumentos.length} cargado{actual.aumentos.length === 1 ? "" : "s"}
                </span>
              </div>
              {actual.aumentos.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-muted-foreground">
                  Cuando {actual.nombre} informe un aumento de tarifa, cargalo con “Cargar aumento”.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-muted/40">
                    <tr className="text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      <th className="px-4 py-2.5">Vigente desde</th>
                      <th className="px-4 py-2.5 text-right">Aumento</th>
                      <th className="px-4 py-2.5">Observaciones</th>
                      <th className="px-4 py-2.5">Cargado</th>
                      {canWrite && <th className="px-4 py-2.5 text-right">Acciones</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {[...actual.aumentos].reverse().map((a) => (
                      <tr key={a.id} className="hover:bg-muted/40">
                        <td className="whitespace-nowrap px-4 py-2.5 capitalize text-foreground">
                          {mesLargo(a.vigenteDesde)}
                          {esInteranual(a) && (
                            <span className="ml-2 rounded-[4px] border border-amber-500/30 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                              Interanual
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono font-semibold text-amber-600 dark:text-amber-400">
                          {pctAr(a.porcentaje)}
                        </td>
                        <td className="max-w-[360px] px-4 py-2.5 text-[12px] text-muted-foreground">
                          <span className="line-clamp-2">{a.observaciones ?? "—"}</span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-[11px] text-muted-foreground">
                          {fechaCorta(a.createdAt)}
                          {a.createdByNombre ? ` · ${a.createdByNombre}` : ""}
                        </td>
                        {canWrite && (
                          <td className="px-4 py-2.5 text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => onEliminarAumento(a)}
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
              )}
            </div>
          </div>
        )}
      </div>

      <ModalNuevaTarifa
        open={modalTarifa}
        onClose={() => {
          setModalTarifa(false);
          setTarifaEditar(null);
        }}
        onSaved={onTarifaSaved}
        clientes={clientes}
        rutas={rutas}
        tarifa={tarifaEditar}
      />

      <TarifaHistorialDrawer
        open={historialId !== null}
        onClose={() => setHistorialId(null)}
        tarifaId={historialId}
        tarifaLabel={historialLabel}
      />

      {aumentoOpen && (
        <CargarAumentoDialog
          open
          onClose={() => setAumentoOpen(false)}
          onSaved={onAumentoSaved}
          clientes={clientes}
          defaultClienteId={actual?.clienteId ?? undefined}
          defaultClienteNombre={actual?.clienteId ? undefined : actual?.nombre}
        />
      )}
    </div>
  );
}
