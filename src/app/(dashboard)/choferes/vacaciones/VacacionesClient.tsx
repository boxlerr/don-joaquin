"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Palmtree,
  CalendarRange,
  CalendarDays,
  Plus,
  RefreshCw,
  Search,
  Pencil,
  Check,
  X,
  AlertTriangle,
  Download,
  Info,
  ExternalLink,
  Table2,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Plane,
} from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { choferSlug } from "@/lib/chofer-slug";
import {
  guardarSaldoVacacionesAction,
  guardarSaldosAnioAction,
  cancelarAusenciaAction,
  cargarVacacionesBatchAction,
  editarAusenciaAction,
} from "../[slug]/actions";
import { recalcularDiasPorAntiguedadAction } from "./actions";
import { planSugerido } from "./plan";
import { umbralBase, umbralDeMes, umbralDeSemana, mesDeSemana, type UmbralConfig } from "./umbral";
import CargarVacacionesDialog, { type ChoferOpcion, type SugerenciaSemana } from "./CargarVacacionesDialog";
import EditarPeriodoDialog from "./EditarPeriodoDialog";
import UmbralDialog from "./UmbralDialog";
import ImportarPlanillaDialog from "./import-planilla/ImportarPlanillaDialog";
import CronogramaAnual from "./CronogramaAnual";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { VacacionesSaldoChofer, VacacionesPeriodo, VacacionesSector } from "./lib";

const SECTORES: VacacionesSector[] = ["Chofer", "Oficina", "Taller"];
const MES_LBL = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function lunesDe(d: Date): Date {
  const x = new Date(d);
  const dow = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dow);
  x.setHours(0, 0, 0, 0);
  return x;
}
function fmtDiaMes(d: Date): string {
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}
function fmtFecha(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}
function fmtIngreso(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
// Iniciales y un color estable por nombre para los avatares (vistas de tarjetas
// y timeline). Sin dependencias: el hash es determinístico.
function iniciales(nombre?: string, apellido?: string): string {
  return ((nombre?.[0] ?? "") + (apellido?.[0] ?? "")).toUpperCase() || "—";
}
function colorAvatar(nombre?: string, apellido?: string): string {
  const hue = ((nombre?.charCodeAt(0) ?? 0) * 7 + (apellido?.charCodeAt(0) ?? 0) * 13) % 360;
  return `hsl(${hue} 42% 52%)`;
}
function diffDias(aISO: string, bISO: string): number {
  return Math.round((new Date(bISO + "T00:00:00").getTime() - new Date(aISO + "T00:00:00").getTime()) / 86_400_000);
}
function construirSemanas(inicio: Date, n: number) {
  return Array.from({ length: n }, (_, i) => {
    const start = new Date(inicio);
    start.setDate(start.getDate() + i * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { start: toISO(start), end: toISO(end), label: fmtDiaMes(start) };
  });
}

// Agrupa las semanas consecutivas por el mes de su fecha de inicio, para el
// encabezado de dos niveles del cronograma (banda de meses arriba, semanas
// abajo). Devuelve los grupos con su ancho (colSpan) y las posiciones donde
// arranca un mes nuevo, para separar mejor las columnas. Función pura.
export function agruparMeses(semanas: { start: string }[]) {
  const grupos: { key: string; label: string; span: number; inicio: number }[] = [];
  const iniciosMes = new Set<number>();
  semanas.forEach((s, i) => {
    const d = new Date(s.start + "T00:00:00");
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.key === key) {
      ultimo.span += 1;
    } else {
      iniciosMes.add(i);
      grupos.push({
        key,
        label: `${MES_LBL[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
        span: 1,
        inicio: i,
      });
    }
  });
  return { grupos, iniciosMes };
}

/** Cuántos meses de distancia hay entre dos (año, mes), para navegar el cronograma. */
function sumarMes(anio: number, mes: number, delta: number): { anio: number; mes: number } {
  const t = anio * 12 + (mes - 1) + delta;
  return { anio: Math.floor(t / 12), mes: (t % 12) + 1 };
}

// Rango visible del cronograma: o un mes calendario completo (lo que se necesita
// para liquidar sueldos a fin de mes) o una tira de semanas desde un ancla.
//
// El largo se guarda como preset, no como número: "resto del año" son menos
// semanas cada día que pasa, y guardar el número dejaba el selector en blanco si
// la pestaña quedaba abierta de un día para el otro.
type LargoSemanas = "10" | "13" | "26" | "resto" | "52";
type RangoCrono =
  | { modo: "mes"; anio: number; mes: number }
  | { modo: "semanas"; largo: LargoSemanas; offset: number };

interface Props {
  saldos: VacacionesSaldoChofer[];
  periodos: VacacionesPeriodo[];
  finPeriodoY: number;
  canWrite: boolean;
  umbralConfig?: UmbralConfig;
  choferesActivos?: number;
}

export default function VacacionesClient({
  saldos,
  periodos,
  finPeriodoY,
  canWrite,
  umbralConfig,
  choferesActivos = 0,
}: Props) {
  const cfgUmbral: UmbralConfig = umbralConfig ?? {
    modo: "auto",
    porcentaje: 10,
    minimo: 4,
    fijo: 6,
    porMes: {},
  };
  const umbral = umbralBase(cfgUmbral, choferesActivos);
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // --- Filtros ---------------------------------------------------------------
  const [fSector, setFSector] = useState<"Todos" | VacacionesSector>("Todos");
  const [fSemaforo, setFSemaforo] = useState<"Todos" | "🔴" | "🟠" | "🟡" | "🟢">("Todos");
  const [busqueda, setBusqueda] = useState("");

  // Sólo los que están de vacaciones hoy: con 8 personas se lee bien, pero en
  // diciembre/enero el cronograma mezcla a los que ya volvieron con los que están.
  const [soloEnCurso, setSoloEnCurso] = useState(false);

  // --- Cronograma: rango + vista ---------------------------------------------
  const [rango, setRango] = useState<RangoCrono>({ modo: "semanas", largo: "10", offset: 0 });
  const [vista, setVista] = useState<"semanas" | "anual">("semanas");
  const [umbralOpen, setUmbralOpen] = useState(false);
  const [vistaTabla, setVistaTabla] = useState<"resumen" | "anios" | "tarjetas">("tarjetas");
  const [vistaPeriodos, setVistaPeriodos] = useState<"lista" | "timeline">("timeline");
  const [detalle, setDetalle] = useState<VacacionesPeriodo | null>(null);
  const [resaltado, setResaltado] = useState<string | null>(null);
  const [planAbierto, setPlanAbierto] = useState(false);
  const [confirmPlan, setConfirmPlan] = useState(false);
  const [planCargando, setPlanCargando] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  // Drag & drop de períodos entre semanas (misma fila).
  const [dragInfo, setDragInfo] = useState<{ periodo: VacacionesPeriodo; semanaStart: string } | null>(null);

  // --- Diálogos --------------------------------------------------------------
  const [addOpen, setAddOpen] = useState(false);
  const [addChofer, setAddChofer] = useState<ChoferOpcion | null>(null);
  const [addInicio, setAddInicio] = useState<string | undefined>();
  const [addFin, setAddFin] = useState<string | undefined>();
  const [addKey, setAddKey] = useState(0); // fuerza remonte con estado fresco
  const [editPeriodo, setEditPeriodo] = useState<VacacionesPeriodo | null>(null);
  const [editKey, setEditKey] = useState(0);
  const [cancelar, setCancelar] = useState<VacacionesPeriodo | null>(null);
  const [editSaldo, setEditSaldo] = useState<string | null>(null); // chofer_id en edición
  const [editCorr, setEditCorr] = useState("");
  const [editAdeu, setEditAdeu] = useState("");
  // Edición año por año (vista "Por año"): { [anio]: días otorgados }
  const [editAnios, setEditAnios] = useState<Record<number, string>>({});
  // Con qué vista se abrió la edición. Se congela acá: si se leyera `vistaTabla`
  // al guardar, cambiar de vista con una fila abierta guardaba por el camino
  // equivocado y descartaba en silencio lo que se había tipeado.
  const [editModo, setEditModo] = useState<"resumen" | "anios">("resumen");

  const choferesOpts: ChoferOpcion[] = saldos.map((s) => ({
    chofer_id: s.chofer_id,
    nombre: s.nombre,
    apellido: s.apellido,
  }));

  const refrescar = () => startTransition(() => router.refresh());

  const irA = (id: string) =>
    document.getElementById(id)?.scrollIntoView?.({ behavior: "smooth", block: "start" });

  // Salta a la fila del empleado en "Saldos por empleado" y la resalta un rato.
  // Si los filtros la ocultan, primero los limpia.
  const verEnTabla = (choferId: string) => {
    const visible = saldos.some(
      (s) =>
        s.chofer_id === choferId &&
        (fSector === "Todos" || s.sector === fSector) &&
        (fSemaforo === "Todos" || s.semaforo === fSemaforo) &&
        (!busqueda.trim() || `${s.apellido} ${s.nombre}`.toLowerCase().includes(busqueda.toLowerCase())),
    );
    if (!visible) {
      setFSector("Todos");
      setFSemaforo("Todos");
      setBusqueda("");
    }
    setResaltado(choferId);
    window.setTimeout(() => {
      document.getElementById(`saldo-${choferId}`)?.scrollIntoView?.({ behavior: "smooth", block: "center" });
    }, 80);
    window.setTimeout(() => setResaltado((r) => (r === choferId ? null : r)), 3200);
  };

  const abrirAdd = (chofer?: ChoferOpcion, inicio?: string, fin?: string) => {
    setAddChofer(chofer ?? null);
    setAddInicio(inicio);
    setAddFin(fin);
    setAddKey((k) => k + 1);
    setAddOpen(true);
  };

  const abrirEdit = (p: VacacionesPeriodo) => {
    setEditPeriodo(p);
    setEditKey((k) => k + 1);
  };

  const confirmarCancelar = async () => {
    if (!cancelar) return;
    const p = cancelar;
    setCancelar(null);
    const res = await cancelarAusenciaAction(p.id, p.chofer_id);
    if (res?.error) alert(res.error);
    else refrescar();
  };

  // Cambiar de vista cierra la edición abierta: los inputs de "Resumen" y los de
  // "Por año" no son los mismos, y dejar una fila a medio editar entre las dos
  // hacía que lo tipeado se perdiera sin aviso.
  const cambiarVistaTabla = (v: "resumen" | "tarjetas" | "anios") => {
    setEditSaldo(null);
    setVistaTabla(v);
  };

  const abrirEditSaldo = (s: VacacionesSaldoChofer) => {
    setEditSaldo(s.chofer_id);
    setEditModo(vistaTabla === "anios" ? "anios" : "resumen");
    setEditCorr(String(s.corresponden));
    setEditAdeu(String(s.adeudados));
    setEditAnios(Object.fromEntries(s.saldos_anio.map((a) => [a.anio, String(a.otorgados)])));
  };
  const guardarSaldo = async (s: VacacionesSaldoChofer) => {
    // En "Por año" se editan los otorgados de cada año; en "Resumen", los dos
    // números de siempre (que se traducen a las filas de Y e Y−1).
    const res =
      editModo === "anios"
        ? await guardarSaldosAnioAction(
            s.chofer_id,
            Object.entries(editAnios).map(([anio, dias]) => ({
              anio: Number(anio),
              dias: Number(dias) || 0,
              observaciones: s.saldos_anio.find((a) => a.anio === Number(anio))?.observaciones ?? null,
            })),
          )
        : await guardarSaldoVacacionesAction(s.chofer_id, {
            dias_correspondientes: Number(editCorr) || 0,
            dias_adeudados: Number(editAdeu) || 0,
          });
    if (res?.error) alert(res.error);
    else {
      setEditSaldo(null);
      refrescar();
    }
  };

  const exportar = async () => {
    // Carga xlsx bajo demanda (code-splitting) para no inflar el bundle.
    const { exportarVacacionesXlsx } = await import("./export");
    exportarVacacionesXlsx(saldosFiltrados, periodosFiltrados, semanas, finPeriodoY, hoyISO);
  };

  const exportarPlanilla = async () => {
    const { exportarPlanillaBarbaraXlsx } = await import("./export");
    // La planilla va completa (sin filtros): es el archivo que se comparte.
    exportarPlanillaBarbaraXlsx(saldos, finPeriodoY, hoyISO);
  };

  const recalcular = async () => {
    const res = await recalcularDiasPorAntiguedadAction();
    if (res?.error) alert(res.error);
    else {
      alert(`Listo. ${res?.actualizados ?? 0} empleado(s) actualizados según su antigüedad.`);
      refrescar();
    }
  };

  // --- Ventana de semanas (el React Compiler memoiza solo) -------------------
  // La ventana ya no arranca siempre "hoy": se puede ir hacia atrás (para ver el
  // mes que se está liquidando) o plantarse en un mes calendario completo.
  // Fecha local, no UTC: las semanas se arman con fechas locales, así que
  // `toISOString()` (UTC) adelantaba "hoy" un día entre las 21:00 y medianoche.
  const hoyISO = toISO(new Date());
  const lunesHoy = lunesDe(new Date());
  const finAnio = new Date(finPeriodoY, 11, 31);
  const restoSemanas = Math.max(1, Math.ceil((finAnio.getTime() - lunesHoy.getTime()) / (7 * 86_400_000)));

  // "resto" se resuelve acá, en cada render: siempre es lo que queda de año.
  const largoSemanas = rango.modo === "semanas" ? (rango.largo === "resto" ? restoSemanas : Number(rango.largo)) : 0;

  const inicioSem = (() => {
    if (rango.modo === "mes") return lunesDe(new Date(rango.anio, rango.mes - 1, 1));
    const d = new Date(lunesHoy);
    d.setDate(d.getDate() + rango.offset * 7);
    return d;
  })();
  const numSemanas =
    rango.modo === "mes"
      ? Math.round(
          (lunesDe(new Date(rango.anio, rango.mes, 0)).getTime() - inicioSem.getTime()) / (7 * 86_400_000),
        ) + 1
      : largoSemanas;

  const semanas = construirSemanas(inicioSem, Math.max(1, numSemanas));
  const finVentana = semanas[semanas.length - 1]!.end;
  const inicioVentana = semanas[0]!.start;

  // Umbral de cada semana: el del mes que se lleva la mayoría de sus días, así
  // diciembre puede admitir más gente junta sin que todo aparezca en rojo.
  const umbralPorSemana = semanas.map((s) => umbralDeSemana(cfgUmbral, s.start, choferesActivos));

  const periodosEnVentana = periodos.filter((p) => p.fecha_inicio <= finVentana && p.fecha_fin >= inicioVentana);

  const conteoPorSemana = semanas.map(
    (s) => new Set(periodosEnVentana.filter((p) => p.fecha_inicio <= s.end && p.fecha_fin >= s.start).map((p) => p.chofer_id)).size,
  );
  const { grupos: gruposMes, iniciosMes } = agruparMeses(semanas);

  // Sugerencias: 13 semanas fijas desde hoy, las 3 con menos gente (independiente del rango que se esté mirando).
  const semanasSug = construirSemanas(lunesHoy, 13);
  const sugerencias: SugerenciaSemana[] = semanasSug
    .map((s) => ({
      inicio: s.start,
      fin: s.end,
      ocupados: new Set(periodos.filter((p) => p.fecha_inicio <= s.end && p.fecha_fin >= s.start).map((p) => p.chofer_id)).size,
      umbral: umbralDeSemana(cfgUmbral, s.start, choferesActivos),
    }))
    .filter((s) => s.ocupados < s.umbral)
    .sort((a, b) => a.ocupados - b.ocupados || a.inicio.localeCompare(b.inicio))
    .slice(0, 3);

  // Navegación del cronograma: un mes / una ventana entera para cada lado.
  const irVentana = (delta: number) =>
    setRango((r) =>
      r.modo === "mes"
        ? { modo: "mes", ...sumarMes(r.anio, r.mes, delta) }
        : { ...r, offset: r.offset + delta * Math.max(1, largoSemanas) },
    );
  const volverAHoy = () =>
    setRango((r) =>
      r.modo === "mes"
        ? { modo: "mes", anio: new Date().getFullYear(), mes: new Date().getMonth() + 1 }
        : { ...r, offset: 0 },
    );
  const rangoLabel =
    rango.modo === "mes"
      ? `${MES_LBL[rango.mes - 1]} ${rango.anio}`
      : `${fmtFecha(inicioVentana)} → ${fmtFecha(finVentana)}`;
  const ventanaTieneHoy = inicioVentana <= hoyISO && finVentana >= hoyISO;

  // Resumen por mes de la ventana visible (personas distintas + días-persona).
  const resumenMeses = (() => {
    const map = new Map<string, { personas: Set<string>; dias: number }>();
    for (const p of periodosEnVentana) {
      const desde = p.fecha_inicio < inicioVentana ? inicioVentana : p.fecha_inicio;
      const hasta = p.fecha_fin > finVentana ? finVentana : p.fecha_fin;
      const d0 = new Date(desde + "T00:00:00");
      const d1 = new Date(hasta + "T00:00:00");
      for (let d = new Date(d0); d <= d1; d.setDate(d.getDate() + 1)) {
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const e = map.get(k) ?? { personas: new Set<string>(), dias: 0 };
        e.personas.add(p.chofer_id);
        e.dias += 1;
        map.set(k, e);
      }
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => {
        const [, m] = k.split("-");
        const mes = Number(m);
        return {
          mes: k,
          label: MES_LBL[mes - 1]!,
          personas: v.personas.size,
          dias: v.dias,
          // Antes era un 5 fijo, sin relación con el umbral de las semanas.
          umbral: umbralDeMes(cfgUmbral, mes, choferesActivos),
        };
      });
  })();

  // --- Filtro aplicado -------------------------------------------------------
  const coincide = (s: VacacionesSaldoChofer) => {
    if (fSector !== "Todos" && s.sector !== fSector) return false;
    if (fSemaforo !== "Todos" && s.semaforo !== fSemaforo) return false;
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      if (!`${s.apellido} ${s.nombre}`.toLowerCase().includes(q)) return false;
    }
    return true;
  };
  const saldosFiltrados = saldos.filter(coincide);
  const idsFiltrados = new Set(saldosFiltrados.map((s) => s.chofer_id));
  const periodosFiltrados = periodos.filter((p) => idsFiltrados.has(p.chofer_id));

  // El cronograma lista a quien tenga algún período que toque la ventana. Con
  // "solo de vacaciones hoy" quedan únicamente los que están afuera ahora mismo,
  // sin los que ya volvieron dentro de la misma ventana.
  // El botón del filtro sólo existe en la vista de semanas: si se aplicara
  // también en la anual, quedaría filtrando sin ningún control a la vista.
  const filtroEnCurso = soloEnCurso && vista === "semanas";
  const enCursoAhora = (ps: VacacionesPeriodo[]) => ps.some((p) => p.en_curso);
  const filasCrono = [...new Set(periodosEnVentana.map((p) => p.chofer_id))]
    .filter((id) => idsFiltrados.has(id))
    .map((id) => {
      const ps = periodosEnVentana.filter((p) => p.chofer_id === id);
      const info = ps[0]!;
      return { id, nombre: info.nombre, apellido: info.apellido, periodos: ps };
    })
    .filter((f) => !filtroEnCurso || enCursoAhora(f.periodos))
    .sort((a, b) => a.apellido.localeCompare(b.apellido));

  const periodoEnSemana = (ps: VacacionesPeriodo[], semIdx: number) =>
    ps.find((p) => p.fecha_inicio <= semanas[semIdx]!.end && p.fecha_fin >= semanas[semIdx]!.start);

  const enVacacionesAhora = saldos.filter((s) => s.en_vacaciones_ahora);
  const urgentes = saldos.filter((s) => s.adeudados > 0);
  const desfasados = saldos.filter((s) => s.desfasaje).length;
  // Línea vertical de "hoy". La ventana ya no arranca necesariamente esta semana,
  // así que hay que ubicar en qué columna cae (o no dibujarla).
  const idxSemanaHoy = semanas.findIndex((s) => s.start <= hoyISO && s.end >= hoyISO);
  const hoyLeftPct =
    idxSemanaHoy >= 0 ? ((Math.min(6, Math.max(0, diffDias(semanas[idxSemanaHoy]!.start, hoyISO))) + 0.5) / 7) * 100 : 0;

  // KPIs
  const diasEnRiesgo = urgentes.reduce((a, s) => a + s.adeudados, 0);
  const diasOtorgar = saldos.reduce((a, s) => a + s.corresponden, 0);
  const planificados = periodos.filter((p) => p.fecha_inicio >= hoyISO).length;

  const periodosVentanaFiltrados = periodosEnVentana
    .filter((p) => idsFiltrados.has(p.chofer_id))
    .filter((p) => !filtroEnCurso || p.en_curso);

  // --- Plan sugerido: liquida los saldos viejos antes del 31/12 --------------
  // Se recalcula solo en cada render con los datos vivos: si se carga un
  // período, esa persona sale del plan automáticamente.
  const plan = (() => {
    if (urgentes.length === 0) return { items: [], sinLugar: [] };
    const proximoLunes = lunesDe(new Date());
    proximoLunes.setDate(proximoLunes.getDate() + 7);
    const nSemanas = Math.max(1, Math.ceil((new Date(finPeriodoY, 11, 31).getTime() - proximoLunes.getTime()) / (7 * 86_400_000)));
    const semanasPlan = construirSemanas(proximoLunes, nSemanas);
    const ocupacion = semanasPlan.map(
      (s) => new Set(periodos.filter((p) => p.fecha_inicio <= s.end && p.fecha_fin >= s.start).map((p) => p.chofer_id)).size,
    );
    const ocupadoPorChofer = new Set<string>();
    for (const s of semanasPlan) {
      for (const p of periodos) {
        if (p.fecha_inicio <= s.end && p.fecha_fin >= s.start) ocupadoPorChofer.add(`${p.chofer_id}|${s.start}`);
      }
    }
    return planSugerido({
      urgentes: urgentes.map((u) => ({ chofer_id: u.chofer_id, apellido: u.apellido, nombre: u.nombre, adeudados: u.adeudados })),
      semanas: semanasPlan,
      ocupacion,
      ocupadoPorChofer,
      umbralPorSemana: semanasPlan.map((s) => umbralDeSemana(cfgUmbral, s.start, choferesActivos)),
    });
  })();

  const aplicarPlan = async () => {
    setPlanCargando(true);
    const res = await cargarVacacionesBatchAction(
      plan.items.map((i) => ({ chofer_id: i.chofer_id, fecha_inicio: i.fecha_inicio, fecha_fin: i.fecha_fin })),
    );
    setPlanCargando(false);
    setConfirmPlan(false);
    const err = res?.errores?.length ? ` (${res.errores.length} con problemas)` : "";
    alert(`Se cargaron ${res?.creados ?? 0} período(s) del plan${err}.`);
    refrescar();
  };

  // Mover un período de semana (drag & drop, misma persona).
  const moverPeriodo = async (p: VacacionesPeriodo, desdeSemana: string, haciaSemana: string) => {
    const delta = diffDias(desdeSemana, haciaSemana);
    if (delta === 0) return;
    const nuevoInicio = toISO(new Date(new Date(p.fecha_inicio + "T00:00:00").getTime() + delta * 86_400_000));
    const nuevoFin = toISO(new Date(new Date(p.fecha_fin + "T00:00:00").getTime() + delta * 86_400_000));
    const res = await editarAusenciaAction(p.id, p.chofer_id, {
      tipo: p.tipo || "Vacaciones",
      fecha_inicio: nuevoInicio,
      fecha_fin: nuevoFin,
      observaciones: p.observaciones,
      es_vacaciones: true,
      justificada: true,
    });
    if (res?.error) alert(res.error);
    else refrescar();
  };

  const saldosPorSector = SECTORES.map((sec) => {
    const filas = saldosFiltrados
      .filter((s) => s.sector === sec)
      .sort((a, b) => {
        if ((a.adeudados > 0) !== (b.adeudados > 0)) return a.adeudados > 0 ? -1 : 1;
        if (a.disponibles !== b.disponibles) return b.disponibles - a.disponibles;
        return a.apellido.localeCompare(b.apellido);
      });
    return {
      sector: sec,
      filas,
      saldoViejo: filas.reduce((acc, s) => acc + s.adeudados, 0),
      diasAnio: filas.reduce((acc, s) => acc + s.corresponden, 0),
      disp: filas.reduce((acc, s) => acc + s.disponibles, 0),
    };
  }).filter((g) => g.filas.length > 0);

  // Desglose por año para el tooltip de saldo/disponibles.
  const desglose = (s: VacacionesSaldoChofer) =>
    s.saldos_anio.length === 0
      ? "Sin días cargados"
      : s.saldos_anio
          .map(
            (a) =>
              `${a.anio}: quedan ${a.saldo} de ${a.otorgados}${a.usados > 0 ? ` (usados ${a.usados})` : ""}${
                a.anio < finPeriodoY - 1 ? ` — VENCIDO el 31/12/${a.anio + 1}` : ""
              }`,
          )
          .join(" · ");

  // Columnas de la vista "Por año" (mismo formato que la planilla de Bárbara).
  const aniosColumnas = [...new Set(saldos.flatMap((s) => s.saldos_anio.map((a) => a.anio)))].sort();
  const sectorDe = new Map(saldos.map((s) => [s.chofer_id, s.sector]));

  // Posición del tramo de un período dentro de una semana (barras proporcionales
  // a los días reales, no bloques de semana entera).
  const tramoEnSemana = (p: VacacionesPeriodo, sem: { start: string; end: string }) => {
    const ini = p.fecha_inicio > sem.start ? p.fecha_inicio : sem.start;
    const fin = p.fecha_fin < sem.end ? p.fecha_fin : sem.end;
    const offset = diffDias(sem.start, ini);
    const dias = diffDias(ini, fin) + 1;
    return {
      left: (offset / 7) * 100,
      width: (dias / 7) * 100,
      empiezaAca: p.fecha_inicio >= sem.start,
      terminaAca: p.fecha_fin <= sem.end,
    };
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={fSector}
          onChange={(e) => setFSector(e.target.value as typeof fSector)}
          className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
        >
          <option value="Todos">Todos los sectores</option>
          <option value="Chofer">Choferes</option>
          <option value="Oficina">Oficina</option>
          <option value="Taller">Taller</option>
        </select>
        <select
          value={fSemaforo}
          onChange={(e) => setFSemaforo(e.target.value as typeof fSemaforo)}
          className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
        >
          <option value="Todos">Todos</option>
          <option value="🔴">🔴 Urgentes</option>
          <option value="🟠">🟠 Mucho acum.</option>
          <option value="🟡">🟡 Atención</option>
          <option value="🟢">🟢 Ok</option>
        </select>
        <Button
          variant="outline"
          onClick={exportar}
          className="h-9 gap-1.5 text-muted-foreground border-border"
          title="Descargar Excel (saldos, períodos y cronograma)"
        >
          <Download size={14} /> Excel
        </Button>
        <Button
          variant="outline"
          onClick={exportarPlanilla}
          className="h-9 gap-1.5 text-muted-foreground border-border"
          title="Descargar la planilla completa en el formato de siempre (resumen con semáforo, por sector y urgentes)"
        >
          <Download size={14} /> Planilla
        </Button>
        {canWrite && (
          <>
            <Button
              variant="outline"
              onClick={() => setImportOpen(true)}
              className="h-9 gap-1.5 text-muted-foreground border-border"
              title="Importar la planilla de vacaciones (VACACIONES 2.xlsx) con vista previa de diferencias"
            >
              <Table2 size={14} /> Importar planilla
            </Button>
            <Button variant="brand" onClick={() => abrirAdd()} className="h-9 gap-1.5">
              <Plus size={15} /> Cargar vacaciones
            </Button>
            <Button
              variant="outline"
              onClick={recalcular}
              disabled={pending}
              className="h-9 gap-1.5 text-muted-foreground border-border"
              title="Ajustar los días que corresponden según la antigüedad actual"
            >
              <RefreshCw size={14} /> Recalcular antigüedad
            </Button>
          </>
        )}
      </div>

      {/* Cards de resumen */}
      <TooltipProvider delay={120}>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard
            label={`Con saldo ${finPeriodoY - 1} por vencer`}
            value={urgentes.length}
            tone="danger"
            emoji="🔴"
            info={`Empleados que todavía tienen días del período ${finPeriodoY - 1} sin tomar. Vencen el 31/12/${finPeriodoY}: si no los toman, los pierden. Clic para verlos en la tabla.`}
            onClick={() => {
              setFSemaforo("🔴");
              irA("card-saldos");
            }}
          />
          <StatCard
            label="Días en riesgo (31/12)"
            value={diasEnRiesgo}
            tone="danger"
            emoji="⏱️"
            info={`Suma de todos los días del año anterior que vencen el 31/12/${finPeriodoY}. Es la cantidad total de días que la empresa perdería si nadie los toma a tiempo. Clic para ver los urgentes.`}
            onClick={() => {
              setFSemaforo("🔴");
              irA("card-saldos");
            }}
          />
          <StatCard
            label={`Días a otorgar ${finPeriodoY}`}
            value={diasOtorgar}
            tone="brand"
            emoji="🏖️"
            info={`Total de días que corresponden por ${finPeriodoY} a toda la dotación (según antigüedad: 14/21/28/35). Es lo que hay que ir planificando a lo largo del año.`}
            onClick={() => irA("card-saldos")}
          />
          <StatCard
            label="Períodos planificados"
            value={planificados}
            tone="muted"
            emoji="📅"
            info="Cantidad de tramos de vacaciones cargados de hoy en adelante. Aparecen en el cronograma. Cargá más con “+ Cargar vacaciones”."
            onClick={() => irA(periodosVentanaFiltrados.length > 0 ? "card-periodos" : "card-cronograma")}
          />
          <StatCard
            label="De vacaciones ahora"
            value={enVacacionesAhora.length}
            tone="success"
            emoji="✈️"
            info="Empleados que están de vacaciones hoy. Logística también los ve como no disponibles en Viajes. Clic para verlos en el cronograma."
            onClick={() => irA("card-cronograma")}
          />
        </div>
      </TooltipProvider>

      {desfasados > 0 && canWrite && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-[8px] border border-amber-200 bg-amber-50 text-sm text-amber-800">
          <AlertTriangle size={15} />
          {desfasados} empleado(s) tienen los días cargados desfasados de su antigüedad actual. Usá
          “Recalcular antigüedad” para ajustarlos.
        </div>
      )}

      {/* Plan sugerido para liquidar los saldos viejos antes del 31/12. Se
          recalcula solo: al cargar un período, esa persona sale del plan. */}
      {urgentes.length > 0 && plan.items.length > 0 && (
        <div className="bg-card rounded-[8px] border border-border shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 px-5 py-3.5">
            <span className="text-base">🧩</span>
            <h2 className="text-sm font-bold text-foreground">Plan sugerido</h2>
            <span className="text-xs text-muted-foreground">
              {plan.items.length} período(s) para liquidar los {diasEnRiesgo} días del {finPeriodoY - 1} antes del 31/12,
              sin pasar de {umbral} ausentes por semana. Se rearma solo a medida que cargás.
            </span>
            <div className="ml-auto flex items-center gap-2">
              {planAbierto && canWrite && (
                <Button
                  variant="brand"
                  onClick={() => setConfirmPlan(true)}
                  className="h-8 gap-1.5 text-xs"
                >
                  <Check size={13} /> Cargar todo el plan
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => setPlanAbierto((v) => !v)}
                className="h-8 text-xs text-muted-foreground border-border"
              >
                {planAbierto ? "Ocultar" : "Ver plan"}
              </Button>
            </div>
          </div>
          {planAbierto && (
            <div className="border-t border-border">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr>
                      {["Empleado", "Desde", "Hasta", "Días", ""].map((c, i) => (
                        <th key={i} className={`px-4 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide ${i === 0 ? "text-left" : i === 4 ? "" : "text-right"}`}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {plan.items.map((it, i) => (
                      <tr key={i} className="border-t border-border hover:bg-muted/20">
                        <td className="px-4 py-1.5">
                          <button type="button" onClick={() => verEnTabla(it.chofer_id)} className="font-medium text-foreground hover:text-primary" title="Ver su saldo en la tabla">
                            {it.apellido}, {it.nombre}
                          </button>
                        </td>
                        <td className="px-4 py-1.5 text-right font-mono text-xs text-muted-foreground whitespace-nowrap">{fmtFecha(it.fecha_inicio)}</td>
                        <td className="px-4 py-1.5 text-right font-mono text-xs text-muted-foreground whitespace-nowrap">{fmtFecha(it.fecha_fin)}</td>
                        <td className="px-4 py-1.5 text-right font-mono">{it.dias}</td>
                        <td className="px-4 py-1.5 text-right">
                          {canWrite && (
                            <Button
                              variant="outline"
                              onClick={() =>
                                abrirAdd({ chofer_id: it.chofer_id, nombre: it.nombre, apellido: it.apellido }, it.fecha_inicio, it.fecha_fin)
                              }
                              className="h-7 text-xs text-muted-foreground border-border"
                            >
                              Cargar…
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {plan.sinLugar.length > 0 && (
                <div className="px-5 py-2.5 border-t border-border text-xs text-amber-700 bg-amber-50">
                  ⚠ Sin lugar en el año para: {plan.sinLugar.map((s) => `${s.apellido} (${s.dias} días)`).join(", ")} — habría que superar el umbral de {umbral} ausentes o mover otros períodos.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Cronograma */}
      <div id="card-cronograma" className="bg-card rounded-[8px] border border-border shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 px-5 py-4 border-b border-border">
          <CalendarRange size={16} className="text-primary" />
          <h2 className="text-sm font-bold text-foreground">Cronograma de personal con vacaciones</h2>
          <div className="ml-auto flex flex-wrap justify-end items-center gap-2">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar empleado…"
                className="h-8 w-40 pl-7 pr-2 rounded-lg border border-border bg-background text-xs text-foreground"
              />
            </div>
            {vista === "semanas" && (
              <>
                <button
                  type="button"
                  onClick={() => setSoloEnCurso((v) => !v)}
                  title="Dejar solo a los que están de vacaciones hoy (los que ya volvieron quedan afuera)"
                  className={`h-8 px-2.5 rounded-lg border text-xs inline-flex items-center gap-1.5 transition-colors ${
                    soloEnCurso
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Plane size={13} /> Solo de vacaciones hoy
                  <span className="font-mono">{enVacacionesAhora.length}</span>
                </button>
                <select
                  value={rango.modo === "mes" ? "mes" : rango.largo}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "mes") {
                      const hoy = new Date();
                      setRango({ modo: "mes", anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 });
                    } else {
                      setRango({ modo: "semanas", largo: v as LargoSemanas, offset: 0 });
                    }
                  }}
                  className="h-8 rounded-lg border border-border bg-background px-2 text-xs text-foreground"
                >
                  <option value="mes">Un mes</option>
                  <option value="10">10 semanas</option>
                  <option value="13">3 meses</option>
                  <option value="26">6 meses</option>
                  <option value="resto">Resto del año</option>
                  <option value="52">Año completo</option>
                </select>
                {/* Navegación: sin esto la ventana arrancaba siempre hoy y no se
                    podía mirar el mes que se está liquidando. */}
                <div className="inline-flex items-center rounded-lg border border-border overflow-hidden">
                  <button
                    type="button"
                    onClick={() => irVentana(-1)}
                    title={rango.modo === "mes" ? "Mes anterior" : "Ventana anterior"}
                    className="h-8 px-1.5 text-muted-foreground hover:bg-muted/50"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className="px-2 text-xs font-medium text-foreground whitespace-nowrap tabular-nums">
                    {rangoLabel}
                  </span>
                  <button
                    type="button"
                    onClick={() => irVentana(1)}
                    title={rango.modo === "mes" ? "Mes siguiente" : "Ventana siguiente"}
                    className="h-8 px-1.5 text-muted-foreground hover:bg-muted/50"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
                {!ventanaTieneHoy && (
                  <button
                    type="button"
                    onClick={volverAHoy}
                    className="h-8 px-2.5 rounded-lg border border-border bg-background text-xs text-muted-foreground hover:text-foreground"
                  >
                    Hoy
                  </button>
                )}
              </>
            )}
            <div className="inline-flex rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => setVista("semanas")}
                className={`px-2.5 h-8 text-xs inline-flex items-center gap-1 ${vista === "semanas" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}
              >
                <CalendarRange size={13} /> Semanas
              </button>
              <button
                onClick={() => setVista("anual")}
                className={`px-2.5 h-8 text-xs inline-flex items-center gap-1 ${vista === "anual" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}
              >
                <CalendarDays size={13} /> Año
              </button>
            </div>
          </div>
        </div>

        {vista === "anual" ? (
          <CronogramaAnual periodos={periodosFiltrados} anio={finPeriodoY} />
        ) : filasCrono.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">
            {soloEnCurso
              ? "Nadie está de vacaciones hoy dentro de esta ventana."
              : "Nadie tiene vacaciones en esta ventana para este filtro."}
            {soloEnCurso && (
              <div className="mt-1 text-[13px]">
                Sacá el filtro{" "}
                <button type="button" onClick={() => setSoloEnCurso(false)} className="font-medium text-primary hover:underline">
                  “Solo de vacaciones hoy”
                </button>{" "}
                para ver todos los del período.
              </div>
            )}
            {canWrite && !soloEnCurso && (
              <div className="mt-1 text-[13px]">
                Para cargar una, usá <span className="font-medium text-foreground">“+ Cargar vacaciones”</span> (arriba) o el <span className="font-medium text-foreground">+</span> en la tabla de saldos.
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                {/* Banda de meses: agrupa las semanas y separa las columnas. */}
                <tr className="bg-muted/60">
                  <th
                    rowSpan={2}
                    className="sticky left-0 z-20 bg-muted text-left px-4 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide w-px whitespace-nowrap shadow-[1px_0_0_0_rgba(0,0,0,0.08)]"
                  >
                    Empleado
                  </th>
                  {gruposMes.map((g) => (
                    <th
                      key={g.key}
                      colSpan={g.span}
                      className="px-2 py-1.5 text-center text-[10px] font-bold uppercase tracking-wide text-muted-foreground border-l-2 border-border"
                    >
                      {g.label}
                    </th>
                  ))}
                </tr>
                <tr className="bg-muted/40">
                  {semanas.map((s, i) => {
                    const tope = umbralPorSemana[i]!;
                    const excede = conteoPorSemana[i]! > tope;
                    const esHoy = i === idxSemanaHoy;
                    return (
                      <th
                        key={s.start}
                        className={`px-1.5 py-2 text-center text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap min-w-[2rem] ${
                          esHoy ? "bg-primary/[0.06]" : iniciosMes.has(i) ? "border-l-2 border-border" : "border-l border-border/40"
                        } ${excede ? "text-[#EF4444]" : esHoy ? "text-primary" : "text-muted-foreground/70"}`}
                        title={`${conteoPorSemana[i]} de vacaciones esta semana (máximo de ${MES_LBL[mesDeSemana(s.start) - 1]}: ${tope})`}
                      >
                        <div>{esHoy ? `${s.label} · hoy` : s.label}</div>
                        <div className={`text-[9px] font-bold ${excede ? "text-[#EF4444]" : "text-muted-foreground/50"}`}>
                          {conteoPorSemana[i]}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {filasCrono.map((f) => {
                  const filaEnCurso = f.periodos.some((pp) => pp.en_curso);
                  return (
                  <tr key={f.id} className={`border-t border-border hover:bg-muted/20 ${filaEnCurso ? "bg-muted/30" : ""}`}>
                    <td className={`sticky left-0 z-10 px-4 py-2 text-sm whitespace-nowrap shadow-[1px_0_0_0_rgba(0,0,0,0.08)] ${filaEnCurso ? "bg-[#F0FDF4]" : "bg-card"}`}>
                      {filaEnCurso && (
                        <span className="relative inline-flex mr-1.5 w-1.5 h-1.5 align-middle" title="De vacaciones hoy">
                          <span className="absolute inline-flex w-full h-full rounded-full bg-[#10B981] opacity-75 animate-ping" />
                          <span className="relative inline-flex rounded-full w-1.5 h-1.5 bg-[#10B981]" />
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => verEnTabla(f.id)}
                        title="Ver su saldo en la tabla de abajo"
                        className="font-medium text-foreground hover:text-primary text-left"
                      >
                        {f.apellido}, {f.nombre}
                      </button>
                      {sectorDe.get(f.id) && sectorDe.get(f.id) !== "Chofer" && (
                        <span className="ml-1.5 text-[10px] text-muted-foreground/70">{sectorDe.get(f.id)}</span>
                      )}
                      <Link
                        href={`/choferes/${choferSlug(f)}?tab=vacaciones`}
                        title="Abrir legajo"
                        className="ml-1.5 inline-flex align-middle text-muted-foreground/50 hover:text-primary"
                      >
                        <ExternalLink size={11} />
                      </Link>
                    </td>
                    {semanas.map((s, i) => {
                      const p = periodoEnSemana(f.periodos, i);
                      const t = p ? tramoEnSemana(p, s) : null;
                      const dropOk = !!dragInfo && dragInfo.periodo.chofer_id === f.id && !p;
                      return (
                        <td
                          key={i}
                          className={`relative px-0.5 py-2 ${
                            i === idxSemanaHoy
                              ? "bg-primary/[0.04]"
                              : iniciosMes.has(i)
                                ? "border-l-2 border-border"
                                : "border-l border-border/40"
                          } ${dropOk ? "bg-primary/5" : ""}`}
                          onDragOver={(e) => {
                            if (dropOk) e.preventDefault();
                          }}
                          onDrop={() => {
                            if (dragInfo && dropOk) {
                              const d = dragInfo;
                              setDragInfo(null);
                              void moverPeriodo(d.periodo, d.semanaStart, s.start);
                            }
                          }}
                        >
                          <button
                            type="button"
                            disabled={!canWrite && !p}
                            draggable={canWrite && !!p && p.fecha_fin >= hoyISO}
                            onDragStart={() => p && setDragInfo({ periodo: p, semanaStart: s.start })}
                            onDragEnd={() => setDragInfo(null)}
                            onClick={() =>
                              p
                                ? setDetalle(p)
                                : abrirAdd({ chofer_id: f.id, nombre: f.nombre, apellido: f.apellido }, s.start, s.end)
                            }
                            title={
                              p
                                ? `${fmtFecha(p.fecha_inicio)} → ${fmtFecha(p.fecha_fin)} · ${p.dias} día${p.dias !== 1 ? "s" : ""}${p.anio_cargo != null ? ` · descuenta ${p.anio_cargo}` : " · histórico"}${p.viajes_conflicto > 0 ? ` · ⚠ ${p.viajes_conflicto} viaje(s) asignados en esas fechas` : ""} · clic: detalle${canWrite && p.fecha_fin >= hoyISO ? " · arrastrá para mover de semana" : ""}`
                                : canWrite
                                  ? "Cargar esta semana"
                                  : ""
                            }
                            className={`relative h-5 w-full rounded-[3px] transition-colors ${
                              p
                                ? "bg-transparent cursor-pointer"
                                : canWrite
                                  ? "bg-transparent hover:bg-primary/15 border border-dashed border-transparent hover:border-primary/40"
                                  : "bg-transparent"
                            }`}
                          >
                            {p && t && (
                              <span
                                style={{ left: `${t.left}%`, width: `${t.width}%` }}
                                className={`absolute top-0 h-5 ${p.viajes_conflicto > 0 ? "bg-[#F59E0B]/80 hover:bg-[#F59E0B]" : p.en_curso ? "bg-[#059669] hover:bg-[#047857]" : "bg-[#10B981]/80 hover:bg-[#10B981]"} ${
                                  t.empiezaAca ? "rounded-l-[3px]" : ""
                                } ${t.terminaAca ? "rounded-r-[3px]" : ""}`}
                              >
                                {p.viajes_conflicto > 0 && t.terminaAca && (
                                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#EF4444] border border-white" />
                                )}
                              </span>
                            )}
                          </button>
                          {/* Línea de "hoy": sólo si la ventana llega hasta hoy
                              (mirando meses pasados no corresponde dibujarla). */}
                          {i === idxSemanaHoy && (
                            <span
                              className="pointer-events-none absolute inset-y-0.5 w-0.5 bg-primary/70 z-[1]"
                              style={{ left: `${hoyLeftPct}%` }}
                              aria-hidden
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Resumen por mes. Ojo: cuenta sólo lo que cae dentro de la ventana
                visible, así que en los extremos un mes puede aparecer recortado
                (con "Un mes" el número es el del mes completo). */}
            {resumenMeses.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 border-t border-border text-[11px]">
                <span className="font-semibold text-muted-foreground uppercase tracking-wide">Por mes:</span>
                {resumenMeses.map((m) => {
                  const excede = m.personas > m.umbral;
                  return (
                    <span
                      key={m.mes}
                      className={excede ? "text-[#EF4444] font-medium" : "text-muted-foreground"}
                      title={`${m.personas} persona(s) con vacaciones en ${m.label} dentro de la ventana · ${m.dias} días-persona · máximo del mes: ${m.umbral}`}
                    >
                      {m.label} {m.personas} pers. · {m.dias} días{excede ? " ⚠️" : ""}
                    </span>
                  );
                })}
                {rango.modo !== "mes" && (
                  <span className="text-muted-foreground/60">· recortado a la ventana visible</span>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 border-t border-border text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-[3px] bg-[#10B981]/80" /> de vacaciones (el largo de la barra son los días reales)</span>
              <span className="inline-flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-[3px] bg-[#F59E0B]/80" /> con viajes asignados en esas fechas</span>
              <span>· clic en un período: detalle{canWrite ? " · arrastralo para moverlo de semana · clic en una celda vacía: cargar" : ""}</span>
              <span className="text-[#EF4444]">
                · el número rojo marca las semanas que pasan el máximo de ausentes
                {canWrite ? "" : ` (${umbral})`}
              </span>
              {canWrite && (
                <button
                  type="button"
                  onClick={() => setUmbralOpen(true)}
                  className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary"
                  title="Cambiar el máximo de ausentes por semana (se puede definir uno distinto por mes)"
                >
                  <SlidersHorizontal size={11} /> máximo: {umbral} por semana
                  {Object.keys(cfgUmbral.porMes).length > 0 && ` (${Object.keys(cfgUmbral.porMes).length} mes/es aparte)`}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Próximos períodos */}
      {periodosVentanaFiltrados.length > 0 && (
        <div id="card-periodos" className="bg-card rounded-[8px] border border-border shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 px-5 py-4 border-b border-border">
            <CalendarRange size={16} className="text-primary" />
            <h2 className="text-sm font-bold text-foreground">Períodos en la ventana</h2>
            <span className="text-xs text-muted-foreground">({periodosVentanaFiltrados.length})</span>
            <div className="ml-auto inline-flex rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => setVistaPeriodos("timeline")}
                className={`px-2.5 h-8 text-xs inline-flex items-center gap-1 ${vistaPeriodos === "timeline" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}
              >
                <CalendarRange size={13} /> Timeline
              </button>
              <button
                onClick={() => setVistaPeriodos("lista")}
                className={`px-2.5 h-8 text-xs inline-flex items-center gap-1 ${vistaPeriodos === "lista" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}
              >
                <List size={13} /> Lista
              </button>
            </div>
          </div>

          {vistaPeriodos === "timeline" ? (
            <div className="max-h-[70vh] overflow-auto">
              {(() => {
                // Agrupa por mes de inicio; el orden cronológico ya viene dado.
                const grupos: { key: string; label: string; items: typeof periodosVentanaFiltrados }[] = [];
                for (const p of periodosVentanaFiltrados) {
                  const d = new Date(p.fecha_inicio + "T00:00:00");
                  const key = `${d.getFullYear()}-${d.getMonth()}`;
                  let g = grupos[grupos.length - 1];
                  if (!g || g.key !== key) {
                    g = { key, label: `${MES_LBL[d.getMonth()]} ${d.getFullYear()}`, items: [] };
                    grupos.push(g);
                  }
                  g.items.push(p);
                }
                return grupos.map((g) => {
                  const totalDias = g.items.reduce((a, p) => a + p.dias, 0);
                  return (
                    <section key={g.key}>
                      <div className="sticky top-0 z-10 flex items-center gap-2 px-5 py-1.5 bg-muted/90 backdrop-blur-sm border-b border-border">
                        <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{g.label}</h3>
                        <span className="text-[10px] font-mono text-muted-foreground/70">
                          {g.items.length} período{g.items.length !== 1 ? "s" : ""} · {totalDias} día{totalDias !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <ul className="divide-y divide-border">
                        {g.items.map((p) => {
                          const barra = p.viajes_conflicto > 0 ? "#F59E0B" : p.en_curso ? "#0088D1" : "#10B981";
                          return (
                            <li key={p.id} className={`group flex items-center gap-3 pl-4 pr-4 py-2.5 hover:bg-muted/20 ${p.en_curso ? "bg-muted/30" : ""}`}>
                              <span
                                className="shrink-0 grid place-items-center w-8 h-8 rounded-full text-[10px] font-bold text-white select-none"
                                style={{ backgroundColor: colorAvatar(p.nombre, p.apellido) }}
                                aria-hidden
                              >
                                {iniciales(p.nombre, p.apellido)}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => verEnTabla(p.chofer_id)}
                                    title="Ver su saldo en la tabla"
                                    className="truncate text-sm font-medium text-foreground hover:text-primary"
                                  >
                                    {p.apellido}, {p.nombre}
                                  </button>
                                  {p.en_curso && (
                                    <span className="inline-flex items-center gap-1.5 shrink-0 text-[11px] font-medium text-foreground">
                                      <span className="relative flex w-1.5 h-1.5">
                                        <span className="absolute inline-flex w-full h-full rounded-full bg-[#10B981] opacity-75 animate-ping" />
                                        <span className="relative inline-flex rounded-full w-1.5 h-1.5 bg-[#10B981]" />
                                      </span>
                                      En curso
                                    </span>
                                  )}
                                </div>
                                <div className="mt-1 flex items-center gap-2">
                                  <span className="h-1.5 rounded-full overflow-hidden bg-muted shrink-0" style={{ width: 120 }}>
                                    <span className="block h-full rounded-full" style={{ width: `${Math.min(100, (p.dias / 21) * 100)}%`, backgroundColor: barra }} />
                                  </span>
                                  {p.observaciones && <span className="truncate text-[11px] italic text-muted-foreground/80">{p.observaciones}</span>}
                                </div>
                              </div>
                              <div className="shrink-0 flex items-center gap-2 text-right">
                                <span className="font-mono text-xs text-muted-foreground whitespace-nowrap hidden sm:inline">
                                  {fmtFecha(p.fecha_inicio)} → {fmtFecha(p.fecha_fin)}
                                </span>
                                <span
                                  className="whitespace-nowrap rounded-[4px] border border-border px-2 py-0.5 font-mono text-xs text-foreground"
                                  title={p.anio_cargo != null ? `Descuenta del saldo ${p.anio_cargo}` : "Histórico: ya reflejado en el saldo, no descuenta"}
                                >
                                  {p.dias}d{p.anio_cargo != null ? ` · ${p.anio_cargo}` : " · hist."}
                                </span>
                                {p.viajes_conflicto > 0 && (
                                  <span
                                    className="whitespace-nowrap rounded-[4px] border border-[#B45309]/40 px-2 py-0.5 text-xs text-[#B45309]"
                                    title={`${p.viajes_conflicto} viaje(s) asignados dentro del período — reasignarlos o mover las vacaciones`}
                                  >
                                    ⚠ {p.viajes_conflicto}
                                  </span>
                                )}
                                {canWrite && (
                                  <span className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                                    <button onClick={() => abrirEdit(p)} className="text-muted-foreground hover:text-primary" title="Editar fechas"><Pencil size={13} /></button>
                                    <button onClick={() => setCancelar(p)} className="text-muted-foreground hover:text-[#EF4444]" title="Cancelar período"><X size={14} /></button>
                                  </span>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  );
                });
              })()}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {periodosVentanaFiltrados.map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-3 px-5 py-2.5 hover:bg-muted/20">
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => verEnTabla(p.chofer_id)}
                      title="Ver su saldo en la tabla de abajo"
                      className="text-sm font-medium text-foreground hover:text-primary"
                    >
                      {p.apellido}, {p.nombre}
                    </button>
                    {p.observaciones && <p className="text-xs text-muted-foreground italic mt-0.5 truncate">{p.observaciones}</p>}
                  </div>
                  <span className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
                    {fmtFecha(p.fecha_inicio)} → {fmtFecha(p.fecha_fin)}
                    <span
                      className="rounded-[4px] border border-border px-2 py-0.5 text-xs text-foreground"
                      title={p.anio_cargo != null ? `Descuenta del saldo ${p.anio_cargo}` : "Histórico: ya reflejado en el saldo, no descuenta"}
                    >
                      {p.dias} día{p.dias !== 1 ? "s" : ""}{p.anio_cargo != null ? ` · ${p.anio_cargo}` : ""}
                    </span>
                    {p.viajes_conflicto > 0 && (
                      <span
                        className="rounded-[4px] border border-[#B45309]/40 px-2 py-0.5 text-xs text-[#B45309]"
                        title="El chofer tiene viajes asignados dentro del período: reasignarlos o mover las vacaciones"
                      >
                        ⚠ {p.viajes_conflicto} viaje{p.viajes_conflicto !== 1 ? "s" : ""}
                      </span>
                    )}
                    {p.en_curso && <span className="text-[11px] text-foreground">En curso</span>}
                    {canWrite && (
                      <>
                        <button onClick={() => abrirEdit(p)} className="text-muted-foreground hover:text-primary" title="Editar fechas"><Pencil size={13} /></button>
                        <button onClick={() => setCancelar(p)} className="text-muted-foreground hover:text-[#EF4444]" title="Cancelar período"><X size={14} /></button>
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Saldos por sector */}
      <div id="card-saldos" className="bg-card rounded-[8px] border border-border shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 px-5 py-4 border-b border-border">
          <Palmtree size={16} className="text-primary" />
          <h2 className="text-sm font-bold text-foreground">Saldos por empleado</h2>
          <span className="text-xs text-muted-foreground">{saldosFiltrados.length} / {saldos.length}</span>
          <div className="ml-auto flex flex-wrap justify-end items-center gap-2">
            <div className="relative hidden md:block">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar…"
                className="h-8 w-36 pl-7 pr-2 rounded-lg border border-border bg-background text-xs text-foreground"
              />
            </div>
            <div className="inline-flex rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => cambiarVistaTabla("resumen")}
                className={`px-2.5 h-8 text-xs inline-flex items-center gap-1 ${vistaTabla === "resumen" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}
              >
                <Table2 size={13} /> Resumen
              </button>
              <button
                onClick={() => cambiarVistaTabla("tarjetas")}
                title="Tarjetas con medidor de uso por empleado"
                className={`px-2.5 h-8 text-xs inline-flex items-center gap-1 ${vistaTabla === "tarjetas" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}
              >
                <LayoutGrid size={13} /> Tarjetas
              </button>
              <button
                onClick={() => cambiarVistaTabla("anios")}
                title="Saldo y otorgados de cada año, como la planilla"
                className={`px-2.5 h-8 text-xs inline-flex items-center gap-1 ${vistaTabla === "anios" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}
              >
                <CalendarDays size={13} /> Por año
              </button>
            </div>
          </div>
        </div>
        {vistaTabla === "tarjetas" ? (
          <div className="p-4 space-y-5">
            {saldosPorSector.map((g) => (
              <section key={g.sector}>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-1 pb-2 mb-2 border-b border-border">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-foreground">
                    {g.sector === "Chofer" ? "Choferes" : g.sector} · {g.filas.length}
                  </h3>
                  <span className="text-[11px] text-muted-foreground/80">
                    saldo {finPeriodoY - 1}: <span className={`font-mono ${g.saldoViejo > 0 ? "text-[#EF4444]" : ""}`}>{g.saldoViejo}</span>
                    {" · "}días {finPeriodoY}: <span className="font-mono">{g.diasAnio}</span>
                    {" · "}disp.: <span className="font-mono text-[#10B981]">{g.disp}</span>
                  </span>
                </div>
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {g.filas.map((s) => {
                    const amber = Math.max(0, s.tomados);
                    const rojo = Math.max(0, s.adeudados);
                    const verde = Math.max(0, s.disponibles - s.adeudados);
                    const denom = amber + verde + rojo || 1;
                    return (
                      <div
                        key={s.chofer_id}
                        id={`saldo-${s.chofer_id}`}
                        className={`group flex flex-col rounded-[6px] border bg-card transition-colors ${
                          resaltado === s.chofer_id
                            ? "border-primary/50 ring-1 ring-primary/20"
                            : "border-border hover:border-foreground/20"
                        }`}
                      >
                        <div className="flex items-baseline justify-between gap-3 px-3.5 pt-3">
                          <Link
                            href={`/choferes/${choferSlug(s)}?tab=vacaciones`}
                            title={`${s.apellido}, ${s.nombre}`}
                            className="min-w-0 truncate text-[13px] font-medium leading-tight text-foreground hover:text-primary"
                          >
                            {s.apellido}, {s.nombre}
                          </Link>
                          <span className="shrink-0 text-right leading-none">
                            <span
                              className={`font-mono text-xl font-semibold tabular-nums ${
                                s.disponibles < 0
                                  ? "text-[#B91C1C]"
                                  : s.disponibles === 0
                                    ? "text-muted-foreground"
                                    : "text-foreground"
                              }`}
                            >
                              {s.disponibles}
                            </span>
                            <span className="ml-1 text-[10px] text-muted-foreground">días</span>
                          </span>
                        </div>

                        {/* Estado en texto con un punto de color, en vez de
                            pastillas de fondo pastel. */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3.5 pt-1.5 text-[11px] text-muted-foreground">
                          {s.en_vacaciones_ahora && (
                            <span className="inline-flex items-center gap-1.5 text-foreground">
                              <span className="inline-block size-1.5 rounded-full bg-[#059669]" aria-hidden />
                              De vacaciones
                            </span>
                          )}
                          {s.adeudados > 0 && s.vence_saldo && (
                            <span className="inline-flex items-center gap-1.5 text-[#B91C1C]">
                              <span className="inline-block size-1.5 rounded-full bg-[#B91C1C]" aria-hidden />
                              {s.adeudados} vencen el {s.vence_saldo}
                            </span>
                          )}
                          {!s.en_vacaciones_ahora && s.adeudados === 0 && (
                            <span>{s.anios} año{s.anios !== 1 ? "s" : ""} de antigüedad</span>
                          )}
                        </div>

                        <div className="px-3.5 pb-3 pt-2.5">
                          <div className="flex h-1 w-full overflow-hidden rounded-[2px] bg-muted">
                            {amber > 0 && (
                              <div style={{ width: `${(amber / denom) * 100}%`, backgroundColor: "#94A3B8" }} title={`Tomados este año: ${amber}`} />
                            )}
                            {verde > 0 && (
                              <div style={{ width: `${(verde / denom) * 100}%`, backgroundColor: "#059669" }} title={`Disponible del ${finPeriodoY}: ${verde}`} />
                            )}
                            {rojo > 0 && (
                              <div style={{ width: `${(rojo / denom) * 100}%`, minWidth: 4, backgroundColor: "#B91C1C" }} title={`Por vencer del ${finPeriodoY - 1}: ${rojo}`} />
                            )}
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-2 text-[11px] tabular-nums text-muted-foreground">
                            <span>
                              <span className="font-mono text-foreground">{s.corresponden}</span> del {finPeriodoY}
                            </span>
                            <span>
                              <span className="font-mono text-foreground">{s.tomados}</span> tomados
                            </span>
                            <span className={s.adeudados > 0 ? "text-[#B91C1C]" : ""}>
                              <span className="font-mono">{s.adeudados}</span> del {finPeriodoY - 1}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 border-t border-border px-3.5 py-1.5 text-[11px] text-muted-foreground">
                          <span className="truncate" title={s.hito !== "—" ? s.hito : s.proximo_hito}>
                            {s.hito !== "—" ? s.hito.replace("★ ", "") : s.proximo_hito}
                          </span>
                          <span className="flex shrink-0 items-center gap-2">
                            {s.desfasaje && (
                              <span
                                className="text-[#B45309]"
                                title={`Por antigüedad le corresponderían ${s.dias_segun_antiguedad} días`}
                              >
                                revisar días
                              </span>
                            )}
                            {canWrite && (
                              <button
                                type="button"
                                onClick={() => abrirAdd({ chofer_id: s.chofer_id, nombre: s.nombre, apellido: s.apellido })}
                                title="Cargar vacaciones"
                                className="opacity-0 transition-opacity hover:text-primary group-hover:opacity-100"
                              >
                                <Plus size={13} />
                              </button>
                            )}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
            {saldosPorSector.length === 0 && (
              <div className="py-10 text-center text-sm text-muted-foreground">Nadie coincide con el filtro.</div>
            )}
          </div>
        ) : (
        <>
        {/* Alto acotado: la tabla scrollea adentro y el encabezado queda fijo
            (los ancestros con overflow rompen el sticky contra la página). */}
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-20 [&_th]:bg-muted [&_th]:shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
              <tr>
                <th className="px-2 py-2.5 w-8" />
                {(vistaTabla === "resumen"
                  ? ["Empleado", "Ingreso", "Antig.", "Hito", `Saldo ${finPeriodoY - 1}`, `Días ${finPeriodoY}`, "Total", "Tomados", "Disp.", "Vence", "Próx. hito"]
                  : ["Empleado", "Ingreso", "Antig.", "Hito", ...aniosColumnas.map((a) => `Saldo ${a}`), "Disp.", "Vence", "Próx. hito"]
                ).map((c, i, arr) => (
                  <th key={c} className={`px-3 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap ${i === 0 || i === 3 || i >= arr.length - 2 ? "text-left" : "text-right"}`}>{c}</th>
                ))}
                {canWrite && <th className="px-3 py-2.5 w-20" />}
              </tr>
            </thead>
            {saldosPorSector.map((g) => (
              <tbody key={g.sector}>
                <tr className="bg-muted/20">
                  <td
                    colSpan={1 + (vistaTabla === "resumen" ? 11 : 7 + aniosColumnas.length) + (canWrite ? 1 : 0)}
                    className="px-4 py-1.5 text-[11px] uppercase tracking-wider text-muted-foreground"
                  >
                    <span className="font-bold">{g.sector === "Chofer" ? "Choferes" : g.sector} · {g.filas.length}</span>
                    <span className="ml-3 normal-case tracking-normal font-normal text-muted-foreground/80">
                      saldo {finPeriodoY - 1}: <span className={`font-mono ${g.saldoViejo > 0 ? "text-[#EF4444]" : ""}`}>{g.saldoViejo}</span>
                      {" · "}días {finPeriodoY}: <span className="font-mono">{g.diasAnio}</span>
                      {" · "}disponibles: <span className="font-mono">{g.disp}</span>
                    </span>
                  </td>
                </tr>
                {g.filas.map((s) => {
                  const editing = editSaldo === s.chofer_id;
                  return (
                    <tr
                      key={s.chofer_id}
                      id={`saldo-${s.chofer_id}`}
                      className={`border-t border-border hover:bg-muted/20 transition-colors ${
                        resaltado === s.chofer_id ? "bg-primary/10 ring-2 ring-inset ring-primary/50" : ""
                      }`}
                    >
                      <td className="px-2 py-2 text-center">{s.semaforo}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <Link href={`/choferes/${choferSlug(s)}?tab=vacaciones`} className="font-medium text-foreground hover:text-primary inline-flex items-center gap-1.5">
                          {s.apellido}, {s.nombre}
                          {s.en_vacaciones_ahora && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                              <span className="inline-block size-1.5 rounded-full bg-[#059669]" aria-hidden />
                              de vacaciones
                            </span>
                          )}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground whitespace-nowrap">{fmtIngreso(s.fecha_ingreso)}</td>
                      <td className="px-3 py-2 text-right font-mono text-muted-foreground">{s.anios}</td>
                      <td className="px-3 py-2 text-left text-xs text-muted-foreground whitespace-nowrap">
                        {s.hito}
                        {s.desfasaje && <span className="ml-1 text-amber-500" title={`Por antigüedad le corresponderían ${s.dias_segun_antiguedad}`}>⚠</span>}
                      </td>
                      {vistaTabla === "anios" ? (
                        aniosColumnas.map((anio) => {
                          const a = s.saldos_anio.find((x) => x.anio === anio);
                          const vencido = anio < finPeriodoY - 1;
                          // En edición se tipean los días OTORGADOS de ese año;
                          // el saldo se recalcula solo al guardar.
                          if (editing) {
                            return (
                              <td key={anio} className="px-3 py-2 text-right whitespace-nowrap">
                                <input
                                  value={editAnios[anio] ?? ""}
                                  placeholder="—"
                                  onChange={(e) =>
                                    setEditAnios((p) => {
                                      const next = { ...p };
                                      if (e.target.value.trim() === "") delete next[anio];
                                      else next[anio] = e.target.value;
                                      return next;
                                    })
                                  }
                                  title={`Días que le corresponden por ${anio}${a && a.usados > 0 ? ` · ${a.usados} ya tomados` : ""}`}
                                  className="w-14 h-7 text-right rounded border border-border bg-background px-1 font-mono text-sm"
                                />
                              </td>
                            );
                          }
                          return (
                            <td
                              key={anio}
                              className="px-3 py-2 text-right whitespace-nowrap"
                              title={vencido ? `Venció el 31/12/${anio + 1}${a?.observaciones ? ` · ${a.observaciones}` : ""}` : (a?.observaciones ?? undefined)}
                            >
                              {a ? (
                                <>
                                  <span className={`font-mono font-semibold ${vencido ? "line-through text-muted-foreground/50" : a.saldo > 0 ? (anio < finPeriodoY ? "text-[#EF4444]" : "text-foreground") : "text-muted-foreground"}`}>{a.saldo}</span>
                                  <span className="font-mono text-[10px] text-muted-foreground/60"> /{a.otorgados}</span>
                                </>
                              ) : (
                                <span className="text-muted-foreground/40">—</span>
                              )}
                            </td>
                          );
                        })
                      ) : (
                        <>
                          <td className="px-3 py-2 text-right">
                            {editing ? (
                              <input value={editAdeu} onChange={(e) => setEditAdeu(e.target.value)} className="w-12 h-7 text-right rounded border border-border bg-background px-1 font-mono text-sm" />
                            ) : (
                              <span title={desglose(s)} className={`font-mono cursor-help ${s.adeudados > 0 ? "text-[#EF4444] font-semibold" : "text-muted-foreground"}`}>{s.adeudados}</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {editing ? (
                              <input value={editCorr} onChange={(e) => setEditCorr(e.target.value)} className="w-12 h-7 text-right rounded border border-border bg-background px-1 font-mono text-sm" />
                            ) : (
                              <span className="font-mono text-muted-foreground">{s.corresponden}</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-semibold text-foreground">{s.total}</td>
                          <td className="px-3 py-2 text-right font-mono text-[#92400E]">{s.tomados}</td>
                        </>
                      )}
                      <td title={desglose(s)} className={`px-3 py-2 text-right font-mono font-semibold cursor-help ${s.disponibles < 0 ? "text-[#EF4444]" : s.disponibles === 0 ? "text-muted-foreground" : "text-[#10B981]"}`}>{s.disponibles}</td>
                      <td className="px-3 py-2 text-left text-xs whitespace-nowrap">
                        {s.vence_saldo ? (
                          <span className="text-[#EF4444] font-medium" title={`Saldo ${finPeriodoY - 1}: si no se toma antes del 31/12/${finPeriodoY}, se pierde`}>{s.vence_saldo}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                        <span className="block text-[10px] text-muted-foreground/60" title={`Ventana para otorgar el período ${finPeriodoY}`}>
                          per. {finPeriodoY}: {s.vence_periodo}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-left text-xs whitespace-nowrap text-muted-foreground">{s.proximo_hito}</td>
                      {canWrite && (
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-end gap-1.5">
                            {editing ? (
                              <>
                                <button onClick={() => guardarSaldo(s)} className="text-[#10B981] hover:opacity-70" title="Guardar"><Check size={15} /></button>
                                <button onClick={() => setEditSaldo(null)} className="text-muted-foreground hover:opacity-70" title="Cancelar"><X size={15} /></button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => abrirAdd({ chofer_id: s.chofer_id, nombre: s.nombre, apellido: s.apellido })} className="text-muted-foreground hover:text-primary" title="Cargar vacaciones"><Plus size={15} /></button>
                                <button
                                  onClick={() => abrirEditSaldo(s)}
                                  className="text-muted-foreground hover:text-primary"
                                  title={vistaTabla === "anios" ? "Editar los días que corresponden de cada año" : "Editar saldo"}
                                >
                                  <Pencil size={13} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            ))}
          </table>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 border-t border-border text-[11px] text-muted-foreground">
          <span>🔴 saldo del año anterior por vencer</span>
          <span>🟠 mucho acumulado (≥28)</span>
          <span>🟡 atención (≥21)</span>
          <span>🟢 ok</span>
        </div>
        </>
        )}
      </div>

      {/* Diálogo cargar */}
      <CargarVacacionesDialog
        key={addKey}
        open={addOpen}
        onOpenChange={setAddOpen}
        onSuccess={refrescar}
        choferes={choferesOpts}
        choferFijo={addChofer}
        inicioPreset={addInicio}
        finPreset={addFin}
        sugerencias={sugerencias}
      />

      {/* Diálogo editar período */}
      <EditarPeriodoDialog
        key={`edit-${editKey}`}
        periodo={editPeriodo}
        open={!!editPeriodo}
        onOpenChange={(v) => !v && setEditPeriodo(null)}
        onSuccess={refrescar}
      />

      {/* Confirmar carga del plan completo */}
      <ConfirmDialog
        open={confirmPlan}
        onOpenChange={setConfirmPlan}
        title="Cargar todo el plan sugerido"
        description={`Se van a cargar ${plan.items.length} período(s) de vacaciones (${plan.items.reduce((a, i) => a + i.dias, 0)} días) para liquidar los saldos ${finPeriodoY - 1} antes del 31/12. Después podés mover o quitar cualquiera desde el cronograma.`}
        confirmLabel="Cargar plan"
        destructive={false}
        loading={planCargando}
        onConfirm={aplicarPlan}
      />

      {/* Importar planilla de Bárbara con vista previa */}
      <ImportarPlanillaDialog open={importOpen} onOpenChange={setImportOpen} onSuccess={refrescar} />

      {/* Máximo de ausentes por semana (base + por mes) */}
      {canWrite && (
        <UmbralDialog
          key={`umbral-${umbralOpen}`}
          open={umbralOpen}
          onOpenChange={setUmbralOpen}
          config={cfgUmbral}
          choferesActivos={choferesActivos}
          onSuccess={refrescar}
        />
      )}

      {/* Detalle de un período (clic en el cronograma) */}
      <Dialog open={!!detalle} onOpenChange={(v) => !v && setDetalle(null)}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="text-foreground text-lg">
              {detalle && `${detalle.apellido}, ${detalle.nombre}`}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {detalle && (
                <>
                  {fmtFecha(detalle.fecha_inicio)} → {fmtFecha(detalle.fecha_fin)} · {detalle.dias} día{detalle.dias !== 1 ? "s" : ""}
                  {detalle.anio_cargo != null ? ` · descuenta del saldo ${detalle.anio_cargo}` : " · histórico (no descuenta)"}
                  {detalle.en_curso && " · en curso"}
                  {detalle.viajes_conflicto > 0 && (
                    <span className="block mt-1 text-[#92400E]">
                      ⚠ Tiene {detalle.viajes_conflicto} viaje{detalle.viajes_conflicto !== 1 ? "s" : ""} asignado{detalle.viajes_conflicto !== 1 ? "s" : ""} dentro del período — reasignarlos o mover las vacaciones.
                    </span>
                  )}
                  {detalle.observaciones && (
                    <span className="block mt-1 italic">{detalle.observaciones}</span>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-wrap gap-2">
            <Button
              variant="outline"
              className="text-muted-foreground border-border"
              onClick={() => {
                if (detalle) verEnTabla(detalle.chofer_id);
                setDetalle(null);
              }}
            >
              Ver saldo en la tabla
            </Button>
            {detalle && (
              <Button
                variant="outline"
                className="text-muted-foreground border-border"
                onClick={() => router.push(`/choferes/${choferSlug(detalle)}?tab=vacaciones`)}
              >
                <ExternalLink size={13} className="mr-1" /> Abrir legajo
              </Button>
            )}
            {canWrite && (
              <>
                <Button
                  variant="outline"
                  className="text-muted-foreground border-border"
                  onClick={() => {
                    if (detalle) abrirEdit(detalle);
                    setDetalle(null);
                  }}
                >
                  <Pencil size={13} className="mr-1" /> Editar fechas
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setCancelar(detalle);
                    setDetalle(null);
                  }}
                >
                  Quitar
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar cancelación */}
      <Dialog open={!!cancelar} onOpenChange={(v) => !v && setCancelar(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-foreground text-lg">Quitar vacaciones</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {cancelar && (
                <>
                  {cancelar.apellido}, {cancelar.nombre} · {fmtFecha(cancelar.fecha_inicio)} → {fmtFecha(cancelar.fecha_fin)} ({cancelar.dias} días). Se cancela el período (queda en el historial).
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCancelar(null)} className="text-muted-foreground border-border">Volver</Button>
            <Button variant="destructive" onClick={confirmarCancelar}>Quitar período</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
  emoji,
  info,
  onClick,
}: {
  label: string;
  value: number;
  tone: "danger" | "brand" | "success" | "muted";
  emoji: string;
  info: string;
  onClick?: () => void;
}) {
  const valueClass =
    tone === "danger" ? "text-[#EF4444]" : tone === "brand" ? "text-primary" : tone === "success" ? "text-[#10B981]" : "text-foreground";
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div
            onClick={onClick}
            className={`rounded-[8px] border border-border bg-card p-3 hover:border-primary/40 hover:shadow-sm transition-colors ${onClick ? "cursor-pointer" : "cursor-help"}`}
          >
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <span>{emoji}</span>
              <span className="truncate">{label}</span>
              <Info size={12} className="ml-auto shrink-0 text-muted-foreground/40" />
            </div>
            <div className={`text-2xl font-bold ${valueClass}`}>{value}</div>
          </div>
        }
      />
      <TooltipContent side="bottom" className="block max-w-[260px] text-left leading-snug">
        {info}
      </TooltipContent>
    </Tooltip>
  );
}
