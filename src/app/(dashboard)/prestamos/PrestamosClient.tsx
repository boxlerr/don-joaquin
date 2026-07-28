"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  PiggyBank,
  CalendarClock,
  AlertTriangle,
  Search,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Trash2,
  History,
  CalendarCheck,
  BellRing,
  Repeat,
  Pencil,
  Landmark,
  BarChart3,
  Bell,
  CalendarDays,
  CalendarRange,
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
import EditPrestamoDialog from "./EditPrestamoDialog";
import { inicialesBanco, marcaBanco } from "./bancos";
import { textoFaltantes, tieneFaltantes } from "./faltantes";
import { formatoVariacion, variacionCuota } from "./variacion";
import TopesDialog from "./TopesDialog";
import FechasDelMesDialog from "./FechasDelMesDialog";
import HistorialPagosDialog from "./HistorialPagosDialog";
import { excedeTope, hayAlgunTope, nivel, TOPES_DEFAULT, type TopesConfig } from "./topes";
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
const ROJO_TOPE = "#DC2626";
const VIOLETA = "#7C3AED";
const AMBAR = "#F59E0B";
const TEAL = "#0D9488";

/** Escalas de tiempo del gráfico de carga de pagos. */
type VistaGrafico = "dia" | "semana" | "mes";

const VISTAS: { id: VistaGrafico; label: string }[] = [
  { id: "dia", label: "Día" },
  { id: "semana", label: "Semana" },
  { id: "mes", label: "Mes" },
];

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

/**
 * Identificador visual del banco.
 *
 * Los logos de banco son wordmarks apaisados y de proporciones muy distintas
 * entre sí (Santander es 5.7:1, Credicoop 2:1), así que el que manda es el
 * ALTO: todos entran en una franja de la misma altura y cada uno usa el ancho
 * que necesita, sin marco ni fondo. Si se ajustara por ancho, "Banco Nación"
 * quedaría ilegible y el bloque gris de Credicoop se comería la fila.
 *
 * Dentro de esa franja el logo va CENTRADO: los angostos (Credicoop, BBVA) no
 * llenan el ancho, y pegados a la izquierda quedaban corridos respecto de los
 * que sí lo llenan (Santander, Nación).
 *
 * Sin logo, las iniciales con el color de la marca — no todas en el mismo azul,
 * que era imposible distinguir de un vistazo.
 */
function BankBadge({ banco, alto = 20 }: { banco: string; alto?: number }) {
  const { logo, color } = marcaBanco(banco);
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center"
      style={{ width: alto * 4.2, height: alto }}
      title={banco}
    >
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element -- SVG local: no hay nada que optimizar
        <img src={logo} alt="" className="max-h-full max-w-full object-contain" />
      ) : (
        <span
          className="flex items-center justify-center rounded-[4px] font-semibold"
          style={{
            width: alto,
            height: alto,
            color,
            fontSize: alto * 0.48,
            background: `${color}14`,
          }}
        >
          {inicialesBanco(banco)}
        </span>
      )}
    </span>
  );
}


/** Criterios de orden del listado de préstamos. */
type OrdenPrestamo = "proxima" | "cuota" | "deuda" | "tasa" | "cuotas" | "banco";

const ORDEN_LABEL: Record<OrdenPrestamo, string> = {
  proxima: "Próxima cuota",
  cuota: "Cuota (mayor)",
  deuda: "Falta pagar (mayor)",
  tasa: "Tasa (mayor)",
  cuotas: "Cuotas restantes",
  banco: "Banco (A-Z)",
};

export default function PrestamosClient({
  prestamos,
  canWrite,
  topes = TOPES_DEFAULT,
}: {
  prestamos: PrestamoRow[];
  canWrite: boolean;
  /** A partir de cuánta plata por día/semana/mes hay que avisar en rojo. */
  topes?: TopesConfig;
}) {
  const [topesOpen, setTopesOpen] = useState(false);
  const [fechasOpen, setFechasOpen] = useState(false);
  const [historialOpen, setHistorialOpen] = useState(false);
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Filtros y orden del listado: con 35 préstamos de 6 bancos, buscar a ojo no va.
  const [fBanco, setFBanco] = useState("todos");
  const [fEstado, setFEstado] = useState<"todos" | "activos" | "cancelados" | "incompletos">("todos");
  const [busqueda, setBusqueda] = useState("");
  const [orden, setOrden] = useState<OrdenPrestamo>("banco");
  const [confirmDelId, setConfirmDelId] = useState<string | null>(null);
  const [editPrestamo, setEditPrestamo] = useState<PrestamoRow | null>(null);
  const [editKey, setEditKey] = useState(0);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editCuota, setEditCuota] = useState<(CuotaRow & { banco: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const hoy = new Date().toISOString().slice(0, 10);
  const [mesSel, setMesSel] = useState(hoy.slice(0, 7));
  /** Un solo gráfico con tres escalas de tiempo (pedido: verlo de todas las formas). */
  const [vista, setVista] = useState<VistaGrafico>("semana");
  /** Desplazamiento de la ventana del gráfico: -1 = anterior, +1 = siguiente. */
  const [offset, setOffset] = useState(0);
  const cambiarVista = (v: VistaGrafico) => {
    setVista(v);
    setOffset(0);
  };

  // Todas las cuotas impagas de préstamos activos, ordenadas por vencimiento.
  /**
   * Los totales por día, semana y mes se agrupan por la fecha EFECTIVA: el día
   * en que el banco se puede pagar. La fecha del contrato no se toca —el
   * préstamo entró el sábado y así queda— pero la plata se suma el lunes, que
   * es cuando sale. Si no, el lunes muestra 30 millones cuando en realidad hay
   * que pagar 79 entre lo del sábado, lo del viernes feriado y lo propio.
   */
  const cuotasPendientes = useMemo(() => {
    return prestamos
      .filter((p) => p.estado === "activo")
      .flatMap((p) =>
        p.cuotas
          .filter((c) => !c.pagada)
          .map((c) => ({ ...c, banco: p.banco, tasa: p.tasa, cuotas_total: p.cuotas_total })),
      )
      .sort((a, b) => a.fecha_efectiva.localeCompare(b.fecha_efectiva));
  }, [prestamos]);

  const vencidas = cuotasPendientes.filter((c) => c.fecha_vencimiento < hoy);

  // Carga por semana: la actual + las próximas 7 (lo que pidió Bárbara para
  // decidir en qué semana conviene pagar/financiar).
  const semanas = useMemo(() => {
    const inicio = lunesDe(hoy);
    inicio.setDate(inicio.getDate() + offset * 8 * 7);
    const buckets: { lunes: Date; total: number; cuotas: number; corridas: number }[] =
      Array.from({ length: 8 }, (_, i) => {
        const lunes = new Date(inicio);
        lunes.setDate(lunes.getDate() + i * 7);
        return { lunes, total: 0, cuotas: 0, corridas: 0 };
      });
    const idxPorKey = new Map(buckets.map((b, i) => [keySemana(b.lunes), i]));
    for (const c of cuotasPendientes) {
      const idx = idxPorKey.get(keySemana(lunesDe(c.fecha_efectiva)));
      if (idx == null) continue;
      buckets[idx].total += c.importe;
      buckets[idx].cuotas += 1;
      if (c.motivo_corrimiento) buckets[idx].corridas += 1;
    }
    return buckets;
  }, [cuotasPendientes, hoy, offset]);

  // Períodos que se pasan del tope, para el aviso de arriba del gráfico. Se
  // calcula sobre los mismos datos que dibuja cada vista.
  // El tope es sólo mensual: la decisión de plata se toma por mes.
  const topeVista = vista === "mes" ? topes.mes : null;

  const chartData = useMemo(
    () =>
      semanas.map((s, i) => ({
        label: i === 0 && offset === 0 ? "Esta semana" : labelSemana(s.lunes),
        total: s.total,
        cuotas: s.cuotas,
        corridas: s.corridas,
        isCurrent: i === 0 && offset === 0,
      })),
    [semanas, offset],
  );
  const hayCargaSemanal = semanas.some((s) => s.total > 0);

  const finDeSemana = (() => {
    const fin = new Date(lunesDe(hoy));
    fin.setDate(fin.getDate() + 6);
    return keySemana(fin);
  })();
  const cuotasSemana = cuotasPendientes.filter(
    (c) => c.fecha_efectiva >= hoy && c.fecha_efectiva <= finDeSemana,
  );
  const totalSemana = cuotasSemana.reduce((s, c) => s + c.importe, 0);
  // Mes elegible (Bárbara: "el mes que viene, agosto, ¿cuánto tengo que
  // pagar?"). El rango sale de las cuotas reales — de la más vieja a la más
  // nueva — así se puede elegir cualquier mes con movimiento, no una ventana
  // fija de 12.
  const mesActual = hoy.slice(0, 7);
  const mesesOpciones = useMemo(() => {
    const todas = prestamos.flatMap((p) => p.cuotas.map((c) => c.fecha_efectiva.slice(0, 7)));
    const conActual = [...todas, mesActual].sort();
    const desde = conActual[0]!;
    const hasta = conActual[conActual.length - 1]!;
    const out: { id: string; label: string }[] = [];
    let y = Number(desde.slice(0, 4));
    let m = Number(desde.slice(5, 7));
    while (`${y}-${String(m).padStart(2, "0")}` <= hasta) {
      const id = `${y}-${String(m).padStart(2, "0")}`;
      out.push({ id, label: labelMes(id) });
      m += 1;
      if (m > 12) { m = 1; y += 1; }
    }
    return out;
  }, [prestamos, mesActual]);

  const cuotasMes = cuotasPendientes.filter((c) => c.fecha_efectiva.slice(0, 7) === mesSel);
  const totalMes = cuotasMes.reduce((s, c) => s + c.importe, 0);
  const esMesActual = mesSel === mesActual;

  // "Mañana tenés que pagar esto" — el pedido textual de Bárbara.
  const manana = addDiasISO(hoy, 1);
  const cuotasManana = cuotasPendientes.filter((c) => c.fecha_efectiva === manana);
  const totalManana = cuotasManana.reduce((s, c) => s + c.importe, 0);

  // Carga día a día: hoy + los próximos 13 (el "cuánto hay que pagar en el día"
  // que pidió como gráfico aparte del semanal).
  const dias = useMemo(() => {
    const base = addDiasISO(hoy, offset * 14);
    const manana = addDiasISO(hoy, 1);
    return Array.from({ length: 14 }, (_, i) => {
      const iso = addDiasISO(base, i);
      const delDia = cuotasPendientes.filter((c) => c.fecha_efectiva === iso);
      const esHoy = iso === hoy;
      return {
        iso,
        label: esHoy ? "Hoy" : iso === manana ? "Mañana" : labelDia(iso),
        total: delDia.reduce((s, c) => s + c.importe, 0),
        cuotas: delDia.length,
        corridas: delDia.filter((c) => c.motivo_corrimiento).length,
        isToday: esHoy,
      };
    });
  }, [cuotasPendientes, hoy, offset]);
  const hayCargaDiaria = dias.some((d) => d.total > 0);

  // Carga por mes: los próximos 12, para ver la película larga.
  const meses = useMemo(() => {
    const y0 = Number(mesActual.slice(0, 4));
    const m0 = Number(mesActual.slice(5, 7)) - 1;
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(y0, m0 + offset * 12 + i, 1);
      const id = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const delMes = cuotasPendientes.filter((c) => c.fecha_efectiva.slice(0, 7) === id);
      return {
        id,
        label: `${MESES_CORTOS[d.getMonth()]}${d.getMonth() === 0 || i === 0 ? ` ${String(d.getFullYear()).slice(2)}` : ""}`,
        total: delMes.reduce((s, c) => s + c.importe, 0),
        cuotas: delMes.length,
        corridas: delMes.filter((c) => c.motivo_corrimiento).length,
        isCurrent: id === mesActual,
      };
    });
  }, [cuotasPendientes, mesActual, offset]);
  const hayCargaMensual = meses.some((m) => m.total > 0);

  const excedidos = useMemo(() => {
    if (vista !== "mes") return [];
    return meses
      .map((m) => ({ label: m.label, total: m.total }))
      .map((f) => ({ ...f, e: excedeTope(f.total, topeVista) }))
      .filter((f): f is typeof f & { e: NonNullable<typeof f.e> } => f.e != null)
      .map((f) => ({ label: f.label, total: f.total, porcentaje: f.e.porcentaje }));
  }, [vista, meses, topeVista]);

  /** Rango que está mostrando el gráfico (reemplaza la bajada fija). */
  const rangoLabel = useMemo(() => {
    const corto = (iso: string) => {
      const [, m, d] = iso.split("-").map(Number);
      return `${d} ${MESES_CORTOS[m! - 1]}`;
    };
    if (vista === "dia") return `${corto(dias[0]!.iso)} – ${corto(dias[dias.length - 1]!.iso)}`;
    if (vista === "semana") {
      const fin = new Date(semanas[semanas.length - 1]!.lunes);
      fin.setDate(fin.getDate() + 6);
      return `${corto(keySemana(semanas[0]!.lunes))} – ${corto(keySemana(fin))}`;
    }
    return `${labelMes(meses[0]!.id)} – ${labelMes(meses[meses.length - 1]!.id)}`;
  }, [vista, dias, semanas, meses]);

  // Los préstamos a los que les falta información quedan fuera de los totales:
  // tienen la cuota en cero y sumarlos daría una deuda más baja que la real.
  const totalDeuda = prestamos
    .filter((p) => !tieneFaltantes(p) && p.moneda !== "USD" && !p.es_recurrente)
    .reduce((s, p) => s + p.restante, 0);

  const bancos = [...new Set(prestamos.map((p) => p.banco))].sort((a, b) => a.localeCompare(b));

  // Lo que se ve en la tabla: filtrado y ordenado. El total de arriba sigue
  // siendo el de TODOS los préstamos, para no confundir un filtro con la deuda.
  const visibles = prestamos
    .filter((p) => {
      if (fBanco !== "todos" && p.banco !== fBanco) return false;
      if (fEstado === "activos" && p.proxima == null) return false;
      if (fEstado === "cancelados" && p.proxima != null) return false;
      if (fEstado === "incompletos" && !tieneFaltantes(p)) return false;
      const q = busqueda.trim().toLowerCase();
      if (q && !`${p.banco} ${p.detalle ?? ""} ${p.referencia ?? ""}`.toLowerCase().includes(q))
        return false;
      return true;
    })
    .sort((a, b) => {
      switch (orden) {
        case "cuota":
          return b.importe_cuota - a.importe_cuota;
        case "deuda":
          return b.restante - a.restante;
        case "tasa":
          return (b.tasa ?? -1) - (a.tasa ?? -1);
        case "cuotas":
          return (b.cuotas_total - b.pagadas) - (a.cuotas_total - a.pagadas);
        case "banco":
          return a.banco.localeCompare(b.banco) || (a.detalle ?? "").localeCompare(b.detalle ?? "");
        default: {
          // Próxima cuota: los cancelados (sin próxima) al final.
          const fa = a.proxima?.fecha_efectiva ?? "9999";
          const fb = b.proxima?.fecha_efectiva ?? "9999";
          return fa.localeCompare(fb);
        }
      }
    });

  const deudaVisible = visibles
    .filter((p) => !tieneFaltantes(p) && p.moneda !== "USD" && !p.es_recurrente)
    .reduce((s, p) => s + p.restante, 0);
  const incompletos = prestamos.filter(tieneFaltantes).length;

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
        {/* El mes es parte del título: "A pagar en [Agosto 2026]". Antes el
            label competía por el espacio con el selector y quedaba en "A P…". */}
        <KpiHero
          label="A pagar en"
          value={ars(totalMes)}
          hint={
            cuotasMes.length
              ? `${cuotasMes.length} cuota${cuotasMes.length > 1 ? "s" : ""} ${esMesActual ? "este mes" : "ese mes"}`
              : `Sin cuotas en ${labelMes(mesSel)}`
          }
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Combobox
                value={mesSel}
                onValueChange={setMesSel}
                options={mesesOpciones}
                aria-label="Elegir mes"
                searchable
                triggerClassName="h-7 w-[152px] border-white/30 bg-white/15 text-white text-xs hover:bg-white/25"
              />
              {!esMesActual && (
                <button
                  type="button"
                  onClick={() => setMesSel(mesActual)}
                  className="text-[11px] font-semibold text-white/80 underline underline-offset-2 hover:text-white"
                >
                  Ver mes actual
                </button>
              )}
            </div>
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

      <div className="space-y-4">
        {/* Un solo gráfico de carga de pagos, con tres escalas de tiempo:
            día (qué cae mañana), semana (en cuál conviene pagar o financiar) y
            mes (la película larga). */}
        <div className="rounded-[12px] border border-border bg-card p-5 shadow-sm">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {vista === "dia" ? (
                <CalendarDays size={16} style={{ color: VIOLETA }} />
              ) : vista === "semana" ? (
                <BarChart3 size={16} className="text-[#0088D1]" />
              ) : (
                <CalendarRange size={16} style={{ color: TEAL }} />
              )}
              <h2 className="text-sm font-semibold text-foreground">
                Cuánto hay que pagar por{" "}
                {/* Ancho fijo: si no, al cambiar de escala el título cambia de
                    largo y arrastra a todo lo que tiene al lado. */}
                <span className="inline-block min-w-[3.6rem]">
                  {vista === "dia" ? "día" : vista === "semana" ? "semana" : "mes"}
                </span>
              </h2>
            </div>
            <div className="flex items-center gap-2">
            <div
              role="group"
              aria-label="Escala del gráfico"
              className="inline-flex items-center rounded-lg border border-border bg-muted/40 p-0.5"
            >
              {VISTAS.map((v) => {
                const activa = vista === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => cambiarVista(v.id)}
                    aria-pressed={activa}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      activa
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {v.label}
                  </button>
                );
              })}
            </div>
            {canWrite && (
              <button
                type="button"
                onClick={() => setTopesOpen(true)}
                title="A partir de cuánta plata por día, semana o mes querés que te avise"
                className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors ${
                  hayAlgunTope(topes)
                    ? "border-border text-muted-foreground hover:text-foreground"
                    : "border-dashed border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <BellRing size={12} />
                {hayAlgunTope(topes) ? "Tope mensual" : "Poner un tope"}
              </button>
            )}
            </div>
          </div>
          {/* Navegación de la ventana: se puede ir a períodos anteriores y
              posteriores, no sólo mirar hacia adelante. */}
          <div className="mb-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOffset((o) => o - 1)}
              aria-label="Período anterior"
              className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              onClick={() => setOffset((o) => o + 1)}
              aria-label="Período siguiente"
              className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronRight size={14} />
            </button>
            <span className="text-[11px] font-medium text-muted-foreground">{rangoLabel}</span>
            {offset !== 0 && (
              <button
                type="button"
                onClick={() => setOffset(0)}
                className="text-[11px] font-semibold text-primary hover:underline"
              >
                Volver a hoy
              </button>
            )}
          </div>

          {/* La alarma: cuánto se pasa y cuándo. El dato ya estaba en las
              barras, pero había que mirarlo y darse cuenta; el tope lo dice. */}
          {topeVista != null && excedidos.length > 0 && (
            <div className="mb-3 flex items-start gap-2 rounded-[6px] border border-[#DC2626]/40 px-3 py-2">
              <BellRing size={14} className="mt-0.5 shrink-0 text-[#DC2626]" />
              <p className="text-[12px] leading-snug text-foreground">
                <span className="font-semibold text-[#DC2626]">
                  {excedidos.length === 1 ? "Ojo con " : `Ojo con ${excedidos.length} períodos: `}
                </span>
                {excedidos
                  .map((e) => `${e.label} — ${ars(e.total)}, ${formatoVariacion(e.porcentaje)} sobre el tope`)
                  .join(" · ")}
                {". "}
                <span className="text-muted-foreground">
                  El tope mensual está en {ars(topeVista)}.
                </span>
              </p>
            </div>
          )}

          {vista === "dia" &&
            (hayCargaDiaria ? (
              <ResponsiveContainer width="100%" height={288}>
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
              <p className="py-14 text-center text-sm text-muted-foreground">
                No vence ninguna cuota en los próximos 14 días.
              </p>
            ))}

          {vista === "semana" &&
            (hayCargaSemanal ? (
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
            ))}

          {vista === "mes" &&
            (hayCargaMensual ? (
              <ResponsiveContainer width="100%" height={288}>
                <BarChart data={meses} margin={{ top: 18, right: 8, bottom: 2, left: 8 }}>
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
                    {meses.map((m, i) => {
                      const pasa = nivel(m.total, topes.mes) === "excedido";
                      return (
                        <Cell
                          key={i}
                          fill={pasa ? ROJO_TOPE : TEAL}
                          fillOpacity={pasa ? 0.9 : m.isCurrent ? 1 : 0.5}
                        />
                      );
                    })}
                    <LabelList dataKey="total" content={<MoneyLabel vertical />} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-14 text-center text-sm text-muted-foreground">
                Sin cuotas en los próximos 12 meses.
              </p>
            ))}
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
                    <BankBadge banco={c.banco} alto={18} />
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
                        {c.motivo_corrimiento && (
                          <span className="text-[#B45309]">
                            {" · "}
                            {c.motivo_corrimiento}, se paga el {fmtFecha(c.fecha_efectiva)}
                          </span>
                        )}
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
            {incompletos > 0 && (
              <button
                type="button"
                onClick={() => setFEstado("incompletos")}
                title="Ver los préstamos a los que les falta información"
                className="inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-600 hover:underline"
              >
                <AlertTriangle size={12} />
                {incompletos} sin completar
              </button>
            )}
          </div>
          {/* Mirar para atrás: lo que ya se pagó, mes a mes. Estaba guardado
              pero no se veía sin abrir préstamo por préstamo. */}
          <button
            type="button"
            onClick={() => setHistorialOpen(true)}
            title="Ver todo lo que ya se pagó, mes a mes"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <History size={15} className="text-primary" />
            Pagos hechos
          </button>
          {canWrite && (
            <>
              {/* El ritual de principio de mes: corregir de una las fechas que
                  pasó el banco, en vez de abrir préstamo por préstamo. */}
              <button
                type="button"
                onClick={() => setFechasOpen(true)}
                title="Corregir de una vez las fechas y los importes que vencen este mes"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                <CalendarCheck size={15} className="text-primary" />
                Fechas del mes
              </button>
              <AddPrestamoDialog bancos={bancos} />
            </>
          )}
        </div>

        {/* Filtros y orden: con 35 préstamos de 6 bancos, encontrar uno a ojo
            no va. El total de arriba sigue siendo el de todos. */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-2.5">
          <div className="relative">
            <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/70" />
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar banco o monto…"
              className="h-8 w-52 rounded-[6px] border border-border bg-background pl-7 pr-2 text-xs text-foreground"
            />
          </div>
          <select
            value={fBanco}
            onChange={(e) => setFBanco(e.target.value)}
            className="h-8 rounded-[6px] border border-border bg-background px-2 text-xs text-foreground"
          >
            <option value="todos">Todos los bancos</option>
            {bancos.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          <select
            value={fEstado}
            onChange={(e) => setFEstado(e.target.value as typeof fEstado)}
            className="h-8 rounded-[6px] border border-border bg-background px-2 text-xs text-foreground"
          >
            <option value="todos">Todos</option>
            <option value="activos">Con cuotas por pagar</option>
            <option value="cancelados">Cancelados</option>
            {incompletos > 0 && <option value="incompletos">Falta completar ({incompletos})</option>}
          </select>
          <label className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            Ordenar por
            <select
              value={orden}
              onChange={(e) => setOrden(e.target.value as OrdenPrestamo)}
              className="h-8 rounded-[6px] border border-border bg-background px-2 text-xs text-foreground"
            >
              {(Object.keys(ORDEN_LABEL) as OrdenPrestamo[]).map((k) => (
                <option key={k} value={k}>{ORDEN_LABEL[k]}</option>
              ))}
            </select>
          </label>
          {visibles.length !== prestamos.length && (
            <span className="text-[11px] text-muted-foreground">
              {visibles.length} de {prestamos.length} · {ars(deudaVisible)}
            </span>
          )}
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
                {visibles.map((p) => {
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
                            <BankBadge banco={p.banco} />
                            <span className="min-w-0">
                              <span className="flex items-center gap-1.5">
                                <span className="font-medium text-foreground">
                                  {p.banco}
                                  {/* El monto va siempre: si no lo tenemos, un
                                      guión, que se lee como "falta" y no como
                                      "no aplica". */}
                                  <span
                                    className={`ml-1 text-xs font-normal ${p.detalle ? "text-muted-foreground" : "text-muted-foreground/50"}`}
                                  >
                                    · {p.detalle || "—"}
                                  </span>
                                </span>
                                {p.moneda === "USD" && (
                                  <span className="rounded-[4px] border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                    USD
                                  </span>
                                )}
                                {/* El triángulo dice que falta un dato, así que
                                    al tocarlo se abre la ficha para cargarlo. */}
                                {tieneFaltantes(p) &&
                                  (canWrite ? (
                                    <button
                                      type="button"
                                      title={`Falta ${textoFaltantes(p)} — clic para completarlo`}
                                      aria-label={`Préstamo incompleto, falta ${textoFaltantes(p)}. Abrir para completar.`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditPrestamo(p);
                                        setEditKey((k) => k + 1);
                                      }}
                                      className="-m-1 inline-flex shrink-0 cursor-pointer rounded p-1 text-amber-500 transition-colors hover:bg-amber-50 hover:text-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50"
                                    >
                                      <AlertTriangle size={13} />
                                    </button>
                                  ) : (
                                    <span
                                      title={`Falta ${textoFaltantes(p)}`}
                                      aria-label={`Préstamo incompleto, falta ${textoFaltantes(p)}`}
                                      className="inline-flex shrink-0 text-amber-500"
                                    >
                                      <AlertTriangle size={13} />
                                    </span>
                                  ))}
                              </span>
                              {/* Cómo lo llaman en la planilla (SUECA, FORTE
                                  CAR): abajo y en chico, que no compita con la
                                  plata. */}
                              {p.referencia && (
                                <span className="block truncate text-[11px] leading-tight text-muted-foreground/80">
                                  {p.referencia}
                                </span>
                              )}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {p.tasa != null ? `${p.tasa.toLocaleString("es-AR")}%` : "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-foreground">
                          {p.importe_cuota === 0 ? (
                            "—"
                          ) : (
                            <>
                              {p.moneda === "USD"
                                ? `US$ ${p.importe_cuota.toLocaleString("es-AR")}`
                                : ars(p.importe_cuota)}
                              {/* Tasa variable: el número de arriba es el último
                                  conocido, así que abajo va cuánto se movió
                                  respecto del importe anterior. */}
                              {p.cuota_variable &&
                                (() => {
                                  const v = variacionCuota(p.cuotas);
                                  return (
                                    <span
                                      className="block text-[11px] font-normal leading-tight text-muted-foreground"
                                      title={
                                        v
                                          ? `La cuota cambia mes a mes. Pasó de ${ars(v.anterior)} a ${ars(v.actual)}.`
                                          : "La cuota cambia mes a mes: éste es el último importe que nos pasaron."
                                      }
                                    >
                                      {v ? (
                                        <span
                                          className={
                                            v.diferencia >= 0 ? "text-[#B45309]" : "text-[#059669]"
                                          }
                                        >
                                          {formatoVariacion(v.porcentaje)} vs. la anterior
                                        </span>
                                      ) : (
                                        "cuota variable"
                                      )}
                                    </span>
                                  );
                                })()}
                            </>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {p.es_recurrente ? (
                            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Repeat size={12} className="text-primary" />
                              Todos los meses
                              {p.dia_vencimiento ? `, el ${p.dia_vencimiento}` : ""}
                            </span>
                          ) : (
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
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {p.proxima ? (
                            <>
                              {fmtFecha(p.proxima.fecha_vencimiento)}
                              {/* La fecha del contrato queda como está; abajo,
                                  el día en que la plata sale de verdad. */}
                              {p.proxima.motivo_corrimiento && (
                                <span
                                  className="block text-[11px] leading-tight text-[#B45309]"
                                  title={`${p.proxima.motivo_corrimiento}: el banco no opera, así que se paga el ${fmtFecha(p.proxima.fecha_efectiva)}. Los totales por día, semana y mes lo cuentan ese día.`}
                                >
                                  se paga el {fmtFecha(p.proxima.fecha_efectiva)}
                                </span>
                              )}
                            </>
                          ) : (
                            "Cancelado ✅"
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {ultima ? fmtFecha(ultima) : "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-foreground">
                          {p.es_recurrente ? (
                            // Una obligación sin fin no tiene deuda total.
                            <span className="font-normal text-muted-foreground/70" title="Es un pago mensual sin fecha de fin: no tiene una deuda total.">
                              sin fin
                            </span>
                          ) : p.restante > 0 ? (
                            <span
                              className={p.cuota_variable ? "text-muted-foreground" : undefined}
                              title={
                                p.cuota_variable
                                  ? "Estimado: la cuota cambia mes a mes, esto proyecta el último importe conocido."
                                  : undefined
                              }
                            >
                              {p.cuota_variable ? "≈ " : ""}
                              {ars(p.restante)}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        {canWrite && (
                          <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-0.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditPrestamo(p);
                                  setEditKey((k) => k + 1);
                                }}
                                className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-primary"
                                title="Editar banco, monto, cuota y tasa"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDelId(p.id)}
                                className="rounded p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                                title="Eliminar préstamo"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
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

      <HistorialPagosDialog
        key={`historial-${historialOpen}`}
        prestamos={prestamos}
        canWrite={canWrite}
        open={historialOpen}
        onOpenChange={setHistorialOpen}
      />

      <FechasDelMesDialog
        key={`fechas-${fechasOpen}`}
        prestamos={prestamos}
        open={fechasOpen}
        onOpenChange={setFechasOpen}
        mesInicial={mesActual}
      />

      <TopesDialog key={`topes-${topesOpen}`} topes={topes} open={topesOpen} onOpenChange={setTopesOpen} />

      <EditPrestamoDialog
        key={`edit-prestamo-${editKey}`}
        prestamo={editPrestamo}
        bancos={bancos}
        open={editPrestamo !== null}
        onOpenChange={(v) => !v && setEditPrestamo(null)}
      />

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
  payload?: {
    payload: { label: string; total: number; cuotas: number; corridas?: number };
  }[];
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
      {/* De dónde sale la diferencia con las fechas que figuran en la tabla. */}
      {d.corridas ? (
        <p className="mt-1 border-t border-border pt-1 text-[#B45309]">
          Incluye {d.corridas} que vencía{d.corridas !== 1 ? "n" : ""} en día no hábil
        </p>
      ) : null}
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
      {/* El título va solo en su fila: compartirla con el selector lo dejaba
          cortado en "A PA…" por más corto que fuera. */}
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/20">
          <PiggyBank size={16} className="text-white" />
        </span>
        <span className="text-xs font-semibold uppercase tracking-wide text-white/80">{label}</span>
      </div>
      <p className="mt-3 text-[26px] font-bold leading-none tabular-nums text-white">{value}</p>
      {action && <div className="mt-3">{action}</div>}
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
