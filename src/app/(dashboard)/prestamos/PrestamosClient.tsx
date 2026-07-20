"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  PiggyBank,
  CalendarClock,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  Trash2,
  Pencil,
  Landmark,
  BarChart3,
  Bell,
  CalendarDays,
  Sunrise,
} from "lucide-react";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  LabelList,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import AddPrestamoDialog from "./AddPrestamoDialog";
import {
  setCuotaPagadaAction,
  updateCuotaAction,
  deletePrestamoAction,
  type PrestamoRow,
  type CuotaRow,
} from "./actions";

const BRAND = "#0088D1";

const ars = (n: number) => `$ ${Math.round(n).toLocaleString("es-AR")}`;

/** Monto compacto para etiquetas del gráfico ($1,4M / $340k / $250). */
function arsCompacto(n: number): string {
  if (n >= 1_000_000)
    return `$${(n / 1_000_000).toLocaleString("es-AR", { maximumFractionDigits: 1 })}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}

function fmtFecha(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** Lunes de la semana de una fecha (ISO YYYY-MM-DD), como Date local. */
function lunesDe(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  const f = new Date(y!, m! - 1, d!);
  const dow = (f.getDay() + 6) % 7; // 0 = lunes
  f.setDate(f.getDate() - dow);
  return f;
}

function keySemana(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const DIAS_CORTOS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

/** Paleta del módulo — variedad sin caer en arcoíris (pedido de Bárbara). */
const VIOLETA = "#7C3AED";
const AMBAR = "#F59E0B";

/** Suma días a una fecha ISO respetando el calendario local (no UTC). */
function addDiasISO(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y!, m! - 1, d! + n);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

/** Etiqueta corta para el gráfico diario ("mar 22"). */
function labelDia(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y!, m! - 1, d!);
  return `${DIAS_CORTOS[dt.getDay()]} ${dt.getDate()}`;
}

/** "2026-08" → "Agosto 2026". */
function labelMes(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${MESES[m! - 1]} ${y}`;
}

function labelSemana(lunes: Date): string {
  const fin = new Date(lunes);
  fin.setDate(fin.getDate() + 6);
  const mismoMes = lunes.getMonth() === fin.getMonth();
  return mismoMes
    ? `${lunes.getDate()}–${fin.getDate()} ${MESES_CORTOS[lunes.getMonth()]}`
    : `${lunes.getDate()} ${MESES_CORTOS[lunes.getMonth()]} – ${fin.getDate()} ${MESES_CORTOS[fin.getMonth()]}`;
}

/** Iniciales del banco para el badge (Nación → NA, Banco Galicia → BG). */
function inicialesBanco(banco: string): string {
  const palabras = banco.trim().split(/\s+/).filter((w) => w.toLowerCase() !== "banco");
  if (palabras.length >= 2) return (palabras[0][0] + palabras[1][0]).toUpperCase();
  return banco.replace(/^banco\s+/i, "").slice(0, 2).toUpperCase();
}

function BankBadge({ banco, size = 32 }: { banco: string; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-lg font-semibold text-[#0088D1]"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.34,
        background: "rgba(0,136,209,0.12)",
      }}
    >
      {inicialesBanco(banco)}
    </span>
  );
}

export default function PrestamosClient({
  prestamos,
  canWrite,
}: {
  prestamos: PrestamoRow[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDelId, setConfirmDelId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editCuota, setEditCuota] = useState<(CuotaRow & { banco: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const hoy = new Date().toISOString().slice(0, 10);
  const [mesSel, setMesSel] = useState(hoy.slice(0, 7));

  // Todas las cuotas impagas de préstamos activos, ordenadas por vencimiento.
  const cuotasPendientes = useMemo(() => {
    return prestamos
      .filter((p) => p.estado === "activo")
      .flatMap((p) =>
        p.cuotas
          .filter((c) => !c.pagada)
          .map((c) => ({ ...c, banco: p.banco, tasa: p.tasa, cuotas_total: p.cuotas_total })),
      )
      .sort((a, b) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento));
  }, [prestamos]);

  const vencidas = cuotasPendientes.filter((c) => c.fecha_vencimiento < hoy);

  // Carga por semana: la actual + las próximas 7 (lo que pidió Bárbara para
  // decidir en qué semana conviene pagar/financiar).
  const semanas = useMemo(() => {
    const inicio = lunesDe(hoy);
    const buckets: { lunes: Date; total: number; cuotas: number }[] = Array.from(
      { length: 8 },
      (_, i) => {
        const lunes = new Date(inicio);
        lunes.setDate(lunes.getDate() + i * 7);
        return { lunes, total: 0, cuotas: 0 };
      },
    );
    const idxPorKey = new Map(buckets.map((b, i) => [keySemana(b.lunes), i]));
    for (const c of cuotasPendientes) {
      const idx = idxPorKey.get(keySemana(lunesDe(c.fecha_vencimiento)));
      if (idx == null) continue;
      buckets[idx].total += c.importe;
      buckets[idx].cuotas += 1;
    }
    return buckets;
  }, [cuotasPendientes, hoy]);

  const chartData = useMemo(
    () =>
      semanas.map((s, i) => ({
        label: i === 0 ? "Esta semana" : labelSemana(s.lunes),
        total: s.total,
        cuotas: s.cuotas,
        isCurrent: i === 0,
      })),
    [semanas],
  );
  const hayCargaSemanal = semanas.some((s) => s.total > 0);

  const finDeSemana = (() => {
    const fin = new Date(lunesDe(hoy));
    fin.setDate(fin.getDate() + 6);
    return keySemana(fin);
  })();
  const cuotasSemana = cuotasPendientes.filter(
    (c) => c.fecha_vencimiento >= hoy && c.fecha_vencimiento <= finDeSemana,
  );
  const totalSemana = cuotasSemana.reduce((s, c) => s + c.importe, 0);
  // Mes elegible a futuro (Bárbara: "el mes que viene, agosto, ¿cuánto tengo
  // que pagar?"). Arranca en el mes actual y ofrece los 12 siguientes.
  const mesActual = hoy.slice(0, 7);
  const mesesOpciones = useMemo(() => {
    const y0 = Number(mesActual.slice(0, 4));
    const m0 = Number(mesActual.slice(5, 7)) - 1;
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(y0, m0 + i, 1);
      const id = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return { id, label: labelMes(id) };
    });
  }, [mesActual]);

  const cuotasMes = cuotasPendientes.filter((c) => c.fecha_vencimiento.slice(0, 7) === mesSel);
  const totalMes = cuotasMes.reduce((s, c) => s + c.importe, 0);
  const esMesActual = mesSel === mesActual;

  // "Mañana tenés que pagar esto" — el pedido textual de Bárbara.
  const manana = addDiasISO(hoy, 1);
  const cuotasManana = cuotasPendientes.filter((c) => c.fecha_vencimiento === manana);
  const totalManana = cuotasManana.reduce((s, c) => s + c.importe, 0);

  // Carga día a día: hoy + los próximos 13 (el "cuánto hay que pagar en el día"
  // que pidió como gráfico aparte del semanal).
  const dias = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => {
      const iso = addDiasISO(hoy, i);
      const delDia = cuotasPendientes.filter((c) => c.fecha_vencimiento === iso);
      return {
        iso,
        label: i === 0 ? "Hoy" : i === 1 ? "Mañana" : labelDia(iso),
        total: delDia.reduce((s, c) => s + c.importe, 0),
        cuotas: delDia.length,
        isToday: i === 0,
      };
    });
  }, [cuotasPendientes, hoy]);
  const hayCargaDiaria = dias.some((d) => d.total > 0);

  const totalDeuda = prestamos.reduce((s, p) => s + p.restante, 0);

  const togglePagada = (cuotaId: string, pagada: boolean) => {
    setSavingId(cuotaId);
    setError(null);
    startTransition(async () => {
      const res = await setCuotaPagadaAction(cuotaId, pagada);
      setSavingId(null);
      if ("error" in res) setError(res.error);
      else router.refresh();
    });
  };

  const borrarPrestamo = (id: string) => {
    setSavingId(id);
    setError(null);
    startTransition(async () => {
      const res = await deletePrestamoAction(id);
      setSavingId(null);
      setConfirmDelId(null);
      if ("error" in res) setError(res.error);
      else router.refresh();
    });
  };

  const nCols = canWrite ? 8 : 7;

  return (
    <div className="space-y-5">
      {error && (
        <div className="flex items-start gap-2 rounded-[10px] border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError(null)} className="hover:underline text-xs">
            Cerrar
          </button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={Sunrise}
          iconColor="text-amber-600"
          iconBg="bg-amber-500/10"
          label="A pagar mañana"
          value={ars(totalManana)}
          hint={
            cuotasManana.length
              ? `${cuotasManana.length} cuota${cuotasManana.length > 1 ? "s" : ""} vence${cuotasManana.length > 1 ? "n" : ""} mañana`
              : "Mañana no vence nada"
          }
        />
        <KpiCard
          icon={CalendarClock}
          iconColor="text-sky-600"
          iconBg="bg-sky-500/10"
          label="A pagar esta semana"
          value={ars(totalSemana)}
          hint={
            cuotasSemana.length
              ? `${cuotasSemana.length} cuota${cuotasSemana.length > 1 ? "s" : ""} por vencer`
              : "Sin vencimientos esta semana"
          }
        />
        <KpiHero
          label={`A pagar en ${labelMes(mesSel)}`}
          value={ars(totalMes)}
          hint={
            cuotasMes.length
              ? `${cuotasMes.length} cuota${cuotasMes.length > 1 ? "s" : ""} ${esMesActual ? "este mes" : "ese mes"}`
              : `Sin cuotas en ${labelMes(mesSel)}`
          }
          action={
            <Combobox
              value={mesSel}
              onValueChange={setMesSel}
              options={mesesOpciones}
              aria-label="Elegir mes"
              triggerClassName="h-7 w-[150px] border-white/30 bg-white/15 text-white text-xs hover:bg-white/25"
            />
          }
        />
        <KpiCard
          icon={vencidas.length > 0 ? AlertTriangle : CheckCircle2}
          iconColor={vencidas.length > 0 ? "text-red-600" : "text-emerald-600"}
          iconBg={vencidas.length > 0 ? "bg-red-500/10" : "bg-emerald-500/10"}
          label="Cuotas vencidas sin pagar"
          value={String(vencidas.length)}
          valueTone={vencidas.length > 0 ? "text-red-600" : "text-emerald-600"}
          hint={vencidas.length > 0 ? "Marcalas como pagadas si ya se abonaron" : "Todo al día ✓"}
        />
      </div>

      {/* Carga diaria — pedido de Bárbara: además de semana y mes, "cuánto hay
          que pagar en el día", en un gráfico aparte. */}
      <div className="rounded-[12px] border border-border bg-card p-5 shadow-sm">
        <div className="mb-1 flex items-center gap-2">
          <CalendarDays size={16} style={{ color: VIOLETA }} />
          <h2 className="text-sm font-semibold text-foreground">Cuánto hay que pagar por día</h2>
        </div>
        <p className="mb-4 text-[11px] text-muted-foreground">
          Los próximos 14 días, uno por uno — para saber qué cae mañana y qué cae pasado.
        </p>
        {hayCargaDiaria ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dias} margin={{ top: 18, right: 8, bottom: 2, left: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="label"
                interval={0}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              />
              <YAxis hide />
              <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.35 }} content={<ChartTooltip />} />
              <Bar dataKey="total" radius={[4, 4, 0, 0]} isAnimationActive={false} minPointSize={2}>
                {dias.map((d, i) => (
                  <Cell key={i} fill={d.isToday ? AMBAR : VIOLETA} fillOpacity={d.isToday ? 1 : 0.55} />
                ))}
                <LabelList dataKey="total" content={<MoneyLabel vertical />} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No vence ninguna cuota en los próximos 14 días.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Carga semanal (idea de Bárbara: "la tercera semana de agosto la tengo
            compleja, dejemos los pagos para la primera y la cuarta") */}
        <div className="rounded-[12px] border border-border bg-card p-5 shadow-sm">
          <div className="mb-1 flex items-center gap-2">
            <BarChart3 size={16} className="text-[#0088D1]" />
            <h2 className="text-sm font-semibold text-foreground">Cuánto hay que pagar por semana</h2>
          </div>
          <p className="mb-4 text-[11px] text-muted-foreground">
            Las próximas 8 semanas — para decidir en cuál conviene pagar o financiar.
          </p>
          {hayCargaSemanal ? (
            <ResponsiveContainer width="100%" height={288}>
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 2, right: 60, bottom: 2, left: 6 }}
                barCategoryGap={9}
              >
                <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={94}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                />
                <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.35 }} content={<ChartTooltip />} />
                <Bar dataKey="total" radius={[0, 4, 4, 0]} isAnimationActive={false} minPointSize={2}>
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={BRAND} fillOpacity={d.isCurrent ? 1 : 0.42} />
                  ))}
                  <LabelList dataKey="total" content={<MoneyLabel />} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-14 text-center text-sm text-muted-foreground">
              Sin cuotas en las próximas 8 semanas.
            </p>
          )}
        </div>

        {/* Próximos vencimientos */}
        <div className="overflow-hidden rounded-[12px] border border-border bg-card shadow-sm">
          <div className="flex items-center gap-2 border-b border-border px-5 py-3">
            <Bell size={15} className="text-[#0088D1]" />
            <h2 className="text-sm font-semibold text-foreground">Próximos vencimientos</h2>
          </div>
          {cuotasPendientes.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">
              Sin cuotas pendientes. Cargá un préstamo para empezar.
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {cuotasPendientes.slice(0, 8).map((c) => {
                const vencida = c.fecha_vencimiento < hoy;
                return (
                  <li key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                    <BankBadge banco={c.banco} size={30} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {c.banco}{" "}
                        <span className="font-normal text-muted-foreground">
                          · cuota {c.nro}/{c.cuotas_total}
                          {c.tasa != null ? ` · ${c.tasa.toLocaleString("es-AR")}%` : ""}
                        </span>
                      </p>
                      <p
                        className={`text-xs ${vencida ? "font-semibold text-red-600" : "text-muted-foreground"}`}
                      >
                        {vencida ? "Venció el " : "Vence el "}
                        {fmtFecha(c.fecha_vencimiento)}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                      {ars(c.importe)}
                    </span>
                    {canWrite && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 shrink-0 px-2 text-xs"
                        disabled={savingId === c.id}
                        onClick={() => togglePagada(c.id, true)}
                      >
                        {savingId === c.id ? <Loader2 size={12} className="animate-spin" /> : "Pagada"}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Préstamos */}
      <div className="overflow-hidden rounded-[12px] border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <Landmark size={15} className="text-[#0088D1]" />
            <h2 className="text-sm font-semibold text-foreground">
              Préstamos{" "}
              <span className="font-normal text-muted-foreground">({prestamos.length})</span>
            </h2>
            {totalDeuda > 0 && (
              <span className="hidden rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground sm:inline">
                Falta pagar {ars(totalDeuda)}
              </span>
            )}
          </div>
          {canWrite && <AddPrestamoDialog />}
        </div>
        {prestamos.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#0088D1]/10">
              <PiggyBank size={22} className="text-[#0088D1]" />
            </div>
            <p className="text-sm text-muted-foreground">
              Sin préstamos cargados. Empezá con la planilla: banco, importe de cuota, número de
              cuota y tasa.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-semibold">Banco</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Tasa</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Cuota</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Progreso</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Próxima cuota</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Última cuota</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Falta pagar</th>
                  {canWrite && <th className="px-3 py-2.5" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {prestamos.map((p) => {
                  const abierto = expandedId === p.id;
                  const ultima = p.cuotas[p.cuotas.length - 1]?.fecha_vencimiento ?? null;
                  const pct = Math.round((p.pagadas / p.cuotas_total) * 100);
                  return (
                    <Fragment key={p.id}>
                      <tr
                        className="cursor-pointer transition-colors hover:bg-muted/30"
                        onClick={() => setExpandedId(abierto ? null : p.id)}
                        title="Ver cronograma de cuotas"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            {abierto ? (
                              <ChevronDown size={14} className="shrink-0 text-muted-foreground" />
                            ) : (
                              <ChevronRight size={14} className="shrink-0 text-muted-foreground" />
                            )}
                            <BankBadge banco={p.banco} size={30} />
                            <span className="font-medium text-foreground">
                              {p.banco}
                              {p.detalle && (
                                <span className="ml-1 text-xs font-normal text-muted-foreground">
                                  · {p.detalle}
                                </span>
                              )}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {p.tasa != null ? `${p.tasa.toLocaleString("es-AR")}%` : "—"}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-foreground">
                          {ars(p.importe_cuota)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-emerald-500"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="tabular-nums text-xs text-muted-foreground">
                              {p.pagadas}/{p.cuotas_total}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {p.proxima ? fmtFecha(p.proxima.fecha_vencimiento) : "Cancelado ✅"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {ultima ? fmtFecha(ultima) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">
                          {p.restante > 0 ? ars(p.restante) : "—"}
                        </td>
                        {canWrite && (
                          <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => setConfirmDelId(p.id)}
                              className="rounded p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                              title="Eliminar préstamo"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        )}
                      </tr>
                      {confirmDelId === p.id && (
                        <tr className="bg-red-50">
                          <td colSpan={nCols} className="px-4 py-2.5 text-xs text-red-700">
                            <span className="font-semibold">
                              ¿Eliminar el préstamo de {p.banco} con todo su cronograma?
                            </span>
                            <button
                              type="button"
                              disabled={savingId === p.id}
                              onClick={() => borrarPrestamo(p.id)}
                              className="ml-3 h-6 rounded bg-red-600 px-2 font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                            >
                              Sí, eliminar
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDelId(null)}
                              className="ml-2 h-6 rounded border border-red-200 px-2 hover:bg-red-100"
                            >
                              Cancelar
                            </button>
                          </td>
                        </tr>
                      )}
                      {abierto && (
                        <tr className="bg-muted/20">
                          <td colSpan={nCols} className="px-5 py-3">
                            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-6">
                              {p.cuotas.map((c) => {
                                const vencida = !c.pagada && c.fecha_vencimiento < hoy;
                                return (
                                  <div
                                    key={c.id}
                                    className={`flex items-center justify-between gap-1.5 rounded-md border px-2 py-1.5 text-xs ${
                                      c.pagada
                                        ? "border-emerald-200 bg-emerald-50/60 text-emerald-800"
                                        : vencida
                                          ? "border-red-200 bg-red-50/70 text-red-700"
                                          : "border-border bg-card text-foreground"
                                    }`}
                                  >
                                    <label className="flex min-w-0 cursor-pointer items-center gap-1.5">
                                      <input
                                        type="checkbox"
                                        checked={c.pagada}
                                        disabled={!canWrite || savingId === c.id}
                                        onChange={(e) => togglePagada(c.id, e.target.checked)}
                                        className="h-3.5 w-3.5 shrink-0 cursor-pointer accent-emerald-600"
                                        title={c.pagada ? "Marcar como no pagada" : "Marcar como pagada"}
                                      />
                                      <span className="truncate">
                                        <b className="tabular-nums">{c.nro}</b> ·{" "}
                                        {fmtFecha(c.fecha_vencimiento)}
                                      </span>
                                    </label>
                                    {canWrite && (
                                      <button
                                        type="button"
                                        onClick={() => setEditCuota({ ...c, banco: p.banco })}
                                        className="shrink-0 rounded p-0.5 text-muted-foreground/60 hover:text-primary"
                                        title={`Editar cuota (${ars(c.importe)})`}
                                      >
                                        <Pencil size={11} />
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editCuota && (
        <EditarCuotaDialog
          cuota={editCuota}
          onClose={() => setEditCuota(null)}
          onSaved={() => {
            setEditCuota(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

/** Etiqueta de monto al final de cada barra del gráfico (oculta si es 0). */
function MoneyLabel(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  value?: number;
  /** Barras verticales (gráfico diario): la etiqueta va arriba, centrada. */
  vertical?: boolean;
}) {
  const { x = 0, y = 0, width = 0, height = 0, value = 0, vertical = false } = props;
  if (!value || value <= 0) return null;
  return (
    <text
      x={vertical ? x + width / 2 : x + width + 6}
      y={vertical ? y - 6 : y + height / 2}
      textAnchor={vertical ? "middle" : "start"}
      dominantBaseline={vertical ? "auto" : "central"}
      fontSize={vertical ? 10 : 11}
      fontWeight={600}
      fill="var(--foreground)"
    >
      {arsCompacto(value)}
    </text>
  );
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: { label: string; total: number; cuotas: number } }[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-foreground">{d.label}</p>
      <p className="mt-0.5 tabular-nums text-[#0088D1]">{ars(d.total)}</p>
      <p className="text-muted-foreground">
        {d.cuotas} cuota{d.cuotas !== 1 ? "s" : ""}
      </p>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  iconColor,
  iconBg,
  label,
  value,
  valueTone = "text-foreground",
  hint,
}: {
  icon: typeof PiggyBank;
  iconColor: string;
  iconBg: string;
  label: string;
  value: string;
  valueTone?: string;
  hint?: string;
}) {
  return (
    <div className="rounded-[12px] border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2.5">
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconBg}`}>
          <Icon size={16} className={iconColor} />
        </span>
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
      </div>
      <p className={`mt-3 text-[26px] font-bold leading-none tabular-nums ${valueTone}`}>{value}</p>
      {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Card destacado (el foco de la pantalla): fondo de marca, texto claro. */
function KpiHero({
  label,
  value,
  hint,
  action,
}: {
  label: string;
  value: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      className="rounded-[12px] p-5 shadow-sm"
      style={{ background: "linear-gradient(135deg, #0088D1 0%, #0072B0 100%)" }}
    >
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20">
          <PiggyBank size={16} className="text-white" />
        </span>
        <span className="min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-wide text-white/80">
          {label}
        </span>
        {action}
      </div>
      <p className="mt-3 text-[26px] font-bold leading-none tabular-nums text-white">{value}</p>
      {hint && <p className="mt-2 text-xs text-white/70">{hint}</p>}
    </div>
  );
}

/** Corrección puntual de una cuota: fecha y/o importe (la planilla manda). */
function EditarCuotaDialog({
  cuota,
  onClose,
  onSaved,
}: {
  cuota: CuotaRow & { banco: string };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [fecha, setFecha] = useState(cuota.fecha_vencimiento);
  const [importe, setImporte] = useState(String(cuota.importe || ""));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const guardar = () => {
    setError(null);
    startTransition(async () => {
      const res = await updateCuotaAction(cuota.id, {
        fecha_vencimiento: fecha,
        importe: importe.trim() === "" ? undefined : Number(importe) || 0,
      });
      if ("error" in res) setError(res.error);
      else onSaved();
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !isPending && onClose()}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle>
            Cuota {cuota.nro} — {cuota.banco}
          </DialogTitle>
          <DialogDescription>
            Corregí la fecha de vencimiento o el importe de esta cuota puntual.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="cuota-fecha" className="text-xs font-medium text-muted-foreground">
              Fecha de vencimiento
            </Label>
            <Input
              id="cuota-fecha"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cuota-importe" className="text-xs font-medium text-muted-foreground">
              Importe $
            </Label>
            <Input
              id="cuota-importe"
              type="number"
              min="0"
              value={importe}
              onChange={(e) => setImporte(e.target.value)}
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button variant="brand" size="sm" onClick={guardar} disabled={isPending}>
            {isPending ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
