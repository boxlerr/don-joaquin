"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Palmtree,
  CalendarRange,
  Plus,
  RefreshCw,
  Search,
  Pencil,
  Check,
  X,
  AlertTriangle,
} from "lucide-react";
import { choferSlug } from "@/lib/chofer-slug";
import { guardarSaldoVacacionesAction, cancelarAusenciaAction } from "../[slug]/actions";
import { recalcularDiasPorAntiguedadAction } from "./actions";
import CargarVacacionesDialog, { type ChoferOpcion } from "./CargarVacacionesDialog";
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

const SEMANAS = 10;
const UMBRAL_SOLAPE = 4; // semanas con más de N de vacaciones se marcan
const SECTORES: VacacionesSector[] = ["Chofer", "Oficina", "Taller"];

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

  // --- Diálogos --------------------------------------------------------------
  const [addOpen, setAddOpen] = useState(false);
  const [addChofer, setAddChofer] = useState<ChoferOpcion | null>(null);
  const [addInicio, setAddInicio] = useState<string | undefined>();
  const [addFin, setAddFin] = useState<string | undefined>();
  const [addKey, setAddKey] = useState(0); // fuerza remonte con estado fresco
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
  const semanas = Array.from({ length: SEMANAS }, (_, i) => {
    const start = new Date(inicioSem);
    start.setDate(start.getDate() + i * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { start: toISO(start), end: toISO(end), label: fmtDiaMes(start) };
  });
  const finVentana = semanas[semanas.length - 1]!.end;
  const inicioVentana = semanas[0]!.start;

  const periodosEnVentana = periodos.filter((p) => p.fecha_inicio <= finVentana && p.fecha_fin >= inicioVentana);

  // Solapamiento por semana (sobre TODOS, no sobre el filtro).
  const conteoPorSemana = semanas.map(
    (s) => new Set(periodosEnVentana.filter((p) => p.fecha_inicio <= s.end && p.fecha_fin >= s.start).map((p) => p.chofer_id)).size,
  );

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

  // Filas del cronograma: choferes con período en ventana que pasan el filtro.
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
  const urgentes = saldos.filter((s) => s.adeudados > 0).length;
  const desfasados = saldos.filter((s) => s.desfasaje).length;

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

      {desfasados > 0 && canWrite && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-[8px] border border-amber-200 bg-amber-50 text-sm text-amber-800">
          <AlertTriangle size={15} />
          {desfasados} empleado(s) tienen los días cargados desfasados de su antigüedad actual. Usá
          “Recalcular antigüedad” para ajustarlos.
        </div>
      )}

      {/* De vacaciones ahora */}
      <div className="bg-card rounded-[8px] border border-border shadow-sm dark:shadow-none px-5 py-4">
        <div className="flex items-center gap-2 mb-2">
          <Palmtree size={16} className="text-[#10B981]" />
          <h2 className="text-sm font-bold text-foreground">De vacaciones ahora</h2>
          <span className="text-xs font-semibold text-muted-foreground">({enVacacionesAhora.length})</span>
        </div>
        {enVacacionesAhora.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ningún empleado está de vacaciones hoy.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {enVacacionesAhora.map((s) => (
              <Link
                key={s.chofer_id}
                href={`/choferes/${choferSlug(s)}?tab=vacaciones`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#ECFDF5] dark:bg-emerald-950/30 text-[#065F46] dark:text-emerald-300 border border-[#A7F3D0] dark:border-emerald-800/40 hover:bg-[#D1FAE5] transition-colors"
              >
                <Palmtree size={11} />
                {s.apellido}, {s.nombre}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Cronograma interactivo */}
      <div className="bg-card rounded-[8px] border border-border shadow-sm dark:shadow-none overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
          <CalendarRange size={16} className="text-primary" />
          <h2 className="text-sm font-bold text-foreground">Cronograma · próximas {SEMANAS} semanas</h2>
          <span className="text-[11px] text-muted-foreground">
            · solo aparecen los que ya tienen vacaciones cargadas{canWrite ? " · clic en una celda para cargar o quitar" : ""}
          </span>
        </div>
        {filasCrono.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">
            Nadie tiene vacaciones en las próximas {SEMANAS} semanas para este filtro.
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
                      className={`px-1.5 py-2 text-center text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap ${
                        conteoPorSemana[i]! > UMBRAL_SOLAPE
                          ? "text-[#EF4444]"
                          : i === 0
                            ? "text-primary"
                            : "text-muted-foreground/70"
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
                                ? "bg-[#10B981]/80 dark:bg-emerald-500/70 hover:bg-[#EF4444]/70"
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
            <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 border-t border-border text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-[3px] bg-[#10B981]/80" /> de vacaciones</span>
              <span className="inline-flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-[3px] bg-[#EF4444]/70" /> al pasar el mouse: quitar</span>
              <span className="text-[#EF4444]">· el número rojo marca semanas con más de {UMBRAL_SOLAPE} ausentes</span>
            </div>
          </div>
        )}
      </div>

      {/* Próximos períodos */}
      {periodosEnVentana.filter((p) => idsFiltrados.has(p.chofer_id)).length > 0 && (
        <div className="bg-card rounded-[8px] border border-border shadow-sm dark:shadow-none overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
            <CalendarRange size={16} className="text-primary" />
            <h2 className="text-sm font-bold text-foreground">Períodos en la ventana</h2>
          </div>
          <ul className="divide-y divide-border">
            {periodosEnVentana
              .filter((p) => idsFiltrados.has(p.chofer_id))
              .map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-2.5 hover:bg-muted/20">
                  <span className="text-sm font-medium text-foreground">{p.apellido}, {p.nombre}</span>
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    {fmtFecha(p.fecha_inicio)} → {fmtFecha(p.fecha_fin)}
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]">{p.dias} día{p.dias !== 1 ? "s" : ""}</span>
                    {p.en_curso && <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#FFFBEB] text-[#92400E] border border-[#FEF3C7]">En curso</span>}
                    {canWrite && (
                      <button onClick={() => setCancelar(p)} className="text-muted-foreground hover:text-[#EF4444]" title="Cancelar período">
                        <X size={14} />
                      </button>
                    )}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      )}

      {/* Saldos por sector */}
      <div className="bg-card rounded-[8px] border border-border shadow-sm dark:shadow-none overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Palmtree size={16} className="text-primary" />
            <h2 className="text-sm font-bold text-foreground">Saldos por empleado</h2>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {urgentes > 0 && <span className="font-semibold text-[#EF4444]">🔴 {urgentes} con saldo {finPeriodoY - 1} por vencer</span>}
            <span>{saldosFiltrados.length} / {saldos.length}</span>
          </div>
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
                      <td className="px-3 py-2 text-right font-mono text-[#92400E] dark:text-amber-300">{s.tomados}</td>
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
