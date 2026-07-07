"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import MonthPicker from "@/components/ui/MonthPicker";
import {
  Wallet, Percent, Receipt, History, Loader2, Trash2, Pencil, Save, TrendingUp, HelpCircle, X,
} from "lucide-react";
import {
  upsertSueldoAdminMesAction,
  registrarAumentoAction,
  eliminarAumentoAction,
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
function mesCorto(iso: string): string {
  const [y, m] = iso.slice(0, 10).split("-");
  return `${MESES_CORTO[parseInt(m, 10) - 1]} ${y.slice(2)}`;
}
function mesActual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function parseNum(s: string): number | null {
  let t = s.trim();
  if (t === "") return null;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const ROL_BADGE: Record<SueldoAdminEmpleado["rol"], { label: string; cls: string }> = {
  administrativo: { label: "Administración", cls: "bg-blue-50 text-blue-700 border-blue-200/50" },
  mantenimiento: { label: "Taller", cls: "bg-orange-50 text-orange-700 border-orange-200/50" },
};

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
  const [aumentosDe, setAumentosDe] = useState<string | null>(null);
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

  const empleadoAumentos = aumentosDe ? resumen.empleados.find((e) => e.chofer_id === aumentosDe) ?? null : null;

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
                              {canWrite && <Button variant="ghost" size="icon-xs" title="Aumentos" onClick={() => setAumentosDe(e.chofer_id)}><History /></Button>}
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
          canWrite={canWrite} onAbrir={(id) => setAumentosDe(id)} />
      )}

      {empleadoAumentos && (
        <AumentosDialog empleado={empleadoAumentos} aumentos={resumen.aumentosPorEmpleado[empleadoAumentos.chofer_id] ?? []}
          defaultMes={month || mesActual()} canWrite={canWrite} onClose={() => setAumentosDe(null)} onChanged={() => router.refresh()} />
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
  empleados, aumentosPorEmpleado, canWrite, onAbrir,
}: {
  empleados: SueldoAdminEmpleado[];
  aumentosPorEmpleado: Record<string, AumentoRow[]>;
  canWrite: boolean;
  onAbrir: (choferId: string) => void;
}) {
  // Meses = todas las fechas vigente_desde de todos los empleados, ascendente.
  const meses = useMemo(() => {
    const set = new Set<string>();
    for (const arr of Object.values(aumentosPorEmpleado)) for (const a of arr) set.add(a.vigente_desde.slice(0, 10));
    return [...set].sort();
  }, [aumentosPorEmpleado]);

  // Sueldo base vigente de un empleado en un mes dado (mayor vigente_desde <= mes).
  const baseEn = (choferId: string, mesIso: string): number | null => {
    const arr = aumentosPorEmpleado[choferId] ?? []; // viene desc
    const a = arr.find((x) => x.vigente_desde.slice(0, 10) <= mesIso);
    return a ? a.sueldo_base : null;
  };

  if (meses.length === 0) {
    return <div className="bg-card rounded-[8px] border border-border p-8 text-center text-sm text-muted-foreground">Sin aumentos cargados todavía.</div>;
  }

  return (
    <div className="bg-card rounded-[8px] border border-border shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
        <TrendingUp size={16} className="text-primary" />
        <h2 className="text-foreground text-sm font-semibold">Aumentos por mes</h2>
        <span className="text-xs text-muted-foreground ml-1">— sueldo base vigente cada mes (como el Excel)</span>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className={`${thCls} pl-6 sticky left-0 bg-muted/40`}>Empleado</TableHead>
              {meses.map((m) => <TableHead key={m} className={`${thCls} text-right whitespace-nowrap capitalize`}>{mesCorto(m)}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {empleados.map((e) => (
              <TableRow key={e.chofer_id} className="hover:bg-muted/10">
                <TableCell className="pl-6 whitespace-nowrap sticky left-0 bg-card">
                  <button type="button" disabled={!canWrite} onClick={() => onAbrir(e.chofer_id)}
                    className={`font-semibold text-foreground ${canWrite ? "hover:text-primary hover:underline" : ""}`}>
                    {e.nombre}
                  </button>
                </TableCell>
                {meses.map((m, i) => {
                  const val = baseEn(e.chofer_id, m);
                  const prev = i > 0 ? baseEn(e.chofer_id, meses[i - 1]) : null;
                  const subio = val != null && prev != null && val > prev;
                  return (
                    <TableCell key={m} className={`text-right font-mono text-xs whitespace-nowrap ${subio ? "text-emerald-600 font-semibold" : "text-foreground"}`}>
                      {val != null ? pesos(val) : <span className="text-muted-foreground/40">—</span>}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {canWrite && <p className="px-5 py-3 text-[11px] text-muted-foreground border-t border-border">Tocá un nombre para cargar o editar sus aumentos.</p>}
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

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Aumentos — {empleado.nombre}</DialogTitle></DialogHeader>
        {aumentos.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sin aumentos cargados. El sueldo base queda en $ 0 hasta registrar el primero.</p>
        ) : (
          <div className="space-y-1 max-h-52 overflow-y-auto">
            {aumentos.map((a, i) => (
              <div key={a.id} className="flex items-center gap-3 text-xs py-1.5 border-b border-border/40 last:border-0">
                <span className="text-muted-foreground w-28 shrink-0 capitalize">desde {mesLabel(a.vigente_desde)}</span>
                <span className="font-mono font-semibold text-foreground">{pesos(a.sueldo_base)}</span>
                {i === 0 && <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded text-[10px] font-semibold border border-emerald-200/60">vigente</span>}
                {a.observaciones && <span className="text-muted-foreground truncate flex-1" title={a.observaciones}>{a.observaciones}</span>}
                {canWrite && (
                  <Button variant="ghost" size="icon-xs" className="ml-auto text-destructive" aria-label="Eliminar" disabled={deletingId === a.id} onClick={() => eliminar(a.id)}>
                    {deletingId === a.id ? <Loader2 className="animate-spin" /> : <Trash2 />}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
        {canWrite && (
          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Registrar aumento</p>
            <div className="flex items-center gap-2 flex-wrap">
              <MonthPicker value={mes} onChange={setMes} />
              <Input type="text" inputMode="decimal" placeholder="Sueldo base $" value={sueldo} onChange={(e) => setSueldo(e.target.value)} className="w-32 text-right font-mono" />
            </div>
            <Input type="text" placeholder="Observaciones (opcional)" value={obs} onChange={(e) => setObs(e.target.value)} />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )}
        <DialogFooter showCloseButton>
          {canWrite && <Button variant="brand" disabled={saving} onClick={registrar}>{saving ? <Loader2 className="animate-spin" /> : <Save />} Registrar</Button>}
        </DialogFooter>
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
            <p><strong>Pestaña «Aumentos»</strong> — la matriz de sueldo base vigente mes a mes (como la hoja de aumentos del Excel). Tocá un nombre para cargar/editar sus aumentos.</p>
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
