"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import MonthPicker from "@/components/ui/MonthPicker";
import {
  Wallet, Percent, Receipt, History, Loader2, Trash2, Pencil, Save, TrendingUp, HelpCircle, X, Plus,
} from "lucide-react";
import {
  upsertSueldoAdminMesAction,
  registrarAumentoAction,
  eliminarAumentoAction,
  eliminarMesAumentosAction,
  setFacturacionManualAction,
  type SueldosAdminResumen,
  type SueldoAdminEmpleado,
  type AumentoRow,
} from "./actions";

const pesos = (n: number) => `$ ${n.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
const pct1 = (n: number) =>
  `${n.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

const MESES_FULL = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MESES_CORTO = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function mesLabel(iso: string): string {
  const [y, m] = iso.slice(0, 10).split("-");
  return `${MESES_FULL[parseInt(m, 10) - 1]} ${y}`;
}
/** Solo el mes abreviado ("jun"), sin año — para la matriz con banda de año arriba. */
function mesAbrev(iso: string): string {
  return MESES_CORTO[parseInt(iso.slice(5, 7), 10) - 1];
}
function anioDe(iso: string): string {
  return iso.slice(0, 4);
}
function mesActual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function parseNum(s: string): number | null {
  let t = s.trim();
  if (t === "") return null;
  // Formato AR: la coma es decimal; los puntos son separador de miles (montos enteros en $).
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else t = t.replace(/\./g, "");
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const ROL_BADGE: Record<SueldoAdminEmpleado["rol"], { label: string; cls: string }> = {
  administrativo: { label: "Administración", cls: "bg-blue-50 text-blue-700 border-blue-200/50" },
  mantenimiento: { label: "Taller", cls: "bg-orange-50 text-orange-700 border-orange-200/50" },
};

// Avatar con iniciales + color determinístico por nombre, para distinguir empleados.
const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700", "bg-emerald-100 text-emerald-700", "bg-violet-100 text-violet-700",
  "bg-amber-100 text-amber-700", "bg-rose-100 text-rose-700", "bg-cyan-100 text-cyan-700",
  "bg-indigo-100 text-indigo-700", "bg-teal-100 text-teal-700", "bg-fuchsia-100 text-fuchsia-700",
];
function iniciales(nombre: string): string {
  const partes = nombre.split(",").map((s) => s.trim()).filter(Boolean);
  const ape = partes[0] ?? "";
  const nom = partes[1] ?? "";
  const dos = nom ? `${ape[0] ?? ""}${nom[0] ?? ""}` : ape.slice(0, 2);
  return dos.toUpperCase() || "?";
}
function colorAvatar(nombre: string): string {
  let h = 0;
  for (let i = 0; i < nombre.length; i++) h = (h * 31 + nombre.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

type RowDraft = { comisionLogistica: string; combustible: string; plusYpf: string; sabados: string };
const thCls = "text-[11px] font-bold text-muted-foreground uppercase tracking-wider";

export default function SueldosAdminClient({
  resumen, month, canWrite, mostrar = "ambos",
}: {
  resumen: SueldosAdminResumen;
  month: string;
  canWrite: boolean;
  /** "ambos" = con pestañas internas (uso standalone). "planilla"/"aumentos" =
   *  embebido en una sección con pestañas propias (unificado): solo esa parte. */
  mostrar?: "ambos" | "planilla" | "aumentos";
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"planilla" | "aumentos">("planilla");
  const embedded = mostrar !== "ambos";
  const activeTab = embedded ? mostrar : tab;
  const [error, setError] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, RowDraft>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [aumentosDe, setAumentosDe] = useState<{ id: string; mes: string } | null>(null);
  const [factOpen, setFactOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const draftDe = (e: SueldoAdminEmpleado): RowDraft =>
    edits[e.chofer_id] ?? {
      comisionLogistica: e.comisionLogistica ? String(e.comisionLogistica) : "",
      combustible: e.combustible ? String(e.combustible) : "",
      plusYpf: e.plusYpf ? String(e.plusYpf) : "",
      sabados: e.sabados ? String(e.sabados) : "",
    };
  const setDraft = (e: SueldoAdminEmpleado, patch: Partial<RowDraft>) =>
    setEdits((prev) => ({ ...prev, [e.chofer_id]: { ...draftDe(e), ...patch } }));

  const CAMPOS = ["comisionLogistica", "combustible", "plusYpf", "sabados"] as const;
  // Los montos no pueden ser negativos (misma regla que el server). Para el total
  // los tratamos como 0 así nunca se muestra un "descuento" engañoso.
  const valoresDe = (e: SueldoAdminEmpleado) => {
    const d = draftDe(e);
    const comisionLogistica = Math.max(0, parseNum(d.comisionLogistica) ?? 0);
    const combustible = Math.max(0, parseNum(d.combustible) ?? 0);
    const plusYpf = Math.max(0, parseNum(d.plusYpf) ?? 0);
    const sabados = Math.max(0, parseNum(d.sabados) ?? 0);
    return { comisionLogistica, combustible, plusYpf, sabados, total: e.sueldoBase + comisionLogistica + combustible + plusYpf + sabados };
  };
  const campoNegativo = (e: SueldoAdminEmpleado, campo: (typeof CAMPOS)[number]) =>
    (parseNum(draftDe(e)[campo]) ?? 0) < 0;
  const filaConNegativo = (e: SueldoAdminEmpleado) => CAMPOS.some((c) => campoNegativo(e, c));

  const isDirty = (e: SueldoAdminEmpleado) => {
    if (!edits[e.chofer_id]) return false;
    const v = valoresDe(e);
    return v.comisionLogistica !== e.comisionLogistica || v.combustible !== e.combustible || v.plusYpf !== e.plusYpf || v.sabados !== e.sabados;
  };

  const totales = useMemo(() => {
    let sueldoBase = 0, total = 0;
    for (const e of resumen.empleados) { sueldoBase += e.sueldoBase; total += valoresDe(e).total; }
    const porcentaje = resumen.facturacionEfectiva > 0 ? (total / resumen.facturacionEfectiva) * 100 : null;
    return { sueldoBase, total, porcentaje };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumen, edits]);

  const guardarFila = async (e: SueldoAdminEmpleado) => {
    const v = valoresDe(e);
    setError(null);
    setSavingId(e.chofer_id);
    const res = await upsertSueldoAdminMesAction(e.chofer_id, month, {
      comisionLogistica: v.comisionLogistica, combustible: v.combustible, plusYpf: v.plusYpf, sabados: v.sabados,
    });
    setSavingId(null);
    if ("error" in res) { setError(res.error); return; }
    setEdits((prev) => { const next = { ...prev }; delete next[e.chofer_id]; return next; });
    router.refresh();
  };

  const empleadoAumentos = aumentosDe ? resumen.empleados.find((e) => e.chofer_id === aumentosDe.id) ?? null : null;

  return (
    <div className="space-y-6">
      {/* Tabs + ayuda (solo en modo standalone; embebido usa las pestañas del unificado) */}
      {!embedded && (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
            {([["planilla", "Planilla del mes"], ["aumentos", "Aumentos"]] as const).map(([t, label]) => (
              <button key={t} type="button" onClick={() => setTab(t)}
                className={`px-3 h-8 text-xs font-medium rounded-md transition-all inline-flex items-center gap-1.5 ${tab === t ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                {t === "aumentos" && <TrendingUp size={13} />} {label}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => setHelpOpen(true)} className="gap-1.5">
            <HelpCircle size={14} /> ¿Cómo funciona?
          </Button>
        </div>
      )}

      {error && (
        <p className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-[8px] px-4 py-2">{error}</p>
      )}

      {activeTab === "planilla" ? (
        <>
          {/* Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Total sueldos del mes</p>
                <div className="p-2 rounded-lg bg-primary/10 text-primary"><Wallet size={16} /></div>
              </div>
              <p className="text-2xl font-black tracking-tight text-foreground mt-2">{pesos(totales.total)}</p>
              <p className="text-muted-foreground/80 text-[11px] mt-1">{resumen.empleados.length} persona{resumen.empleados.length === 1 ? "" : "s"} de administración y taller</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Facturación del mes</p>
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600"><Receipt size={16} /></div>
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <p className="text-2xl font-black tracking-tight text-foreground">{pesos(resumen.facturacionEfectiva)}</p>
                {resumen.facturacionManual != null ? (
                  <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded text-[11px] font-semibold border border-amber-200/60">manual</span>
                ) : (
                  <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[11px] font-semibold border border-blue-200/50">del sistema</span>
                )}
                {canWrite && <Button variant="ghost" size="icon-xs" aria-label="Editar facturación" onClick={() => setFactOpen(true)}><Pencil /></Button>}
              </div>
              <p className="text-muted-foreground/80 text-[11px] mt-1">
                {resumen.facturacionManual != null ? `Calculada por el sistema: ${pesos(resumen.facturacionCalculada)}` : "Suma de los viajes del mes"}
              </p>
            </div>
            <div className="bg-primary/5 rounded-xl border border-primary/30 p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="text-primary text-xs font-bold uppercase tracking-wider">% sobre facturación</p>
                <div className="p-2 rounded-lg bg-primary/10 text-primary"><Percent size={16} /></div>
              </div>
              <p className="text-3xl font-black tracking-tight text-primary mt-2">{totales.porcentaje != null ? pct1(totales.porcentaje) : "—"}</p>
              <p className="text-muted-foreground/80 text-[11px] mt-1">{totales.porcentaje != null ? "Sueldos admin + taller sobre lo facturado" : "Sin facturación en el mes para comparar"}</p>
            </div>
          </div>

          {/* Tabla del mes con columnas del Excel */}
          <div className="bg-card rounded-[8px] border border-border shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
              <Wallet size={16} className="text-primary" />
              <h2 className="text-foreground text-sm font-semibold">Planilla por empleado</h2>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className={`${thCls} pl-6`}>Empleado</TableHead>
                    <TableHead className={`${thCls} text-right`}>Sueldo base</TableHead>
                    <TableHead className={`${thCls} text-right`}>Comisión logística</TableHead>
                    <TableHead className={`${thCls} text-right`}>Combustible</TableHead>
                    <TableHead className={`${thCls} text-right`}>Plus YPF</TableHead>
                    <TableHead className={`${thCls} text-right`}>Sábados</TableHead>
                    <TableHead className={`${thCls} text-right`}>Total</TableHead>
                    {canWrite && <TableHead className="w-24 pr-6" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resumen.empleados.length === 0 ? (
                    <TableRow><TableCell colSpan={canWrite ? 8 : 7} className="py-16 text-center text-muted-foreground text-sm">
                      No hay personal de administración o taller activo.
                      <span className="block mt-1 text-xs">Se cargan desde Personal → Legajos, con rol Administración o Mantenimiento.</span>
                    </TableCell></TableRow>
                  ) : (
                    resumen.empleados.map((e) => {
                      const d = draftDe(e), v = valoresDe(e), dirty = isDirty(e), saving = savingId === e.chofer_id, badge = ROL_BADGE[e.rol];
                      return (
                        <TableRow key={e.chofer_id} className="hover:bg-muted/10 transition-colors">
                          <TableCell className="pl-6">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-foreground">{e.nombre}</span>
                              <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${badge.cls}`}>{badge.label}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <span className="font-mono text-foreground">{e.sueldoBase > 0 ? pesos(e.sueldoBase) : <span className="text-muted-foreground/60">sin cargar</span>}</span>
                              {canWrite && <Button variant="ghost" size="icon-xs" title="Aumentos" onClick={() => setAumentosDe({ id: e.chofer_id, mes: month || mesActual() })}><History /></Button>}
                            </div>
                          </TableCell>
                          {CAMPOS.map((campo) => (
                            <TableCell key={campo} className="text-right">
                              {canWrite ? (
                                <Input type="text" inputMode="decimal" placeholder="0" value={d[campo]}
                                  onChange={(ev) => setDraft(e, { [campo]: ev.target.value })}
                                  className={`w-24 ml-auto text-right font-mono ${campoNegativo(e, campo) ? "border-red-400 focus-visible:ring-red-100" : ""}`} />
                              ) : (
                                <span className="font-mono text-muted-foreground">{pesos(e[campo])}</span>
                              )}
                            </TableCell>
                          ))}
                          <TableCell className="text-right font-mono font-semibold text-foreground">{pesos(v.total)}</TableCell>
                          {canWrite && (
                            <TableCell className="text-right pr-6">
                              {dirty && <Button size="sm" variant="brand" disabled={saving || filaConNegativo(e)} onClick={() => guardarFila(e)}>{saving ? <Loader2 className="animate-spin" /> : <Save />} Guardar</Button>}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
                {resumen.empleados.length > 0 && (
                  <TableFooter className="bg-muted/30">
                    <TableRow>
                      <TableCell className="pl-6 text-xs font-bold text-muted-foreground uppercase tracking-wider">Total</TableCell>
                      <TableCell className="text-right font-mono font-semibold text-foreground">{pesos(totales.sueldoBase)}</TableCell>
                      <TableCell /><TableCell /><TableCell /><TableCell />
                      <TableCell className="text-right font-mono font-black text-foreground">{pesos(totales.total)}</TableCell>
                      {canWrite && <TableCell className="pr-6" />}
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">La facturación sale de los viajes del mes; se puede pisar a mano desde la tarjeta &quot;Facturación del mes&quot;.</p>
        </>
      ) : (
        <AumentosMatriz empleados={resumen.empleados} aumentosPorEmpleado={resumen.aumentosPorEmpleado}
          mesActualIso={month || mesActual()} canWrite={canWrite}
          onAbrir={(id, mes) => setAumentosDe({ id, mes })} onChanged={() => router.refresh()} />
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
  const cornerTh = `${headBase} pl-6 pr-3 sticky left-0 z-20 border-r border-border`;
  const yearTh = `${headBase} text-center border-l border-border/60`;
  const mesTh = `${headBase} px-3 text-right whitespace-nowrap border-l border-border/50`;

  return (
    <div className="bg-card rounded-[8px] border border-border shadow-sm">
      {/* z-40 + card sin overflow-hidden: el popup de "Agregar mes" flota sin recortarse. */}
      <div className="flex flex-wrap items-center gap-2 px-5 py-4 border-b border-border relative z-40">
        <TrendingUp size={16} className="text-primary" />
        <h2 className="text-foreground text-sm font-semibold">Aumentos por mes</h2>
        <span className="text-xs text-muted-foreground ml-1 hidden sm:inline">— sueldo base vigente cada mes (como el Excel)</span>
        {canWrite && (
          <div className="ml-auto flex items-center gap-2">
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
        <div className="p-8 text-center text-sm text-muted-foreground">
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
                          <button type="button" onClick={() => setMesAEliminar(m)} title={`Eliminar todos los aumentos de ${mesLabel(m)}`}
                            className="text-muted-foreground/30 hover:text-destructive opacity-0 group-hover/mes:opacity-100 transition-opacity"><Trash2 size={11} /></button>
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
                  <TableCell className="pl-6 pr-3 whitespace-nowrap sticky left-0 z-10 bg-card border-r border-border">
                    <button type="button" disabled={!canWrite} onClick={() => onAbrir(e.chofer_id, mesActualIso)}
                      className={`font-semibold text-foreground ${canWrite ? "hover:text-primary hover:underline" : ""}`}>
                      {e.nombre}
                    </button>
                  </TableCell>
                  {meses.map((m, i) => {
                    const val = baseEn(e.chofer_id, m);
                    const prev = i > 0 ? baseEn(e.chofer_id, meses[i - 1]) : null;
                    const subio = val != null && prev != null && val > prev;
                    const contenido = val != null ? pesos(val) : <span className="text-muted-foreground/40">—</span>;
                    return (
                      <TableCell key={m} className={`text-right font-mono text-xs whitespace-nowrap border-l border-border/40 ${subio ? "text-emerald-600 font-semibold" : "text-foreground"}`}>
                        {canWrite ? (
                          <button type="button" onClick={() => onAbrir(e.chofer_id, m.slice(0, 7))}
                            className="w-full text-right hover:text-primary hover:underline decoration-dotted underline-offset-2"
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
        <p className="px-5 py-3 text-[11px] text-muted-foreground border-t border-border">
          Tocá una celda (o un nombre) para cargar o editar un aumento. Con <strong>Agregar mes</strong> sumás una columna nueva; la <span className="italic">itálica</span> marca las que todavía no tienen datos. Pasá el mouse sobre un mes para <strong>eliminarlo</strong>.
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

  const rol = ROL_BADGE[empleado.rol];
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
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-gradient-to-br from-muted/50 to-transparent rounded-t-xl">
          <div className={`h-12 w-12 rounded-full flex items-center justify-center font-bold shrink-0 ${colorAvatar(empleado.nombre)}`}>
            {iniciales(empleado.nombre)}
          </div>
          <div className="min-w-0">
            <p className="font-heading text-lg font-semibold text-foreground truncate">{empleado.nombre}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${rol.cls}`}>{rol.label}</span>
              <span className="text-xs text-muted-foreground">base actual <strong className="font-mono text-foreground">{pesos(baseActual)}</strong></span>
            </div>
          </div>
        </div>

        <div className={`px-6 py-5 gap-6 ${canWrite ? "grid md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] md:items-start" : ""}`}>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Historial de aumentos</p>
            {aumentos.length === 0 ? (
              <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">Sin aumentos cargados. El sueldo base queda en $ 0 hasta registrar el primero.</p>
            ) : (
              <div className="space-y-1.5 max-h-[22rem] overflow-y-auto pr-1">
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
                <Input type="text" inputMode="decimal" placeholder="Sueldo base $" value={sueldo} onChange={(e) => setSueldo(e.target.value)} className="w-full text-right font-mono" />
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

        <div className="flex items-center justify-end gap-2 border-t border-border bg-muted/40 px-6 py-3 rounded-b-xl">
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
        <Input type="text" inputMode="decimal" placeholder="Facturación $" value={valor} onChange={(e) => setValor(e.target.value)} className="text-right font-mono" />
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
