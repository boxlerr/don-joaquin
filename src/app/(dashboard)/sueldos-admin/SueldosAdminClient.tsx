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
  Wallet, Percent, Receipt, History, Loader2, Trash2, Pencil, Save,
} from "lucide-react";
import {
  upsertSueldoAdminMesAction,
  registrarAumentoAction,
  eliminarAumentoAction,
  setFacturacionManualAction,
  setValorHoraDefaultAction,
  type SueldosAdminResumen,
  type SueldoAdminEmpleado,
} from "./actions";

// ---------------------------------------------------------------------------
// Helpers de formato / parseo (es-AR: coma decimal, pesos sin centavos)
// ---------------------------------------------------------------------------

const pesos = (n: number) => `$ ${n.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
const pct1 = (n: number) =>
  `${n.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

/** "2026-07-01" → "julio 2026" (para el historial de aumentos). */
const MESES_FULL = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
function mesLabel(iso: string): string {
  const [y, m] = iso.slice(0, 10).split("-");
  return `${MESES_FULL[parseInt(m, 10) - 1]} ${y}`;
}

function mesActual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Parsea un input numérico tolerante (es-AR): con coma, el punto es separador
 * de miles ("1.500,5" → 1500.5); sin coma, el punto se toma como decimal.
 * Vacío o inválido → null. */
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

type RowDraft = { horasExtras: string; valorHora: string; plus: string };

const thCls = "text-[11px] font-bold text-muted-foreground uppercase tracking-wider";

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export default function SueldosAdminClient({
  resumen,
  month,
  canWrite,
}: {
  resumen: SueldosAdminResumen;
  month: string;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  // Solo las filas que la usuaria tocó; el resto se muestra desde el server.
  const [edits, setEdits] = useState<Record<string, RowDraft>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  // Dialogs
  const [aumentosDe, setAumentosDe] = useState<string | null>(null); // chofer_id
  const [factOpen, setFactOpen] = useState(false);
  const [valorHoraOpen, setValorHoraOpen] = useState(false);

  const draftDe = (e: SueldoAdminEmpleado): RowDraft =>
    edits[e.chofer_id] ?? {
      horasExtras: e.horasExtras ? String(e.horasExtras) : "",
      valorHora: e.valorHora != null ? String(e.valorHora) : "",
      plus: e.plus ? String(e.plus) : "",
    };

  const setDraft = (e: SueldoAdminEmpleado, patch: Partial<RowDraft>) => {
    setEdits((prev) => ({ ...prev, [e.chofer_id]: { ...draftDe(e), ...patch } }));
  };

  /** Valores efectivos de la fila (draft si la tocó, guardados si no). */
  const valoresDe = (e: SueldoAdminEmpleado) => {
    const d = draftDe(e);
    const horasExtras = parseNum(d.horasExtras) ?? 0;
    const valorHora = parseNum(d.valorHora); // null → default global
    const plus = parseNum(d.plus) ?? 0;
    const total = e.sueldoBase + horasExtras * (valorHora ?? resumen.valorHoraDefault) + plus;
    return { horasExtras, valorHora, plus, total };
  };

  const isDirty = (e: SueldoAdminEmpleado) => {
    if (!edits[e.chofer_id]) return false;
    const v = valoresDe(e);
    return v.horasExtras !== e.horasExtras || v.valorHora !== e.valorHora || v.plus !== e.plus;
  };

  // Totales en vivo: el % se recalcula mientras se tipea, sin esperar el guardado.
  const totales = useMemo(() => {
    let sueldoBase = 0;
    let total = 0;
    for (const e of resumen.empleados) {
      sueldoBase += e.sueldoBase;
      total += valoresDe(e).total;
    }
    const porcentaje = resumen.facturacionEfectiva > 0 ? (total / resumen.facturacionEfectiva) * 100 : null;
    return { sueldoBase, total, porcentaje };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumen, edits]);

  const guardarFila = async (e: SueldoAdminEmpleado) => {
    const v = valoresDe(e);
    setError(null);
    setSavingId(e.chofer_id);
    const res = await upsertSueldoAdminMesAction(e.chofer_id, month, {
      horasExtras: v.horasExtras,
      valorHora: v.valorHora,
      plus: v.plus,
    });
    setSavingId(null);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    // Al refrescar, la fila vuelve del server con lo guardado → soltamos el draft.
    setEdits((prev) => {
      const next = { ...prev };
      delete next[e.chofer_id];
      return next;
    });
    router.refresh();
  };

  const empleadoAumentos = aumentosDe
    ? resumen.empleados.find((e) => e.chofer_id === aumentosDe) ?? null
    : null;

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------------ */}
      {/* Cards: total, facturación y EL número que mira Bárbara (el %)       */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-muted-foreground text-xs font-bold uppercase tracking-wider">
              Total sueldos del mes
            </p>
            <div className="p-2 rounded-lg bg-primary/10 text-primary"><Wallet size={16} /></div>
          </div>
          <p className="text-2xl font-black tracking-tight text-foreground mt-2">
            {pesos(totales.total)}
          </p>
          <p className="text-muted-foreground/80 text-[11px] mt-1">
            {resumen.empleados.length} persona{resumen.empleados.length === 1 ? "" : "s"} de administración y taller
          </p>
        </div>

        <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-muted-foreground text-xs font-bold uppercase tracking-wider">
              Facturación del mes
            </p>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600"><Receipt size={16} /></div>
          </div>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <p className="text-2xl font-black tracking-tight text-foreground">
              {pesos(resumen.facturacionEfectiva)}
            </p>
            {resumen.facturacionManual != null ? (
              <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded text-[11px] font-semibold border border-amber-200/60">
                manual
              </span>
            ) : (
              <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[11px] font-semibold border border-blue-200/50">
                del sistema
              </span>
            )}
            {canWrite && (
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Editar facturación del mes"
                onClick={() => setFactOpen(true)}
              >
                <Pencil />
              </Button>
            )}
          </div>
          <p className="text-muted-foreground/80 text-[11px] mt-1">
            {resumen.facturacionManual != null
              ? `Calculada por el sistema: ${pesos(resumen.facturacionCalculada)}`
              : "Suma de los viajes del mes"}
          </p>
        </div>

        <div className="bg-primary/5 rounded-xl border border-primary/30 p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-primary text-xs font-bold uppercase tracking-wider">
              % sobre facturación
            </p>
            <div className="p-2 rounded-lg bg-primary/10 text-primary"><Percent size={16} /></div>
          </div>
          <p className="text-3xl font-black tracking-tight text-primary mt-2">
            {totales.porcentaje != null ? pct1(totales.porcentaje) : "—"}
          </p>
          <p className="text-muted-foreground/80 text-[11px] mt-1">
            {totales.porcentaje != null
              ? "Sueldos admin + taller sobre lo facturado"
              : "Sin facturación en el mes para comparar"}
          </p>
        </div>
      </div>

      {error && (
        <p className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-[8px] px-4 py-2">
          {error}
        </p>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Tabla por empleado                                                  */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-card rounded-[8px] border border-border shadow-sm overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Wallet size={16} className="text-primary" />
            <h2 className="text-foreground text-sm font-semibold">Planilla por empleado</h2>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>
              Hora extra por defecto:{" "}
              <span className="font-semibold text-foreground">{pesos(resumen.valorHoraDefault)}</span>
            </span>
            {canWrite && (
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Editar valor hora por defecto"
                onClick={() => setValorHoraOpen(true)}
              >
                <Pencil />
              </Button>
            )}
          </div>
        </div>

        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className={`${thCls} pl-6`}>Empleado</TableHead>
              <TableHead className={`${thCls} text-right`}>Sueldo base</TableHead>
              <TableHead className={`${thCls} text-right`}>Horas extras</TableHead>
              <TableHead className={`${thCls} text-right`}>Valor hora</TableHead>
              <TableHead className={`${thCls} text-right`}>Plus</TableHead>
              <TableHead className={`${thCls} text-right`}>Total</TableHead>
              {canWrite && <TableHead className="w-24 pr-6" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {resumen.empleados.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canWrite ? 7 : 6} className="py-16 text-center text-muted-foreground text-sm">
                  No hay personal de administración o taller activo.
                  <span className="block mt-1 text-xs">
                    Se cargan desde Choferes, con rol Administrativo o Mantenimiento.
                  </span>
                </TableCell>
              </TableRow>
            ) : (
              resumen.empleados.map((e) => {
                const d = draftDe(e);
                const v = valoresDe(e);
                const dirty = isDirty(e);
                const saving = savingId === e.chofer_id;
                const badge = ROL_BADGE[e.rol];
                return (
                  <TableRow key={e.chofer_id} className="hover:bg-muted/10 transition-colors">
                    <TableCell className="pl-6">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground">{e.nombre}</span>
                        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <span className="font-mono text-foreground">
                          {e.sueldoBase > 0 ? pesos(e.sueldoBase) : <span className="text-muted-foreground/60">sin cargar</span>}
                        </span>
                        {canWrite && (
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label={`Aumentos de ${e.nombre}`}
                            title="Historial de aumentos"
                            onClick={() => setAumentosDe(e.chofer_id)}
                          >
                            <History />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {canWrite ? (
                        <Input
                          type="text"
                          inputMode="decimal"
                          placeholder="0"
                          value={d.horasExtras}
                          onChange={(ev) => setDraft(e, { horasExtras: ev.target.value })}
                          className="w-20 ml-auto text-right font-mono"
                        />
                      ) : (
                        <span className="font-mono text-muted-foreground">{e.horasExtras.toLocaleString("es-AR")}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {canWrite ? (
                        <Input
                          type="text"
                          inputMode="decimal"
                          placeholder={resumen.valorHoraDefault.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                          value={d.valorHora}
                          onChange={(ev) => setDraft(e, { valorHora: ev.target.value })}
                          className="w-24 ml-auto text-right font-mono"
                        />
                      ) : (
                        <span className="font-mono text-muted-foreground">
                          {pesos(e.valorHora ?? resumen.valorHoraDefault)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {canWrite ? (
                        <Input
                          type="text"
                          inputMode="decimal"
                          placeholder="0"
                          value={d.plus}
                          onChange={(ev) => setDraft(e, { plus: ev.target.value })}
                          className="w-24 ml-auto text-right font-mono"
                        />
                      ) : (
                        <span className="font-mono text-muted-foreground">{pesos(e.plus)}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold text-foreground">
                      {pesos(v.total)}
                    </TableCell>
                    {canWrite && (
                      <TableCell className="text-right pr-6">
                        {dirty && (
                          <Button
                            size="sm"
                            variant="brand"
                            disabled={saving}
                            onClick={() => guardarFila(e)}
                          >
                            {saving ? <Loader2 className="animate-spin" /> : <Save />}
                            Guardar
                          </Button>
                        )}
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
                <TableCell className="pl-6 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Total
                </TableCell>
                <TableCell className="text-right font-mono font-semibold text-foreground">
                  {pesos(totales.sueldoBase)}
                </TableCell>
                <TableCell />
                <TableCell />
                <TableCell />
                <TableCell className="text-right font-mono font-black text-foreground">
                  {pesos(totales.total)}
                </TableCell>
                {canWrite && <TableCell className="pr-6" />}
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        La facturación del mes sale de los viajes cargados en el sistema. Si hace falta usar otro
        número (por ejemplo, lo facturado según contabilidad), se puede cargar a mano desde la
        tarjeta &quot;Facturación del mes&quot;.
      </p>

      {/* ------------------------------------------------------------------ */}
      {/* Dialog: historial de aumentos + registrar uno nuevo                 */}
      {/* ------------------------------------------------------------------ */}
      {empleadoAumentos && (
        <AumentosDialog
          empleado={empleadoAumentos}
          aumentos={resumen.aumentosPorEmpleado[empleadoAumentos.chofer_id] ?? []}
          defaultMes={month || mesActual()}
          onClose={() => setAumentosDe(null)}
          onChanged={() => router.refresh()}
        />
      )}

      {/* Dialog: facturación manual del mes */}
      {factOpen && (
        <FacturacionDialog
          month={month}
          facturacionCalculada={resumen.facturacionCalculada}
          facturacionManual={resumen.facturacionManual}
          onClose={() => setFactOpen(false)}
          onChanged={() => router.refresh()}
        />
      )}

      {/* Dialog: valor default de la hora extra */}
      {valorHoraOpen && (
        <ValorHoraDialog
          valorActual={resumen.valorHoraDefault}
          onClose={() => setValorHoraOpen(false)}
          onChanged={() => router.refresh()}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dialogs
// ---------------------------------------------------------------------------

function AumentosDialog({
  empleado,
  aumentos,
  defaultMes,
  onClose,
  onChanged,
}: {
  empleado: SueldoAdminEmpleado;
  aumentos: { id: string; vigente_desde: string; sueldo_base: number; observaciones: string | null }[];
  defaultMes: string;
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
    if (monto == null || monto < 0) {
      setError("Escribí el sueldo base del aumento.");
      return;
    }
    setError(null);
    setSaving(true);
    const res = await registrarAumentoAction(empleado.chofer_id, mes, monto, obs || undefined);
    setSaving(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setSueldo("");
    setObs("");
    onChanged(); // el historial se refresca desde el server, el dialog queda abierto
  };

  const eliminar = async (id: string) => {
    setError(null);
    setDeletingId(id);
    const res = await eliminarAumentoAction(id);
    setDeletingId(null);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    onChanged();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Aumentos — {empleado.nombre}</DialogTitle>
        </DialogHeader>

        {/* Historial: cada fila es el sueldo vigente desde ese mes. */}
        {aumentos.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Sin aumentos cargados todavía. El sueldo base queda en $ 0 hasta registrar el primero.
          </p>
        ) : (
          <div className="space-y-1 max-h-52 overflow-y-auto">
            {aumentos.map((a, i) => (
              <div
                key={a.id}
                className="flex items-center gap-3 text-xs py-1.5 border-b border-border/40 last:border-0"
              >
                <span className="text-muted-foreground w-28 shrink-0 capitalize">
                  desde {mesLabel(a.vigente_desde)}
                </span>
                <span className="font-mono font-semibold text-foreground">{pesos(a.sueldo_base)}</span>
                {i === 0 && (
                  <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded text-[10px] font-semibold border border-emerald-200/60">
                    vigente
                  </span>
                )}
                {a.observaciones && (
                  <span className="text-muted-foreground truncate flex-1" title={a.observaciones}>
                    {a.observaciones}
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="ml-auto text-destructive"
                  aria-label="Eliminar aumento"
                  disabled={deletingId === a.id}
                  onClick={() => eliminar(a.id)}
                >
                  {deletingId === a.id ? <Loader2 className="animate-spin" /> : <Trash2 />}
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Registrar uno nuevo (si ya hay uno para ese mes, se corrige). */}
        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Registrar aumento
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <MonthPicker value={mes} onChange={setMes} />
            <Input
              type="text"
              inputMode="decimal"
              placeholder="Sueldo base $"
              value={sueldo}
              onChange={(e) => setSueldo(e.target.value)}
              className="w-32 text-right font-mono"
            />
          </div>
          <Input
            type="text"
            placeholder="Observaciones (opcional)"
            value={obs}
            onChange={(e) => setObs(e.target.value)}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter showCloseButton>
          <Button variant="brand" disabled={saving} onClick={registrar}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />}
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FacturacionDialog({
  month,
  facturacionCalculada,
  facturacionManual,
  onClose,
  onChanged,
}: {
  month: string;
  facturacionCalculada: number;
  facturacionManual: number | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [valor, setValor] = useState(facturacionManual != null ? String(facturacionManual) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardar = async (v: number | null) => {
    setError(null);
    setSaving(true);
    const res = await setFacturacionManualAction(month, v);
    setSaving(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    onChanged();
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Facturación del mes</DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          El sistema calcula {pesos(facturacionCalculada)} con los viajes del mes. Si el número
          real es otro, cargalo acá y el % se calcula contra ese valor.
        </p>

        <Input
          type="text"
          inputMode="decimal"
          placeholder="Facturación $"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          className="text-right font-mono"
        />
        {error && <p className="text-xs text-destructive">{error}</p>}

        <DialogFooter showCloseButton>
          {facturacionManual != null && (
            <Button variant="outline" disabled={saving} onClick={() => guardar(null)}>
              Usar la del sistema
            </Button>
          )}
          <Button
            variant="brand"
            disabled={saving}
            onClick={() => {
              const v = parseNum(valor);
              if (v == null || v < 0) {
                setError("Escribí el monto de facturación.");
                return;
              }
              guardar(v);
            }}
          >
            {saving ? <Loader2 className="animate-spin" /> : <Save />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ValorHoraDialog({
  valorActual,
  onClose,
  onChanged,
}: {
  valorActual: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [valor, setValor] = useState(valorActual ? String(valorActual) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardar = async () => {
    const v = parseNum(valor);
    if (v == null || v < 0) {
      setError("Escribí el valor de la hora extra.");
      return;
    }
    setError(null);
    setSaving(true);
    const res = await setValorHoraDefaultAction(v);
    setSaving(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    onChanged();
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Valor de la hora extra</DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          Valor por defecto para todo el personal. Se puede pisar por empleado y mes desde la
          columna &quot;Valor hora&quot; de la planilla.
        </p>

        <Input
          type="text"
          inputMode="decimal"
          placeholder="Valor hora $"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          className="text-right font-mono"
        />
        {error && <p className="text-xs text-destructive">{error}</p>}

        <DialogFooter showCloseButton>
          <Button variant="brand" disabled={saving} onClick={guardar}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
