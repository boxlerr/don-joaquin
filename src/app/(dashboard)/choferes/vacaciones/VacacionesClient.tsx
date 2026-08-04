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
  ChevronDown,
  ChevronRight,
  SlidersHorizontal,
  Plane,
  Truck,
  Briefcase,
  Wrench,
} from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { choferSlug } from "@/lib/chofer-slug";
import { coincideBusqueda } from "@/lib/texto";
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

const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

/** Ícono por área, para distinguir de un vistazo de qué legajo es cada tarjeta. */
const ICONO_SECTOR = { Chofer: Truck, Oficina: Briefcase, Taller: Wrench } as const;
import CargarVacacionesDialog, { type ChoferOpcion, type SugerenciaSemana } from "./CargarVacacionesDialog";
import EditarPeriodoDialog from "./EditarPeriodoDialog";
import UmbralDialog from "./UmbralDialog";
import ImportarPlanillaDialog from "./import-planilla/ImportarPlanillaDialog";
import CronogramaAnual from "./CronogramaAnual";
import AvatarPersona from "@/components/ui/AvatarPersona";
import {
  subeADiasEn,
  notaVisible,
  fmtRangoFechas,
  fmtDiaLargo,
  diaSiguiente,
} from "./derivar";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem } from "@/components/ui/select";
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

/** Criterios de orden de la lista de saldos. */
type OrdenSaldos = "urgencia" | "disponibles" | "porVencer" | "apellido" | "antiguedad" | "tomados";

const SECTOR_LABEL = {
  Todos: "Todos los sectores",
  Chofer: "Choferes",
  Oficina: "Oficina",
  Taller: "Taller",
} as const;

const SEMAFORO_LABEL = {
  Todos: "Todos los estados",
  "🔴": "🔴 Urgentes",
  "🟠": "🟠 Mucho acumulado",
  "🟡": "🟡 Atención",
  "🟢": "🟢 Al día",
} as const;

const RANGO_LABEL = {
  mes: "Un mes",
  "10": "10 semanas",
  "13": "3 meses",
  "26": "6 meses",
  resto: "Resto del año",
  "52": "Año completo",
} as const;

const ORDEN_SALDOS_LABEL: Record<OrdenSaldos, string> = {
  urgencia: "Urgencia",
  disponibles: "Más días disponibles",
  porVencer: "Más días por vencer",
  antiguedad: "Más antigüedad",
  tomados: "Menos días tomados",
  apellido: "Apellido (A-Z)",
};

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
  const [exportOpen, setExportOpen] = useState(false);
  const [vistaTabla, setVistaTabla] = useState<"resumen" | "anios" | "tarjetas">("tarjetas");
  // Orden de "Saldos por empleado": con 78 personas, mirar de a uno no sirve.
  const [ordenSaldos, setOrdenSaldos] = useState<OrdenSaldos>("urgencia");
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
  // Corregir las fechas en la misma fila. Antes abría un modal: para mover un
  // período un día había que abrir, editar, guardar y cerrar.
  const [editFechas, setEditFechas] = useState<string | null>(null);
  const [fechasP, setFechasP] = useState({ inicio: "", fin: "" });
  const [guardandoP, setGuardandoP] = useState(false);
  const [errorP, setErrorP] = useState<string | null>(null);

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
  // Mismo conteo inclusivo que el servidor: del 30/07 al 02/08 son 4 días.
  const diasDe = (inicio: string, fin: string) => {
    if (!inicio || !fin || fin < inicio) return 0;
    const a = new Date(inicio + "T00:00:00").getTime();
    const b = new Date(fin + "T00:00:00").getTime();
    return Math.max(1, Math.round((b - a) / 86_400_000) + 1);
  };

  const abrirFechasP = (p: VacacionesPeriodo) => {
    setEditFechas(p.id);
    setFechasP({ inicio: p.fecha_inicio, fin: p.fecha_fin });
    setErrorP(null);
  };

  const guardarFechasP = async (p: VacacionesPeriodo) => {
    if (!fechasP.inicio || !fechasP.fin) return setErrorP("Faltan las fechas.");
    if (fechasP.fin < fechasP.inicio)
      return setErrorP("La fecha de fin no puede ser anterior al inicio.");
    setGuardandoP(true);
    setErrorP(null);
    // `anio_cargo` sin definir: mover las fechas no cambia de qué año descuenta.
    const res = await editarAusenciaAction(p.id, p.chofer_id, {
      tipo: p.tipo,
      fecha_inicio: fechasP.inicio,
      fecha_fin: fechasP.fin,
      observaciones: p.observaciones,
      es_vacaciones: true,
      justificada: true,
    });
    setGuardandoP(false);
    if (res.error) setErrorP(res.error);
    else {
      setEditFechas(null);
      router.refresh();
    }
  };

  const verEnTabla = (choferId: string) => {
    const visible = saldos.some(
      (s) =>
        s.chofer_id === choferId &&
        (fSector === "Todos" || s.sector === fSector) &&
        (fSemaforo === "Todos" || s.semaforo === fSemaforo) &&
        coincideBusqueda(`${s.apellido} ${s.nombre}`, busqueda),
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
    if (!coincideBusqueda(`${s.apellido} ${s.nombre}`, busqueda)) return false;
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
        switch (ordenSaldos) {
          case "disponibles":
            return b.disponibles - a.disponibles || a.apellido.localeCompare(b.apellido);
          case "porVencer":
            return b.adeudados - a.adeudados || a.apellido.localeCompare(b.apellido);
          case "antiguedad":
            return b.anios - a.anios || a.apellido.localeCompare(b.apellido);
          case "tomados":
            return a.tomados - b.tomados || a.apellido.localeCompare(b.apellido);
          case "apellido":
            return a.apellido.localeCompare(b.apellido);
          default:
            // Urgencia: primero los que tienen días por vencer, después por saldo.
            if ((a.adeudados > 0) !== (b.adeudados > 0)) return a.adeudados > 0 ? -1 : 1;
            if (a.disponibles !== b.disponibles) return b.disponibles - a.disponibles;
            return a.apellido.localeCompare(b.apellido);
        }
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
  // Los períodos no traen la foto: se toma del saldo del mismo chofer.
  const fotoPorChofer = new Map(
    saldos.filter((s) => s.foto_url).map((s) => [s.chofer_id, s.foto_url as string]),
  );

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
        {/* Selects estilados y no nativos: el desplegable del sistema operativo
            no respeta la tipografía ni los colores del sistema. */}
        <Select value={fSector} onValueChange={(v) => v && setFSector(v as typeof fSector)}>
          <SelectTrigger className="h-9 w-[calc(50%-0.25rem)] sm:w-[11rem] text-sm">
            <span>{SECTOR_LABEL[fSector]}</span>
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(SECTOR_LABEL) as (keyof typeof SECTOR_LABEL)[]).map((k) => (
              <SelectItem key={k} value={k}>
                {SECTOR_LABEL[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={fSemaforo} onValueChange={(v) => v && setFSemaforo(v as typeof fSemaforo)}>
          <SelectTrigger className="h-9 w-[calc(50%-0.25rem)] sm:w-[11rem] text-sm">
            <span>{SEMAFORO_LABEL[fSemaforo]}</span>
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(SEMAFORO_LABEL) as (keyof typeof SEMAFORO_LABEL)[]).map((k) => (
              <SelectItem key={k} value={k}>
                {SEMAFORO_LABEL[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* Un solo botón de exportar, como el resto del sistema: adentro se
            elige el formato en vez de tener dos botones sueltos. */}
        <div className="relative">
          <Button
            variant="outline"
            onClick={() => setExportOpen((v) => !v)}
            aria-expanded={exportOpen}
            className="h-9 gap-1.5 border-border text-muted-foreground"
          >
            <Download size={14} /> Exportar
            <ChevronDown size={13} className={exportOpen ? "rotate-180 transition-transform" : "transition-transform"} />
          </Button>
          {exportOpen && (
            <>
              <button
                type="button"
                aria-label="Cerrar"
                onClick={() => setExportOpen(false)}
                className="fixed inset-0 z-10 cursor-default"
              />
              <div className="absolute left-0 z-20 mt-1 w-[19rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[8px] border border-border bg-card shadow-md">
                {[
                  {
                    titulo: "Planilla de vacaciones",
                    sub: "El formato de siempre: resumen con semáforo, por sector y urgentes.",
                    accion: exportarPlanilla,
                  },
                  {
                    titulo: "Detalle completo",
                    sub: "Saldos, períodos cargados y el cronograma de la ventana que estás viendo.",
                    accion: exportar,
                  },
                ].map((op) => (
                  <button
                    key={op.titulo}
                    type="button"
                    onClick={() => {
                      setExportOpen(false);
                      op.accion();
                    }}
                    className="block w-full border-b border-border px-3 py-2.5 text-left last:border-b-0 hover:bg-muted/40"
                  >
                    <span className="block text-[13px] font-medium text-foreground">{op.titulo}</span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{op.sub}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
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
        <div className="flex items-start sm:items-center gap-2 px-3 sm:px-4 py-2.5 rounded-[8px] border border-amber-200 bg-amber-50 text-sm text-amber-800">
          <AlertTriangle size={15} className="mt-0.5 sm:mt-0 shrink-0" />
          {desfasados} empleado(s) tienen los días cargados desfasados de su antigüedad actual. Usá
          “Recalcular antigüedad” para ajustarlos.
        </div>
      )}

      {/* Plan sugerido para liquidar los saldos viejos antes del 31/12. Se
          recalcula solo: al cargar un período, esa persona sale del plan. */}
      {urgentes.length > 0 && plan.items.length > 0 && (
        <div className="bg-card rounded-[8px] border border-border shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 px-4 sm:px-5 py-3.5">
            <span className="text-base">🧩</span>
            <h2 className="text-sm font-bold text-foreground">Plan sugerido</h2>
            <span className="text-xs text-muted-foreground">
              {plan.items.length} período(s) para liquidar los {diasEnRiesgo} días del {finPeriodoY - 1} antes del 31/12,
              sin pasar de {umbral} ausentes por semana. Se rearma solo a medida que cargás.
            </span>
            <div className="w-full sm:w-auto sm:ml-auto flex flex-wrap items-center gap-2">
              {planAbierto && canWrite && (
                <Button
                  variant="brand"
                  onClick={() => setConfirmPlan(true)}
                  className="h-9 sm:h-8 gap-1.5 text-xs"
                >
                  <Check size={13} /> Cargar todo el plan
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => setPlanAbierto((v) => !v)}
                className="h-9 sm:h-8 text-xs text-muted-foreground border-border"
              >
                {planAbierto ? "Ocultar" : "Ver plan"}
              </Button>
            </div>
          </div>
          {planAbierto && (
            <div className="border-t border-border">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[460px] sm:min-w-0 text-sm">
                  <thead className="bg-muted/40">
                    <tr>
                      {["Empleado", "Desde", "Hasta", "Días", ""].map((c, i) => (
                        <th key={i} className={`px-3 sm:px-4 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide ${i === 0 ? "text-left" : i === 4 ? "" : "text-right"}`}>{c}</th>
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
                              className="h-8 sm:h-7 text-xs text-muted-foreground border-border"
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
                <div className="px-4 sm:px-5 py-2.5 border-t border-border text-xs text-amber-700 bg-amber-50">
                  ⚠ Sin lugar en el año para: {plan.sinLugar.map((s) => `${s.apellido} (${s.dias} días)`).join(", ")} — habría que superar el umbral de {umbral} ausentes o mover otros períodos.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Cronograma */}
      <div id="card-cronograma" className="bg-card rounded-[8px] border border-border shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 px-4 sm:px-5 py-3 sm:py-4 border-b border-border">
          <CalendarRange size={16} className="text-primary" />
          <h2 className="text-sm font-bold text-foreground">Cronograma de personal con vacaciones</h2>
          <div className="w-full sm:w-auto sm:ml-auto flex flex-wrap sm:justify-end items-center gap-2">
            <div className="relative w-full sm:w-auto">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar empleado…"
                className="h-9 sm:h-8 w-full sm:w-40 pl-7 pr-2 rounded-lg border border-border bg-background text-xs text-foreground"
              />
            </div>
            {vista === "semanas" && (
              <>
                <button
                  type="button"
                  onClick={() => setSoloEnCurso((v) => !v)}
                  title="Dejar solo a los que están de vacaciones hoy (los que ya volvieron quedan afuera)"
                  className={`h-9 sm:h-8 px-2.5 rounded-lg border text-xs inline-flex items-center gap-1.5 transition-colors ${
                    soloEnCurso
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Plane size={13} /> Solo de vacaciones hoy
                  <span className="font-mono">{enVacacionesAhora.length}</span>
                </button>
                <Select
                  value={rango.modo === "mes" ? "mes" : rango.largo}
                  onValueChange={(v) => {
                    if (!v) return;
                    if (v === "mes") {
                      const hoy = new Date();
                      setRango({ modo: "mes", anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 });
                    } else {
                      setRango({ modo: "semanas", largo: v as LargoSemanas, offset: 0 });
                    }
                  }}
                >
                  <SelectTrigger className="h-9 sm:h-8 w-[8.5rem] text-xs">
                    <span>{RANGO_LABEL[rango.modo === "mes" ? "mes" : rango.largo]}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(RANGO_LABEL) as (keyof typeof RANGO_LABEL)[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {RANGO_LABEL[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* Navegación: sin esto la ventana arrancaba siempre hoy y no se
                    podía mirar el mes que se está liquidando. */}
                <div className="inline-flex items-center rounded-lg border border-border overflow-hidden">
                  <button
                    type="button"
                    onClick={() => irVentana(-1)}
                    title={rango.modo === "mes" ? "Mes anterior" : "Ventana anterior"}
                    className="h-9 sm:h-8 px-2 sm:px-1.5 text-muted-foreground hover:bg-muted/50"
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
                    className="h-9 sm:h-8 px-2 sm:px-1.5 text-muted-foreground hover:bg-muted/50"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
                {!ventanaTieneHoy && (
                  <button
                    type="button"
                    onClick={volverAHoy}
                    className="h-9 sm:h-8 px-2.5 rounded-lg border border-border bg-background text-xs text-muted-foreground hover:text-foreground"
                  >
                    Hoy
                  </button>
                )}
              </>
            )}
            <div className="inline-flex rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => setVista("semanas")}
                className={`px-2.5 h-9 sm:h-8 text-xs inline-flex shrink-0 whitespace-nowrap items-center gap-1 ${vista === "semanas" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}
              >
                <CalendarRange size={13} /> Semanas
              </button>
              <button
                onClick={() => setVista("anual")}
                className={`px-2.5 h-9 sm:h-8 text-xs inline-flex shrink-0 whitespace-nowrap items-center gap-1 ${vista === "anual" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}
              >
                <CalendarDays size={13} /> Año
              </button>
            </div>
          </div>
        </div>

        {vista === "anual" ? (
          <CronogramaAnual
            periodos={periodosFiltrados}
            anio={finPeriodoY}
            umbralConfig={cfgUmbral}
            activos={choferesActivos}
          />
        ) : filasCrono.length === 0 ? (
          <div className="px-4 sm:px-5 py-8 text-center text-sm text-muted-foreground">
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
                    className="sticky left-0 z-20 bg-muted text-left px-2 sm:px-4 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide w-px whitespace-nowrap shadow-[1px_0_0_0_rgba(0,0,0,0.08)]"
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
                    <td className={`sticky left-0 z-10 px-2 sm:px-4 py-2 text-[13px] sm:text-sm whitespace-nowrap shadow-[1px_0_0_0_rgba(0,0,0,0.08)] ${filaEnCurso ? "bg-[#F0FDF4]" : "bg-card"}`}>
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
                      {/* En celular el ícono crece a 16px y suma padding hasta
                          28x32 de zona de toque: a 11px no se le acertaba con el
                          dedo. El padding sólo se compensa hacia arriba/abajo y
                          a la derecha — hacia la izquierda quedaría encima del
                          nombre del chofer y le robaría el toque. */}
                      <Link
                        href={`/choferes/${choferSlug(f)}?tab=vacaciones`}
                        title="Abrir legajo"
                        className="ml-1.5 inline-flex align-middle text-muted-foreground/50 hover:text-primary max-md:-my-2 max-md:-mr-1.5 max-md:px-1.5 max-md:py-2"
                      >
                        <ExternalLink size={11} className="max-md:size-4" />
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

      {/* Quién se va. Antes se llamaba "Períodos en la ventana": "ventana" era
          jerga nuestra (el rango de semanas que se está mirando arriba) y nadie
          sabía qué quería decir. Ahora el título dice para qué sirve y el rango
          va escrito abajo. También se fue el conmutador Timeline/Lista: las dos
          vistas mostraban lo mismo, sólo que una peor. */}
      {periodosVentanaFiltrados.length > 0 && (
        <div id="card-periodos" className="bg-card rounded-[8px] border border-border shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 px-4 sm:px-5 py-3 sm:py-4 border-b border-border">
            <CalendarRange size={16} className="text-primary self-center" />
            <h2 className="text-sm font-bold text-foreground">Quién se va de vacaciones</h2>
            <span className="text-xs text-muted-foreground">
              {periodosVentanaFiltrados.length} período
              {periodosVentanaFiltrados.length !== 1 ? "s" : ""} en las semanas que estás viendo
            </span>
          </div>

          {errorP && (
            <div className="border-b border-red-200 bg-red-50 px-4 sm:px-5 py-2 text-sm text-red-600">{errorP}</div>
          )}

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
                const gente = new Set(g.items.map((p) => p.chofer_id)).size;
                return (
                  <section key={g.key}>
                    {/* z-20 + fondo opaco: el encabezado del mes tiene que tapar
                        la fila que se le mete por debajo al scrollear. Con
                        bg-muted/90 se transparentaba y se leían los dos textos
                        pisados. */}
                    <div className="sticky top-0 z-20 flex flex-wrap items-baseline gap-x-2 px-4 sm:px-5 py-1.5 bg-muted border-b border-border">
                      <h3 className="text-[11px] font-bold uppercase tracking-wider text-foreground">{g.label}</h3>
                      <span className="text-[11px] text-muted-foreground">
                        {gente} {gente === 1 ? "persona" : "personas"} · {totalDias} día
                        {totalDias !== 1 ? "s" : ""} sin trabajar
                      </span>
                    </div>
                    <ul className="divide-y divide-border">
                      {g.items.map((p) => {
                        const nota = notaVisible(p.observaciones);
                        const editando = editFechas === p.id;
                        return (
                          <li
                            key={p.id}
                            /* `isolate` encierra el z-index de adentro de la fila
                               (el link estirado en z-0 contra los controles en
                               z-10). Sin eso esos z-10 salían al contexto de
                               apilado de la lista y se dibujaban encima del
                               encabezado del mes al scrollear. */
                            className={`group relative isolate flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 sm:px-5 py-3 hover:bg-muted/20 ${p.en_curso ? "bg-muted/30" : ""}`}
                          >
                            {/* Toda la fila abre el legajo. El link va estirado por
                                debajo y los controles (fechas, cruz) quedan por
                                encima con su propio z-index, así cada clic hace lo
                                que parece que hace. */}
                            {!editando && (
                              <Link
                                href={`/choferes/${choferSlug(p)}?tab=vacaciones`}
                                aria-label={`Abrir el legajo de ${p.apellido}, ${p.nombre}`}
                                className="absolute inset-0 z-0"
                              />
                            )}
                            <AvatarPersona
                              name={`${p.nombre} ${p.apellido}`}
                              src={fotoPorChofer.get(p.chofer_id) ?? undefined}
                              size={36}
                              rol={sectorDe.get(p.chofer_id)}
                              className="pointer-events-none relative z-10 shrink-0"
                            />
                            <div className="pointer-events-none relative z-10 min-w-0 flex-1">
                              <div className="flex flex-wrap items-baseline gap-x-2">
                                {/* El nombre abre el legajo, que es donde se
                                    manejan las vacaciones en detalle: el saldo año
                                    por año, todos sus períodos y la corrección de
                                    los días. Antes sólo saltaba a la tabla de abajo,
                                    que muestra menos de lo que hace falta para
                                    decidir. */}
                                <span className="pointer-events-none text-[15px] font-semibold text-foreground group-hover:text-primary">
                                  {p.apellido}, {p.nombre}
                                </span>
                                {p.en_curso && (
                                  <span className="inline-flex items-center gap-1.5 shrink-0 text-[11px] font-medium text-[#059669]">
                                    <span className="relative flex w-1.5 h-1.5">
                                      <span className="absolute inline-flex w-full h-full rounded-full bg-[#10B981] opacity-75 animate-ping" />
                                      <span className="relative inline-flex rounded-full w-1.5 h-1.5 bg-[#10B981]" />
                                    </span>
                                    Está de vacaciones
                                  </span>
                                )}
                              </div>
                              {/* La pregunta operativa no es cuándo termina la
                                  licencia, es cuándo lo tenés de vuelta. */}
                              {editando ? (
                                <span className="pointer-events-auto mt-1.5 flex flex-wrap items-center gap-1.5">
                                  <Input
                                    type="date"
                                    value={fechasP.inicio}
                                    onChange={(e) => setFechasP((v) => ({ ...v, inicio: e.target.value }))}
                                    className="h-8 sm:h-7 w-[8.75rem] max-w-full text-xs"
                                    aria-label="Desde"
                                  />
                                  <span className="text-muted-foreground">→</span>
                                  <Input
                                    type="date"
                                    value={fechasP.fin}
                                    min={fechasP.inicio || undefined}
                                    onChange={(e) => setFechasP((v) => ({ ...v, fin: e.target.value }))}
                                    className="h-8 sm:h-7 w-[8.75rem] max-w-full text-xs"
                                    aria-label="Hasta"
                                  />
                                  <span className="text-xs text-muted-foreground tabular-nums">
                                    {diasDe(fechasP.inicio, fechasP.fin)} días
                                  </span>
                                  <Button
                                    variant="brand"
                                    size="sm"
                                    onClick={() => guardarFechasP(p)}
                                    disabled={guardandoP}
                                    className="h-8 sm:h-7 text-xs"
                                  >
                                    <Check size={12} className="mr-1" />
                                    {guardandoP ? "Guardando…" : "Guardar"}
                                  </Button>
                                  <button
                                    type="button"
                                    onClick={() => setEditFechas(null)}
                                    disabled={guardandoP}
                                    title="Cancelar la edición"
                                    className="p-1.5 text-muted-foreground hover:text-foreground"
                                  >
                                    <X size={13} />
                                  </button>
                                </span>
                              ) : (
                                <p className="mt-0.5 text-[13px] text-muted-foreground">
                                  <button
                                    type="button"
                                    disabled={!canWrite}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      if (canWrite) abrirFechasP(p);
                                    }}
                                    title={canWrite ? "Corregir las fechas" : undefined}
                                    className={
                                      canWrite
                                        ? "pointer-events-auto hover:text-primary hover:underline"
                                        : "cursor-default"
                                    }
                                  >
                                    {fmtRangoFechas(p.fecha_inicio, p.fecha_fin, `${finPeriodoY}-01-01`)}
                                  </button>
                                  {" · vuelve el "}
                                  <span className="font-medium text-foreground">
                                    {fmtDiaLargo(diaSiguiente(p.fecha_fin), `${finPeriodoY}-01-01`)}
                                  </span>
                                </p>
                              )}
                              {nota && (
                                <p className="mt-0.5 truncate text-[11px] italic text-muted-foreground/80">{nota}</p>
                              )}
                            </div>
                            <div className="pointer-events-none relative z-10 flex shrink-0 items-center gap-2">
                              <span className="pointer-events-none whitespace-nowrap text-[13px] tabular-nums text-muted-foreground">
                                <span className="font-semibold text-foreground">{p.dias}</span> días
                                {p.anio_cargo != null ? ` · descuenta del ${p.anio_cargo}` : " · no descuenta"}
                              </span>
                              {p.viajes_conflicto > 0 && (
                                <span
                                  className="whitespace-nowrap text-[11px] text-[#B45309]"
                                  title="Tiene viajes asignados dentro de estas fechas: hay que reasignarlos o mover las vacaciones"
                                >
                                  ⚠ {p.viajes_conflicto} viaje{p.viajes_conflicto !== 1 ? "s" : ""} encima
                                </span>
                              )}
                              {canWrite && !editando && (
                                // En el celular no hay hover: si la cruz sólo
                                // apareciera al pasar el mouse, cancelar un
                                // período sería imposible desde el teléfono.
                                // Por eso está siempre visible abajo de sm.
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setCancelar(p);
                                  }}
                                  className="pointer-events-auto p-1.5 sm:p-0 text-muted-foreground hover:text-[#EF4444] opacity-100 sm:opacity-0 transition sm:group-hover:opacity-100 focus-visible:opacity-100"
                                  title="Cancelar este período"
                                >
                                  <X size={14} />
                                </button>
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
        </div>
      )}

      <div id="card-saldos" className="bg-card rounded-[8px] border border-border shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 px-4 sm:px-5 py-3 sm:py-4 border-b border-border">
          <Palmtree size={16} className="text-primary" />
          <h2 className="text-sm font-bold text-foreground">Saldos por empleado</h2>
          <span className="text-xs text-muted-foreground">{saldosFiltrados.length} / {saldos.length}</span>
          <div className="w-full sm:w-auto sm:ml-auto flex flex-wrap sm:justify-end items-center gap-2">
            <div className="relative hidden md:block">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar…"
                className="h-8 w-36 pl-7 pr-2 rounded-lg border border-border bg-background text-xs text-foreground"
              />
            </div>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              Ordenar
              <Select value={ordenSaldos} onValueChange={(v) => v && setOrdenSaldos(v as OrdenSaldos)}>
                <SelectTrigger className="h-9 sm:h-8 w-[11rem] sm:w-[12rem] text-xs">
                  <span>{ORDEN_SALDOS_LABEL[ordenSaldos]}</span>
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ORDEN_SALDOS_LABEL) as OrdenSaldos[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {ORDEN_SALDOS_LABEL[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <div className="inline-flex max-w-full overflow-x-auto rounded-lg border border-border">
              <button
                onClick={() => cambiarVistaTabla("resumen")}
                className={`px-2.5 h-9 sm:h-8 text-xs inline-flex shrink-0 whitespace-nowrap items-center gap-1 ${vistaTabla === "resumen" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}
              >
                <Table2 size={13} /> Resumen
              </button>
              <button
                onClick={() => cambiarVistaTabla("tarjetas")}
                title="Tarjetas con medidor de uso por empleado"
                className={`px-2.5 h-9 sm:h-8 text-xs inline-flex shrink-0 whitespace-nowrap items-center gap-1 ${vistaTabla === "tarjetas" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}
              >
                <LayoutGrid size={13} /> Tarjetas
              </button>
              <button
                onClick={() => cambiarVistaTabla("anios")}
                title="Saldo y otorgados de cada año, como la planilla"
                className={`px-2.5 h-9 sm:h-8 text-xs inline-flex shrink-0 whitespace-nowrap items-center gap-1 ${vistaTabla === "anios" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}
              >
                <CalendarDays size={13} /> Por año
              </button>
            </div>
          </div>
        </div>
        {vistaTabla === "tarjetas" ? (
          <div className="p-3 sm:p-4 space-y-5">
            {saldosPorSector.map((g) => (
              <section key={g.sector}>
                {/* El título del área tiene que ganarle al resto del texto:
                    antes era del mismo tamaño que los números y se perdía. */}
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border px-1 pb-2">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    {(() => {
                      const Icono = ICONO_SECTOR[g.sector];
                      return <Icono size={15} className="text-muted-foreground" aria-hidden />;
                    })()}
                    {g.sector === "Chofer" ? "Choferes" : g.sector}
                    <span className="text-[13px] font-normal text-muted-foreground">
                      {g.filas.length}
                    </span>
                  </h3>
                  <span className="text-[11px] text-muted-foreground">
                    {g.disp} días disponibles
                    {g.saldoViejo > 0 && (
                      <>
                        {" · "}
                        <span className="text-[#B91C1C]">{g.saldoViejo} vencen el 31/12</span>
                      </>
                    )}
                  </span>
                </div>
                {/* De a 3 y no de a 4: las tarjetas necesitan ancho para que el
                    nombre entre completo y las barras se lean. */}
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {g.filas.map((s) => {
                    return (
                      <Link
                        key={s.chofer_id}
                        id={`saldo-${s.chofer_id}`}
                        href={`/choferes/${choferSlug(s)}?tab=vacaciones`}
                        title={`Abrir las vacaciones de ${s.apellido}, ${s.nombre}`}
                        className={`group flex flex-col rounded-[6px] border bg-card transition-colors ${
                          resaltado === s.chofer_id
                            ? "border-primary/50 ring-1 ring-primary/20"
                            : "border-border hover:border-foreground/30 hover:bg-muted/20"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3 px-3.5 pt-3">
                          <span className="flex min-w-0 items-center gap-2">
                            {/* Sin foto, el avatar muestra la silueta del área en
                                vez de las iniciales: en una grilla de 77, dos letras
                                al lado del nombre no aportaban y se confundían entre
                                sí. El color sigue siendo el de cada persona. */}
                            <AvatarPersona
                              name={`${s.nombre} ${s.apellido}`}
                              src={s.foto_url ?? undefined}
                              size={40}
                              rol={s.sector}
                              title={`${s.apellido}, ${s.nombre} · ${s.sector}`}
                              className="shrink-0"
                            />
                            {/* El nombre distingue una tarjeta de otra en una grilla
                                de 63: va como título. Y en dos líneas antes que
                                cortarlo ("Gallastegui, Cristian D…" obligaba a pasar
                                el mouse para saber de quién era). */}
                            <span className="min-w-0 text-[15px] font-semibold leading-snug text-foreground group-hover:text-primary line-clamp-2">
                              {s.apellido}, {s.nombre}
                            </span>
                          </span>
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
                          {/* Lo que vence pasó al desglose por año de abajo, donde
                              no se repite, y la antigüedad ya está en el pie. */}
                        </div>

                        {/* Antes: una barra de tres colores y, abajo, tres números
                            que eran su leyenda. Había que mapear color con número de
                            memoria y nadie entendía qué medía cada tramo. Ahora es un
                            año por línea, con barra de un solo color que se llena con
                            lo que le QUEDA (si se llenara con lo tomado, un año
                            agotado quedaría con la barra entera y se leería al
                            revés). Los "tomados" se fueron: Bárbara dijo que no le
                            importa cuántos días ya se tomó. */}
                        <div className="space-y-2.5 px-3.5 pb-3 pt-2.5">
                          {s.saldos_anio
                            .filter((a) => a.anio >= finPeriodoY - 1 && a.anio <= finPeriodoY)
                            .map((a) => {
                              const porVencer = a.anio === finPeriodoY - 1;
                              const queda = Math.max(0, a.saldo);
                              const pct =
                                a.otorgados > 0 ? Math.min(100, (queda / a.otorgados) * 100) : 0;
                              return (
                                <div key={a.anio}>
                                  <div className="flex items-baseline justify-between gap-2">
                                    <span className="text-[13px] font-semibold text-foreground">
                                      {a.anio}
                                      {porVencer && queda > 0 && s.vence_saldo && (
                                        <span className="ml-1.5 text-[11px] font-normal text-[#B91C1C]">
                                          vencen el {s.vence_saldo}
                                        </span>
                                      )}
                                    </span>
                                    <span className="flex items-baseline gap-1 tabular-nums">
                                      <span
                                        className={`text-lg font-semibold leading-none ${
                                          queda === 0
                                            ? "text-muted-foreground"
                                            : porVencer
                                              ? "text-[#B91C1C]"
                                              : "text-foreground"
                                        }`}
                                      >
                                        {queda}
                                      </span>
                                      <span className="text-[11px] text-muted-foreground">
                                        de {a.otorgados}
                                      </span>
                                    </span>
                                  </div>
                                  <div
                                    className="mt-1.5 h-2 w-full overflow-hidden rounded-[3px] bg-muted"
                                    title={
                                      queda > 0
                                        ? `Le quedan ${queda} de los ${a.otorgados} del ${a.anio}`
                                        : `No le queda ninguno de los ${a.otorgados} del ${a.anio}`
                                    }
                                  >
                                    <div
                                      className="h-full rounded-[3px]"
                                      style={{
                                        width: `${pct}%`,
                                        backgroundColor: porVencer ? "#B91C1C" : "#059669",
                                      }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                        </div>

                        {/* Envuelve en vez de truncar: con el hito al lado, la antigüedad
                            quedaba cortada en "28 días al …". */}
                        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 border-t border-border px-3.5 py-1.5 text-[11px] text-muted-foreground">
                          {/* El "hito" es el escalón de antigüedad de la LCT
                              (5/10/20 años): al cruzarlo le empiezan a
                              corresponder más días. Se dice qué significa en vez
                              de mostrar "≥20 años" suelto, que se leía como si
                              fuera la antigüedad. */}
                          {/* "Antigüedad: 20 años · 35 días/año" ponía dos números
                              con unidades distintas pegados y se leían como lo mismo.
                              Ahora cada uno dice de qué es. */}
                          <span
                            className="min-w-0"
                            title={`${s.anios} año${s.anios !== 1 ? "s" : ""} de antigüedad · le corresponden ${s.dias_segun_antiguedad} días de vacaciones por año`}
                          >
                            {s.anios} año{s.anios !== 1 ? "s" : ""} de antigüedad · Corresponden:{" "}
                            <span className="font-semibold text-foreground">
                              {s.dias_segun_antiguedad}
                            </span>{" "}
                            días al año
                          </span>
                          <span className="flex shrink-0 items-center gap-2">
                            {/* "sube en 37 meses" no decía qué subía ni por qué, y
                                nadie piensa en 37 meses. Ahora dice el año concreto y
                                a cuántos días pasa: es el escalón de antigüedad de la
                                LCT (5/10/20 años). */}
                            {(() => {
                              const sube = subeADiasEn(s.fecha_ingreso, s.anios);
                              if (!sube || !s.fecha_ingreso) return null;
                              // Los años que cumple en ese escalón salen de la propia
                              // cuenta: el año al que sube menos el año de ingreso.
                              const cumple = sube.anio - Number(s.fecha_ingreso.slice(0, 4));
                              return (
                                <span
                                  className="text-muted-foreground"
                                  title={`Los días por año los fija la antigüedad (LCT art. 150): al cumplir ${cumple} años pasa de ${s.dias_segun_antiguedad} a ${sube.dias} días. Cuando llega a 35 ya está en el máximo y este aviso desaparece.`}
                                >
                                  En {MESES[Number(s.fecha_ingreso.slice(5, 7)) - 1]} de{" "}
                                  {sube.anio} cumple {cumple} años y pasa a{" "}
                                  <span className="font-semibold text-foreground">{sube.dias}</span>{" "}
                                  días
                                </span>
                              );
                            })()}
                            {s.desfasaje && (
                              <span
                                className="text-[#B45309]"
                                title={`Por antigüedad le corresponderían ${s.dias_segun_antiguedad} días`}
                              >
                                revisar días
                              </span>
                            )}
                            {canWrite && (
                              // Sin hover en el celular, el "+" tiene que estar
                              // siempre a la vista.
                              <button
                                type="button"
                                onClick={(e) => {
                                  // La tarjeta entera navega al legajo: este botón
                                  // hace otra cosa, así que corta el clic.
                                  e.preventDefault();
                                  e.stopPropagation();
                                  abrirAdd({ chofer_id: s.chofer_id, nombre: s.nombre, apellido: s.apellido });
                                }}
                                title="Cargar vacaciones"
                                className="p-1 sm:p-0 opacity-100 sm:opacity-0 transition-opacity hover:text-primary sm:group-hover:opacity-100"
                              >
                                <Plus size={13} />
                              </button>
                            )}
                          </span>
                        </div>
                      </Link>
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
          {/* Tabla ancha de consulta: abajo de lg scrollea de costado con la
              columna del empleado fija; en desktop queda como estaba. */}
          <table className="w-full min-w-[900px] lg:min-w-0 text-sm">
            <thead className="sticky top-0 z-20 [&_th]:bg-muted [&_th]:shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
              <tr>
                <th className="px-2 py-2.5 w-8" />
                {(vistaTabla === "resumen"
                  ? ["Empleado", "Ingreso", "Antig.", "Hito", `Saldo ${finPeriodoY - 1}`, `Días ${finPeriodoY}`, "Total", "Tomados", "Disp.", "Vence", "Próx. hito"]
                  : ["Empleado", "Ingreso", "Antig.", "Hito", ...aniosColumnas.map((a) => `Saldo ${a}`), "Disp.", "Vence", "Próx. hito"]
                ).map((c, i, arr) => (
                  <th key={c} className={`px-3 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap ${i === 0 ? "sticky left-0 z-30 !shadow-[1px_1px_0_0_rgba(0,0,0,0.08)]" : ""} ${i === 0 || i === 3 || i >= arr.length - 2 ? "text-left" : "text-right"}`}>{c}</th>
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
                      <td
                        className={`sticky left-0 z-10 shadow-[1px_0_0_0_rgba(0,0,0,0.08)] px-3 py-2 whitespace-nowrap ${
                          resaltado === s.chofer_id ? "bg-[#E6F3FA]" : "bg-card"
                        }`}
                      >
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
                                  className="w-14 h-8 sm:h-7 text-right rounded border border-border bg-background px-1 font-mono text-sm"
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
                              <input value={editAdeu} onChange={(e) => setEditAdeu(e.target.value)} className="w-12 h-8 sm:h-7 text-right rounded border border-border bg-background px-1 font-mono text-sm" />
                            ) : (
                              <span title={desglose(s)} className={`font-mono cursor-help ${s.adeudados > 0 ? "text-[#EF4444] font-semibold" : "text-muted-foreground"}`}>{s.adeudados}</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {editing ? (
                              <input value={editCorr} onChange={(e) => setEditCorr(e.target.value)} className="w-12 h-8 sm:h-7 text-right rounded border border-border bg-background px-1 font-mono text-sm" />
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
                                <button onClick={() => guardarSaldo(s)} className="p-1 sm:p-0 text-[#10B981] hover:opacity-70" title="Guardar"><Check size={15} /></button>
                                <button onClick={() => setEditSaldo(null)} className="p-1 sm:p-0 text-muted-foreground hover:opacity-70" title="Cancelar"><X size={15} /></button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => abrirAdd({ chofer_id: s.chofer_id, nombre: s.nombre, apellido: s.apellido })} className="p-1 sm:p-0 text-muted-foreground hover:text-primary" title="Cargar vacaciones"><Plus size={15} /></button>
                                <button
                                  onClick={() => abrirEditSaldo(s)}
                                  className="p-1 sm:p-0 text-muted-foreground hover:text-primary"
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
            <div className={`text-xl sm:text-2xl font-bold ${valueClass}`}>{value}</div>
          </div>
        }
      />
      <TooltipContent side="bottom" className="block max-w-[260px] text-left leading-snug">
        {info}
      </TooltipContent>
    </Tooltip>
  );
}
