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
} from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { choferSlug } from "@/lib/chofer-slug";
import { guardarSaldoVacacionesAction, cancelarAusenciaAction } from "../[slug]/actions";
import { recalcularDiasPorAntiguedadAction } from "./actions";
import CargarVacacionesDialog, { type ChoferOpcion, type SugerenciaSemana } from "./CargarVacacionesDialog";
import EditarPeriodoDialog from "./EditarPeriodoDialog";
import CronogramaAnual from "./CronogramaAnual";
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

const UMBRAL_SOLAPE = 4; // semanas con más de N de vacaciones se marcan
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
function construirSemanas(inicio: Date, n: number) {
  return Array.from({ length: n }, (_, i) => {
    const start = new Date(inicio);
    start.setDate(start.getDate() + i * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { start: toISO(start), end: toISO(end), label: fmtDiaMes(start) };
  });
}

interface Props {
  saldos: VacacionesSaldoChofer[];
  periodos: VacacionesPeriodo[];
  finPeriodoY: number;
  canWrite: boolean;
}

export default function VacacionesClient({ saldos, periodos, finPeriodoY, canWrite }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // --- Filtros ---------------------------------------------------------------
  const [fSector, setFSector] = useState<"Todos" | VacacionesSector>("Todos");
  const [fSemaforo, setFSemaforo] = useState<"Todos" | "🔴" | "🟠" | "🟡" | "🟢">("Todos");
  const [busqueda, setBusqueda] = useState("");

  // --- Cronograma: rango + vista ---------------------------------------------
  const [numSemanas, setNumSemanas] = useState(10);
  const [vista, setVista] = useState<"semanas" | "anual">("semanas");

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

  const choferesOpts: ChoferOpcion[] = saldos.map((s) => ({
    chofer_id: s.chofer_id,
    nombre: s.nombre,
    apellido: s.apellido,
  }));

  const refrescar = () => startTransition(() => router.refresh());

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

  const abrirEditSaldo = (s: VacacionesSaldoChofer) => {
    setEditSaldo(s.chofer_id);
    setEditCorr(String(s.corresponden));
    setEditAdeu(String(s.adeudados));
  };
  const guardarSaldo = async (s: VacacionesSaldoChofer) => {
    const res = await guardarSaldoVacacionesAction(s.chofer_id, {
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

  const recalcular = async () => {
    const res = await recalcularDiasPorAntiguedadAction();
    if (res?.error) alert(res.error);
    else {
      alert(`Listo. ${res?.actualizados ?? 0} empleado(s) actualizados según su antigüedad.`);
      refrescar();
    }
  };

  // --- Ventana de semanas (el React Compiler memoiza solo) -------------------
  const inicioSem = lunesDe(new Date());
  const finAnio = new Date(finPeriodoY, 11, 31);
  const restoSemanas = Math.max(1, Math.ceil((finAnio.getTime() - inicioSem.getTime()) / (7 * 86_400_000)));
  const semanas = construirSemanas(inicioSem, numSemanas);
  const finVentana = semanas[semanas.length - 1]!.end;
  const inicioVentana = semanas[0]!.start;

  const periodosEnVentana = periodos.filter((p) => p.fecha_inicio <= finVentana && p.fecha_fin >= inicioVentana);

  const conteoPorSemana = semanas.map(
    (s) => new Set(periodosEnVentana.filter((p) => p.fecha_inicio <= s.end && p.fecha_fin >= s.start).map((p) => p.chofer_id)).size,
  );

  // Sugerencias: 13 semanas fijas, las 3 con menos gente (independiente del filtro de rango).
  const semanasSug = construirSemanas(inicioSem, 13);
  const sugerencias: SugerenciaSemana[] = semanasSug
    .map((s) => ({
      inicio: s.start,
      fin: s.end,
      ocupados: new Set(periodos.filter((p) => p.fecha_inicio <= s.end && p.fecha_fin >= s.start).map((p) => p.chofer_id)).size,
    }))
    .filter((s) => s.ocupados < UMBRAL_SOLAPE)
    .sort((a, b) => a.ocupados - b.ocupados || a.inicio.localeCompare(b.inicio))
    .slice(0, 3);

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
        return { mes: k, label: MES_LBL[Number(m) - 1]!, personas: v.personas.size, dias: v.dias };
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

  const filasCrono = [...new Set(periodosEnVentana.map((p) => p.chofer_id))]
    .filter((id) => idsFiltrados.has(id))
    .map((id) => {
      const ps = periodosEnVentana.filter((p) => p.chofer_id === id);
      const info = ps[0]!;
      return { id, nombre: info.nombre, apellido: info.apellido, periodos: ps };
    })
    .sort((a, b) => a.apellido.localeCompare(b.apellido));

  const periodoEnSemana = (ps: VacacionesPeriodo[], semIdx: number) =>
    ps.find((p) => p.fecha_inicio <= semanas[semIdx]!.end && p.fecha_fin >= semanas[semIdx]!.start);

  const enVacacionesAhora = saldos.filter((s) => s.en_vacaciones_ahora);
  const urgentes = saldos.filter((s) => s.adeudados > 0);
  const desfasados = saldos.filter((s) => s.desfasaje).length;
  const hoyISO = new Date().toISOString().slice(0, 10);

  // KPIs
  const diasEnRiesgo = urgentes.reduce((a, s) => a + s.adeudados, 0);
  const diasOtorgar = saldos.reduce((a, s) => a + s.corresponden, 0);
  const planificados = periodos.filter((p) => p.fecha_inicio >= hoyISO).length;

  const periodosVentanaFiltrados = periodosEnVentana.filter((p) => idsFiltrados.has(p.chofer_id));

  const saldosPorSector = SECTORES.map((sec) => ({
    sector: sec,
    filas: saldosFiltrados
      .filter((s) => s.sector === sec)
      .sort((a, b) => {
        if ((a.adeudados > 0) !== (b.adeudados > 0)) return a.adeudados > 0 ? -1 : 1;
        if (a.disponibles !== b.disponibles) return b.disponibles - a.disponibles;
        return a.apellido.localeCompare(b.apellido);
      }),
  })).filter((g) => g.filas.length > 0);

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar empleado…"
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-border bg-background text-sm text-foreground"
          />
        </div>
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
        {canWrite && (
          <>
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
            info={`Empleados que todavía tienen días del período ${finPeriodoY - 1} sin tomar. Vencen el 31/12/${finPeriodoY}: si no los toman, los pierden. Priorizá darles fecha (filtrá por 🔴 Urgentes).`}
          />
          <StatCard
            label="Días en riesgo (31/12)"
            value={diasEnRiesgo}
            tone="danger"
            emoji="⏱️"
            info={`Suma de todos los días del año anterior que vencen el 31/12/${finPeriodoY}. Es la cantidad total de días que la empresa perdería si nadie los toma a tiempo.`}
          />
          <StatCard
            label={`Días a otorgar ${finPeriodoY}`}
            value={diasOtorgar}
            tone="brand"
            emoji="🏖️"
            info={`Total de días que corresponden por ${finPeriodoY} a toda la dotación (según antigüedad: 14/21/28/35). Es lo que hay que ir planificando a lo largo del año.`}
          />
          <StatCard
            label="Períodos planificados"
            value={planificados}
            tone="muted"
            emoji="📅"
            info="Cantidad de tramos de vacaciones cargados de hoy en adelante. Aparecen en el cronograma. Cargá más con “+ Cargar vacaciones”."
          />
          <StatCard
            label="De vacaciones ahora"
            value={enVacacionesAhora.length}
            tone="success"
            emoji="✈️"
            info="Empleados que están de vacaciones hoy. Logística también los ve como no disponibles en Viajes."
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

      {/* Cronograma */}
      <div className="bg-card rounded-[8px] border border-border shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 px-5 py-4 border-b border-border">
          <CalendarRange size={16} className="text-primary" />
          <h2 className="text-sm font-bold text-foreground">Cronograma</h2>
          <span className="text-[11px] text-muted-foreground hidden sm:inline">
            {vista === "anual"
              ? `· ${finPeriodoY} completo, día por día`
              : `· solo aparecen los que ya tienen vacaciones${canWrite ? " · clic en una celda para cargar o quitar" : ""}`}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {vista === "semanas" && (
              <select
                value={numSemanas}
                onChange={(e) => setNumSemanas(Number(e.target.value))}
                className="h-8 rounded-lg border border-border bg-background px-2 text-xs text-foreground"
              >
                <option value={10}>10 semanas</option>
                <option value={13}>3 meses</option>
                <option value={26}>6 meses</option>
                <option value={restoSemanas}>Resto del año</option>
                <option value={52}>Año completo</option>
              </select>
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
            Nadie tiene vacaciones en esta ventana para este filtro.
            {canWrite && (
              <div className="mt-1 text-[13px]">
                Para cargar una, usá <span className="font-medium text-foreground">“+ Cargar vacaciones”</span> (arriba) o el <span className="font-medium text-foreground">+</span> en la tabla de saldos.
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted/40">
                  <th className="sticky left-0 z-10 bg-muted/40 text-left px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide min-w-[12rem]">
                    Empleado
                  </th>
                  {semanas.map((s, i) => (
                    <th
                      key={s.start}
                      className={`px-1.5 py-2 text-center text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap min-w-[2rem] ${
                        conteoPorSemana[i]! > UMBRAL_SOLAPE ? "text-[#EF4444]" : i === 0 ? "text-primary" : "text-muted-foreground/70"
                      }`}
                      title={`${conteoPorSemana[i]} de vacaciones esta semana`}
                    >
                      <div>{s.label}</div>
                      <div className={`text-[9px] font-bold ${conteoPorSemana[i]! > UMBRAL_SOLAPE ? "text-[#EF4444]" : "text-muted-foreground/50"}`}>
                        {conteoPorSemana[i]}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filasCrono.map((f) => (
                  <tr key={f.id} className="border-t border-border hover:bg-muted/20">
                    <td className="sticky left-0 z-10 bg-card px-4 py-2 text-sm">
                      <Link href={`/choferes/${choferSlug(f)}?tab=vacaciones`} className="font-medium text-foreground hover:text-primary">
                        {f.apellido}, {f.nombre}
                      </Link>
                    </td>
                    {semanas.map((s, i) => {
                      const p = periodoEnSemana(f.periodos, i);
                      return (
                        <td key={i} className="px-1 py-2">
                          <button
                            type="button"
                            disabled={!canWrite}
                            onClick={() =>
                              p
                                ? setCancelar(p)
                                : abrirAdd({ chofer_id: f.id, nombre: f.nombre, apellido: f.apellido }, s.start, s.end)
                            }
                            title={p ? `${fmtFecha(p.fecha_inicio)} → ${fmtFecha(p.fecha_fin)} · clic para quitar` : canWrite ? "Cargar esta semana" : ""}
                            className={`h-5 w-full rounded-[3px] transition-colors ${
                              p
                                ? "bg-[#10B981]/80 hover:bg-[#EF4444]/70"
                                : canWrite
                                  ? "bg-transparent hover:bg-primary/15 border border-dashed border-transparent hover:border-primary/40"
                                  : "bg-transparent"
                            }`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Resumen por mes */}
            {resumenMeses.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 border-t border-border text-[11px]">
                <span className="font-semibold text-muted-foreground uppercase tracking-wide">Por mes:</span>
                {resumenMeses.map((m) => (
                  <span key={m.mes} className={m.personas > 5 ? "text-[#EF4444] font-medium" : "text-muted-foreground"}>
                    {m.label} {m.personas} pers. · {m.dias} días{m.personas > 5 ? " ⚠️" : ""}
                  </span>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 border-t border-border text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-[3px] bg-[#10B981]/80" /> de vacaciones</span>
              <span className="inline-flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-[3px] bg-[#EF4444]/70" /> al pasar el mouse: quitar</span>
              <span className="text-[#EF4444]">· el número rojo marca semanas con más de {UMBRAL_SOLAPE} ausentes</span>
            </div>
          </div>
        )}
      </div>

      {/* Próximos períodos */}
      {periodosVentanaFiltrados.length > 0 && (
        <div className="bg-card rounded-[8px] border border-border shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
            <CalendarRange size={16} className="text-primary" />
            <h2 className="text-sm font-bold text-foreground">Períodos en la ventana</h2>
            <span className="text-xs text-muted-foreground">({periodosVentanaFiltrados.length})</span>
          </div>
          <ul className="divide-y divide-border">
            {periodosVentanaFiltrados.map((p) => (
              <li key={p.id} className="flex items-start justify-between gap-3 px-5 py-2.5 hover:bg-muted/20">
                <div className="min-w-0">
                  <span className="text-sm font-medium text-foreground">{p.apellido}, {p.nombre}</span>
                  {p.observaciones && <p className="text-xs text-muted-foreground italic mt-0.5 truncate">{p.observaciones}</p>}
                </div>
                <span className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
                  {fmtFecha(p.fecha_inicio)} → {fmtFecha(p.fecha_fin)}
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]">{p.dias} día{p.dias !== 1 ? "s" : ""}</span>
                  {p.en_curso && <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#FFFBEB] text-[#92400E] border border-[#FEF3C7]">En curso</span>}
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
        </div>
      )}

      {/* Saldos por sector */}
      <div className="bg-card rounded-[8px] border border-border shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Palmtree size={16} className="text-primary" />
            <h2 className="text-sm font-bold text-foreground">Saldos por empleado</h2>
          </div>
          <span className="text-xs text-muted-foreground">{saldosFiltrados.length} / {saldos.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-2 py-2.5 w-8" />
                {["Empleado", "Ingreso", "Antig.", "Hito", `Saldo ${finPeriodoY - 1}`, `Días ${finPeriodoY}`, "Total", "Tomados", "Disp.", "Vence saldo", "Próx. hito"].map((c, i) => (
                  <th key={c} className={`px-3 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap ${i === 0 || i === 3 || i === 9 || i === 10 ? "text-left" : "text-right"}`}>{c}</th>
                ))}
                {canWrite && <th className="px-3 py-2.5 w-20" />}
              </tr>
            </thead>
            {saldosPorSector.map((g) => (
              <tbody key={g.sector}>
                <tr className="bg-muted/20">
                  <td colSpan={canWrite ? 13 : 12} className="px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    {g.sector === "Chofer" ? "Choferes" : g.sector} · {g.filas.length}
                  </td>
                </tr>
                {g.filas.map((s) => {
                  const editing = editSaldo === s.chofer_id;
                  return (
                    <tr key={s.chofer_id} className="border-t border-border hover:bg-muted/20">
                      <td className="px-2 py-2 text-center">{s.semaforo}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <Link href={`/choferes/${choferSlug(s)}?tab=vacaciones`} className="font-medium text-foreground hover:text-primary inline-flex items-center gap-1.5">
                          {s.apellido}, {s.nombre}
                          {s.en_vacaciones_ahora && <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]">Ahora</span>}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground whitespace-nowrap">{fmtIngreso(s.fecha_ingreso)}</td>
                      <td className="px-3 py-2 text-right font-mono text-muted-foreground">{s.anios}</td>
                      <td className="px-3 py-2 text-left text-xs text-muted-foreground whitespace-nowrap">
                        {s.hito}
                        {s.desfasaje && <span className="ml-1 text-amber-500" title={`Por antigüedad le corresponderían ${s.dias_segun_antiguedad}`}>⚠</span>}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {editing ? (
                          <input value={editAdeu} onChange={(e) => setEditAdeu(e.target.value)} className="w-12 h-7 text-right rounded border border-border bg-background px-1 font-mono text-sm" />
                        ) : (
                          <span className={`font-mono ${s.adeudados > 0 ? "text-[#EF4444] font-semibold" : "text-muted-foreground"}`}>{s.adeudados}</span>
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
                      <td className={`px-3 py-2 text-right font-mono font-semibold ${s.disponibles < 0 ? "text-[#EF4444]" : s.disponibles === 0 ? "text-muted-foreground" : "text-[#10B981]"}`}>{s.disponibles}</td>
                      <td className="px-3 py-2 text-left text-xs whitespace-nowrap text-muted-foreground">{s.vence_saldo ?? "—"}</td>
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
                                <button onClick={() => abrirEditSaldo(s)} className="text-muted-foreground hover:text-primary" title="Editar saldo"><Pencil size={13} /></button>
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
}: {
  label: string;
  value: number;
  tone: "danger" | "brand" | "success" | "muted";
  emoji: string;
  info: string;
}) {
  const valueClass =
    tone === "danger" ? "text-[#EF4444]" : tone === "brand" ? "text-primary" : tone === "success" ? "text-[#10B981]" : "text-foreground";
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div className="rounded-[8px] border border-border bg-card p-3 cursor-help hover:border-primary/40 hover:shadow-sm transition-colors">
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
