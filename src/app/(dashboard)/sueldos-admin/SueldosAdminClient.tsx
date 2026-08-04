"use client";

import { useCallback, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { TableHeader, TableHead, TableRow, TableBody, TableCell } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import MonthPicker from "@/components/ui/MonthPicker";
import AvatarPersona from "@/components/ui/AvatarPersona";
import {
  Loader2, Trash2, Save, TrendingUp, HelpCircle, X, Plus,
} from "lucide-react";
import {
  registrarAumentoAction,
  eliminarAumentoAction,
  eliminarMesAumentosAction,
  setFacturacionManualAction,
  type SueldosAdminResumen,
  type SueldoAdminEmpleado,
  type AumentoRow,
} from "./actions";
import AumentosMetricas from "./AumentosMetricas";
import PlanillaGrid from "./PlanillaGrid";
import {
  MESES_CORTO, formatMiles, mesActual, mesLabel, parseNum, pesos,
} from "./formato";
import type { InflacionData } from "@/lib/inflacion";

/** Solo el mes abreviado ("jun"), sin año — para la matriz con banda de año arriba. */
function mesAbrev(iso: string): string {
  return MESES_CORTO[parseInt(iso.slice(5, 7), 10) - 1];
}
function anioDe(iso: string): string {
  return iso.slice(0, 4);
}

// El sector se marca con un punto de color, no con una pastilla de fondo pastel.
const ROL_SECTOR: Record<SueldoAdminEmpleado["rol"], { label: string; dot: string }> = {
  administrativo: { label: "Administración", dot: "bg-blue-500" },
  mantenimiento: { label: "Taller", dot: "bg-orange-500" },
};

const thCls = "text-[11px] font-bold text-muted-foreground uppercase tracking-wider";

export default function SueldosAdminClient({
  resumen, month, canWrite, mostrar = "ambos", inflacion = null,
}: {
  resumen: SueldosAdminResumen;
  month: string;
  canWrite: boolean;
  /** "ambos" = con pestañas internas (uso standalone). "planilla"/"aumentos" =
   *  embebido en una sección con pestañas propias (unificado): solo esa parte. */
  mostrar?: "ambos" | "planilla" | "aumentos";
  /** Inflación (INDEC) para las métricas del tab Aumentos. */
  inflacion?: InflacionData | null;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"planilla" | "aumentos">("planilla");
  const embedded = mostrar !== "ambos";
  const activeTab = embedded ? mostrar : tab;
  const [aumentosDe, setAumentosDe] = useState<{ id: string; mes: string } | null>(null);
  const [factOpen, setFactOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const refrescar = useCallback(() => router.refresh(), [router]);
  const abrirAumentos = useCallback((id: string, mes: string) => setAumentosDe({ id, mes }), []);
  const abrirFacturacion = useCallback(() => setFactOpen(true), []);

  const empleadoAumentos = aumentosDe ? resumen.empleados.find((e) => e.chofer_id === aumentosDe.id) ?? null : null;

  // Embebido en la planilla, la tarjeta tiene que estirarse al alto disponible
  // (la grilla reparte adentro); en los demás modos scrollea con la página.
  const aAlturaCompleta = embedded && activeTab === "planilla";

  return (
    <div className={aAlturaCompleta ? "h-full flex flex-col min-h-0" : "space-y-4"}>
      {/* Tabs + ayuda (solo en modo standalone; embebido usa las pestañas del unificado) */}
      {!embedded && (
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
            {([["planilla", "Planilla del mes"], ["aumentos", "Aumentos"]] as const).map(([t, label]) => (
              <button key={t} type="button" onClick={() => setTab(t)}
                className={`px-3 h-9 md:h-8 text-xs font-medium rounded-md transition-all inline-flex items-center gap-1.5 whitespace-nowrap ${tab === t ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                {t === "aumentos" && <TrendingUp size={13} />} {label}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => setHelpOpen(true)} className="gap-1.5">
            <HelpCircle size={14} /> ¿Cómo funciona?
          </Button>
        </div>
      )}

      {activeTab === "planilla" ? (
        <PlanillaGrid
          key={month}
          empleados={resumen.empleados}
          month={month}
          canWrite={canWrite}
          facturacionEfectiva={resumen.facturacionEfectiva}
          facturacionManual={resumen.facturacionManual}
          onEditarFacturacion={abrirFacturacion}
          onVerAumentos={abrirAumentos}
          onDatosCambiados={refrescar}
        />
      ) : (
        <div className="space-y-4">
          {inflacion && (
            <AumentosMetricas empleados={resumen.empleados} aumentosPorEmpleado={resumen.aumentosPorEmpleado}
              mesActualIso={month || mesActual()} inflacion={inflacion} />
          )}
          <AumentosMatriz empleados={resumen.empleados} aumentosPorEmpleado={resumen.aumentosPorEmpleado}
            mesActualIso={month || mesActual()} canWrite={canWrite}
            onAbrir={(id, mes) => setAumentosDe({ id, mes })} onChanged={() => router.refresh()} />
        </div>
      )}

      {empleadoAumentos && (
        <AumentosDialog empleado={empleadoAumentos} aumentos={resumen.aumentosPorEmpleado[empleadoAumentos.chofer_id] ?? []}
          defaultMes={aumentosDe?.mes ?? (month || mesActual())} canWrite={canWrite} onClose={() => setAumentosDe(null)} onChanged={() => router.refresh()} />
      )}
      {factOpen && (
        <FacturacionDialog month={month} facturacionCalculada={resumen.facturacionCalculada} facturacionManual={resumen.facturacionManual}
          onClose={() => setFactOpen(false)} onChanged={() => router.refresh()} />
      )}
      {helpOpen && <AyudaDialog onClose={() => setHelpOpen(false)} />}
    </div>
  );
}

// ── Matriz de aumentos (empleado × mes), como el Excel ─────────────────────
function AumentosMatriz({
  empleados, aumentosPorEmpleado, mesActualIso, canWrite, onAbrir, onChanged,
}: {
  empleados: SueldoAdminEmpleado[];
  aumentosPorEmpleado: Record<string, AumentoRow[]>;
  /** Mes seleccionado arriba ("YYYY-MM"), usado como default al agregar/editar. */
  mesActualIso: string;
  canWrite: boolean;
  onAbrir: (choferId: string, mes: string) => void;
  onChanged: () => void;
}) {
  // Meses "extra" que el usuario agregó a mano (aún sin datos) para poder cargarlos.
  const [mesesExtra, setMesesExtra] = useState<string[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [nuevoMes, setNuevoMes] = useState(mesActualIso);
  const [mesAEliminar, setMesAEliminar] = useState<string | null>(null); // mes con datos a borrar
  const [eliminandoMes, setEliminandoMes] = useState(false);

  // Meses que realmente tienen datos (alguna fecha vigente_desde). Clave estable para deps.
  const dataMesesKey = useMemo(() => {
    const set = new Set<string>();
    for (const arr of Object.values(aumentosPorEmpleado)) for (const a of arr) set.add(a.vigente_desde.slice(0, 10));
    return [...set].sort().join(",");
  }, [aumentosPorEmpleado]);
  const dataMeses = useMemo(() => new Set(dataMesesKey ? dataMesesKey.split(",") : []), [dataMesesKey]);

  // Meses visibles = los que tienen datos + los agregados a mano que aún NO tienen dato.
  // Al filtrar los "extra" que ya recibieron dato, la columna fantasma desaparece sola
  // tras registrar un aumento (sin effects ni setState en cascada).
  const meses = useMemo(() => {
    const extra = mesesExtra.filter((m) => !dataMeses.has(m));
    return [...new Set([...dataMeses, ...extra])].sort();
  }, [dataMeses, mesesExtra]);
  const esExtra = (m: string) => !dataMeses.has(m); // columna agregada, aún sin aumentos

  // Agrupa los meses por año consecutivo para la banda superior del encabezado.
  const grupos = useMemo(() => {
    const g: { anio: string; meses: string[] }[] = [];
    for (const m of meses) {
      const anio = anioDe(m);
      const last = g[g.length - 1];
      if (last && last.anio === anio) last.meses.push(m);
      else g.push({ anio, meses: [m] });
    }
    return g;
  }, [meses]);

  // Sueldo base vigente de un empleado en un mes dado (mayor vigente_desde <= mes).
  const baseEn = (choferId: string, mesIso: string): number | null => {
    const arr = aumentosPorEmpleado[choferId] ?? []; // viene desc
    const a = arr.find((x) => x.vigente_desde.slice(0, 10) <= mesIso);
    return a ? a.sueldo_base : null;
  };

  const agregarMes = () => {
    if (/^\d{4}-\d{2}$/.test(nuevoMes)) setMesesExtra((prev) => [...new Set([...prev, `${nuevoMes}-01`])]);
    setAddOpen(false);
  };
  const quitarMes = (m: string) => setMesesExtra((prev) => prev.filter((x) => x !== m));
  const countMes = (m: string) =>
    Object.values(aumentosPorEmpleado).reduce((n, arr) => n + arr.filter((a) => a.vigente_desde.slice(0, 10) === m).length, 0);
  const confirmarEliminarMes = async () => {
    if (!mesAEliminar) return;
    setEliminandoMes(true);
    const res = await eliminarMesAumentosAction(mesAEliminar.slice(0, 7));
    setEliminandoMes(false);
    setMesAEliminar(null);
    if (!("error" in res)) onChanged();
  };

  // La columna "Empleado" queda fija en HORIZONTAL (opaca, con borde derecho) para
  // leer los nombres mientras se scrollean los meses. El scroll vertical es el de la
  // página entera (sin caja de scroll interna). Los meses se separan con borde izq.
  const headBase = `${thCls} bg-muted border-b border-border`;
  const cornerTh = `${headBase} pl-4 sm:pl-6 pr-3 sticky left-0 z-20 border-r border-border`;
  const yearTh = `${headBase} text-center border-l border-border/60`;
  const mesTh = `${headBase} px-3 text-right whitespace-nowrap border-l border-border/50`;

  return (
    <div className="bg-card rounded-[8px] border border-border shadow-sm">
      {/* z-40 + card sin overflow-hidden: el popup de "Agregar mes" flota sin recortarse. */}
      <div className="flex flex-wrap items-center gap-2 px-4 sm:px-5 py-3 sm:py-4 border-b border-border relative z-40">
        <TrendingUp size={16} className="text-primary shrink-0" />
        <h2 className="text-foreground text-sm font-semibold">Aumentos por mes</h2>
        <span className="text-xs text-muted-foreground ml-1 hidden sm:inline">— sueldo base vigente cada mes (como el Excel)</span>
        {canWrite && (
          <div className="w-full sm:w-auto sm:ml-auto flex flex-wrap items-center gap-2">
            {addOpen ? (
              <>
                <MonthPicker value={nuevoMes} onChange={setNuevoMes} />
                <Button size="sm" variant="brand" onClick={agregarMes}>Agregar</Button>
                <Button size="sm" variant="ghost" onClick={() => setAddOpen(false)}>Cancelar</Button>
              </>
            ) : (
              <Button size="sm" variant="outline" onClick={() => { setNuevoMes(mesActualIso); setAddOpen(true); }}>
                <Plus size={14} /> Agregar mes
              </Button>
            )}
          </div>
        )}
      </div>

      {meses.length === 0 ? (
        <div className="p-4 sm:p-6 lg:p-8 text-center text-sm text-muted-foreground">
          Sin aumentos cargados todavía.{canWrite && " Agregá un mes o tocá un nombre para empezar."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-b-[8px]">
          <table className="w-full caption-bottom text-sm">
            <TableHeader>
              {/* Banda de año arriba + mes abajo: deja claro que "2025/2026" es el AÑO, no un día. */}
              <TableRow className="border-0 hover:bg-transparent">
                <TableHead rowSpan={2} className={cornerTh}>Empleado</TableHead>
                {grupos.map((g) => (
                  <TableHead key={g.anio} colSpan={g.meses.length} className={yearTh}>{g.anio}</TableHead>
                ))}
              </TableRow>
              <TableRow className="hover:bg-transparent">
                {meses.map((m) => (
                  <TableHead key={m} className={mesTh}>
                    {esExtra(m) ? (
                      <span className="inline-flex items-center gap-1 justify-end">
                        <span className="capitalize italic text-muted-foreground/80" title="Columna agregada, sin aumentos cargados todavía">{mesAbrev(m)}</span>
                        {canWrite && (
                          <button type="button" onClick={() => quitarMes(m)} title="Quitar esta columna vacía"
                            className="text-muted-foreground/50 hover:text-destructive"><X size={11} /></button>
                        )}
                      </span>
                    ) : (
                      <span className="group/mes inline-flex items-center gap-1 justify-end">
                        <span className="capitalize">{mesAbrev(m)}</span>
                        {canWrite && (
                          // En celular no hay hover: el tacho tiene que verse siempre.
                          <button type="button" onClick={() => setMesAEliminar(m)} title={`Eliminar todos los aumentos de ${mesLabel(m)}`}
                            className="text-muted-foreground/50 md:text-muted-foreground/30 hover:text-destructive md:opacity-0 md:group-hover/mes:opacity-100 transition-opacity"><Trash2 size={11} /></button>
                        )}
                      </span>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {empleados.map((e) => (
                <TableRow key={e.chofer_id}>
                  <TableCell className="pl-4 sm:pl-6 pr-3 whitespace-nowrap sticky left-0 z-10 bg-card border-r border-border">
                    <button type="button" disabled={!canWrite} onClick={() => onAbrir(e.chofer_id, mesActualIso)}
                      className={`font-semibold text-foreground max-md:py-2 max-md:-my-2 ${canWrite ? "hover:text-primary hover:underline" : ""}`}>
                      {e.nombre}
                    </button>
                  </TableCell>
                  {meses.map((m) => {
                    const val = baseEn(e.chofer_id, m);
                    const contenido = val != null ? pesos(val) : <span className="text-muted-foreground/40">—</span>;
                    return (
                      <TableCell key={m} className="text-right font-mono text-xs whitespace-nowrap border-l border-border/40 text-foreground">
                        {canWrite ? (
                          <button type="button" onClick={() => onAbrir(e.chofer_id, m.slice(0, 7))}
                            className="w-full text-right max-md:py-2 max-md:-my-2 hover:text-primary hover:underline decoration-dotted underline-offset-2"
                            title={`Cargar o editar el aumento de ${e.nombre} desde ${mesLabel(m)}`}>
                            {contenido}
                          </button>
                        ) : contenido}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </table>
        </div>
      )}
      {canWrite && meses.length > 0 && (
        <p className="px-4 sm:px-5 py-3 text-[11px] text-muted-foreground border-t border-border">
          Tocá una celda (o un nombre) para cargar o editar un aumento. Con <strong>Agregar mes</strong> sumás una columna nueva; la <span className="italic">itálica</span> marca las que todavía no tienen datos. Tocá el tacho de un mes para <strong>eliminarlo</strong>.
        </p>
      )}

      {mesAEliminar && (
        <Dialog open onOpenChange={(o) => { if (!o && !eliminandoMes) setMesAEliminar(null); }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Trash2 size={16} className="text-destructive" /> Eliminar el mes</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Se van a borrar <strong className="text-foreground">{countMes(mesAEliminar)}</strong> aumento{countMes(mesAEliminar) === 1 ? "" : "s"} cargado{countMes(mesAEliminar) === 1 ? "" : "s"} en <strong className="text-foreground capitalize">{mesLabel(mesAEliminar)}</strong>. Esta acción no se puede deshacer.
            </p>
            <DialogFooter showCloseButton>
              <Button variant="destructive" disabled={eliminandoMes} onClick={confirmarEliminarMes}>
                {eliminandoMes ? <Loader2 className="animate-spin" /> : <Trash2 />} Eliminar mes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ── Dialogs ────────────────────────────────────────────────────────────────
function AumentosDialog({
  empleado, aumentos, defaultMes, canWrite, onClose, onChanged,
}: {
  empleado: SueldoAdminEmpleado;
  aumentos: AumentoRow[];
  defaultMes: string;
  canWrite: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [mes, setMes] = useState(defaultMes);
  const [sueldo, setSueldo] = useState("");
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const registrar = async () => {
    const monto = parseNum(sueldo);
    if (monto == null || monto < 0) { setError("Escribí el sueldo base del aumento."); return; }
    setError(null); setSaving(true);
    const res = await registrarAumentoAction(empleado.chofer_id, mes, monto, obs || undefined);
    setSaving(false);
    if ("error" in res) { setError(res.error); return; }
    setSueldo(""); setObs(""); onChanged();
  };
  const eliminar = async (id: string) => {
    setError(null); setDeletingId(id);
    const res = await eliminarAumentoAction(id);
    setDeletingId(null);
    if ("error" in res) { setError(res.error); return; }
    onChanged();
  };

  const rol = ROL_SECTOR[empleado.rol];
  const baseActual = empleado.sueldoBase; // base vigente al mes de la página (para el header)
  const montoNuevo = parseNum(sueldo);
  // Referencia del preview = base vigente ANTES del mes elegido en el diálogo (no el de la página),
  // así el "% vs anterior" es correcto también para aumentos retroactivos.
  const baseRef = (() => {
    const mesIso = `${mes}-01`;
    const ant = aumentos.find((a) => a.vigente_desde.slice(0, 10) < mesIso); // aumentos viene DESC
    return ant ? ant.sueldo_base : 0;
  })();
  const deltaPreview =
    montoNuevo != null && montoNuevo >= 0 && baseRef > 0
      ? ((montoNuevo - baseRef) / baseRef) * 100
      : null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={false} className="sm:max-w-3xl p-0 gap-0">
        <DialogHeader className="sr-only"><DialogTitle>Aumentos de {empleado.nombre}</DialogTitle></DialogHeader>

        {/* Encabezado con identidad del empleado — deja claro de quién es la planilla. */}
        <div className="flex items-center gap-3 px-4 sm:px-6 py-4 border-b border-border bg-gradient-to-br from-muted/50 to-transparent rounded-t-xl">
          <AvatarPersona name={empleado.nombre} rol={empleado.rol} size={44} />
          <div className="min-w-0">
            <p className="font-heading text-base sm:text-lg font-semibold text-foreground truncate">{empleado.nombre}</p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${rol.dot}`} />
                {rol.label}
              </span>
              <span>·</span>
              <span>base actual <strong className="font-mono text-foreground">{pesos(baseActual)}</strong></span>
            </div>
          </div>
        </div>

        <div className={`px-4 sm:px-6 py-4 sm:py-5 gap-4 sm:gap-6 ${canWrite ? "grid md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] md:items-start" : ""}`}>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Historial de aumentos</p>
            {aumentos.length === 0 ? (
              <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">Sin aumentos cargados. El sueldo base queda en $ 0 hasta registrar el primero.</p>
            ) : (
              <div className="space-y-1.5 max-h-[15rem] sm:max-h-[22rem] overflow-y-auto pr-1">
                <AnimatePresence initial={false}>
                  {aumentos.map((a, i) => {
                    const older = aumentos[i + 1];
                    const delta = older && older.sueldo_base > 0 ? ((a.sueldo_base - older.sueldo_base) / older.sueldo_base) * 100 : null;
                    return (
                      <motion.div key={a.id}
                        layout
                        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0, marginTop: 0 }}
                        transition={{ duration: 0.18, delay: Math.min(i, 6) * 0.03 }}
                        className={`flex items-center gap-3 rounded-lg border p-2.5 ${i === 0 ? "border-emerald-200/70 bg-emerald-50/40" : "border-border bg-card"}`}>
                        <div className="flex flex-col items-center justify-center w-16 shrink-0 leading-tight">
                          <span className="text-[9px] uppercase text-muted-foreground">desde</span>
                          <span className="text-xs font-semibold capitalize text-foreground text-center">{mesLabel(a.vigente_desde)}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-foreground">{pesos(a.sueldo_base)}</span>
                            {delta != null && delta > 0 && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600"><TrendingUp size={11} /> +{delta.toFixed(1)}%</span>
                            )}
                            {delta != null && delta < 0 && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-destructive"><TrendingUp size={11} className="rotate-180" /> {delta.toFixed(1)}%</span>
                            )}
                            {delta === 0 && (
                              <span className="text-[10px] font-semibold text-muted-foreground">sin cambio</span>
                            )}
                            {i === 0 && <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-[10px] font-semibold">vigente</span>}
                          </div>
                          {a.observaciones && <p className="text-[11px] text-muted-foreground truncate" title={a.observaciones}>{a.observaciones}</p>}
                        </div>
                        {canWrite && (
                          <Button variant="ghost" size="icon-xs" className="text-muted-foreground hover:text-destructive shrink-0" aria-label="Eliminar" disabled={deletingId === a.id} onClick={() => eliminar(a.id)}>
                            {deletingId === a.id ? <Loader2 className="animate-spin" /> : <Trash2 />}
                          </Button>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>

          {canWrite && (
            <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Registrar aumento</p>
              <MonthPicker value={mes} onChange={setMes} />
              <div>
                <Input type="text" inputMode="numeric" placeholder="Sueldo base $" value={formatMiles(sueldo)} onChange={(e) => setSueldo(e.target.value.replace(/\./g, ""))} className="w-full text-right font-mono" />
                {deltaPreview != null && (
                  <span className={`mt-1.5 block text-xs font-semibold ${deltaPreview >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                    {deltaPreview >= 0 ? "+" : ""}{deltaPreview.toFixed(1)}% vs anterior
                  </span>
                )}
              </div>
              <Input type="text" placeholder="Observaciones (opcional)" value={obs} onChange={(e) => setObs(e.target.value)} className="w-full" />
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border bg-muted/40 px-4 sm:px-6 py-3 rounded-b-xl">
          <DialogClose render={<Button variant="outline" size="sm" />}>Cerrar</DialogClose>
          {canWrite && <Button variant="brand" size="sm" disabled={saving} onClick={registrar}>{saving ? <Loader2 className="animate-spin" /> : <Save />} Registrar</Button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FacturacionDialog({
  month, facturacionCalculada, facturacionManual, onClose, onChanged,
}: {
  month: string; facturacionCalculada: number; facturacionManual: number | null; onClose: () => void; onChanged: () => void;
}) {
  const [valor, setValor] = useState(facturacionManual != null ? String(facturacionManual) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const guardar = async (v: number | null) => {
    setError(null); setSaving(true);
    const res = await setFacturacionManualAction(month, v);
    setSaving(false);
    if ("error" in res) { setError(res.error); return; }
    onChanged(); onClose();
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Facturación del mes</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">El sistema calcula {pesos(facturacionCalculada)} con los viajes del mes. Si el número real es otro, cargalo acá y el % se calcula contra ese valor.</p>
        <Input type="text" inputMode="numeric" placeholder="Facturación $" value={formatMiles(valor)} onChange={(e) => setValor(e.target.value.replace(/\./g, ""))} className="text-right font-mono" />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <DialogFooter showCloseButton>
          {facturacionManual != null && <Button variant="outline" disabled={saving} onClick={() => guardar(null)}>Usar la del sistema</Button>}
          <Button variant="brand" disabled={saving} onClick={() => { const v = parseNum(valor); if (v == null || v < 0) { setError("Escribí el monto de facturación."); return; } guardar(v); }}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />} Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AyudaDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><HelpCircle size={18} className="text-primary" /> Cómo funciona Sueldos admin y taller</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm text-foreground/90">
          <p><strong className="text-foreground">Qué es:</strong> la planilla de sueldos del personal de <strong>administración y taller</strong> (no los choferes — esos se liquidan por viajes). El total del mes se compara contra la <strong>facturación</strong> para ver qué % se lleva.</p>
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5 text-xs">
            <p><strong>Pestaña «Planilla del mes»</strong> — por cada empleado: sueldo base + <strong>comisión logística</strong>, <strong>combustible</strong>, <strong>plus YPF</strong> y <strong>sábados</strong> (las mismas columnas del Excel). El total se calcula solo.</p>
            <p><strong>Pestaña «Aumentos»</strong> — la matriz de sueldo base vigente mes a mes (como la hoja de aumentos del Excel). Los encabezados muestran el <strong>año</strong> arriba (2025, 2026…) y el mes abajo. Tocá cualquier <strong>celda</strong> (o un nombre) para cargar/editar un aumento, y con <strong>«Agregar mes»</strong> sumás una columna nueva a medida que pasa el tiempo.</p>
            <p><strong>Sueldo base</strong> — sale del último aumento cargado. El ícono del reloj ⟳ en cada fila abre su historial.</p>
            <p><strong>Facturación</strong> — sale de los viajes del mes; el lápiz permite pisarla a mano.</p>
            <p><strong>Mes</strong> — se cambia con el selector arriba a la derecha.</p>
          </div>
          <p className="text-xs text-muted-foreground">Sección confidencial: la ven solo los administradores.</p>
        </div>
        <DialogFooter>
          <Button variant="brand" onClick={onClose}><X size={14} /> Entendido</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
