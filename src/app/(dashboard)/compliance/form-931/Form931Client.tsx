"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileCheck2, Plus, Pencil, Trash2, Loader2, Check, CalendarClock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import InlineFeedback from "@/components/ui/InlineFeedback";
import {
  toggleEnvioForm931Action,
  updateForm931Action,
  createForm931Action,
  deleteForm931Action,
  type Canal931,
  type Form931Row,
} from "./actions";

function diasRestantes(fechaISO: string): number {
  const [y, m, d] = fechaISO.split("-").map(Number);
  const venc = new Date(y!, m! - 1, d!);
  const hoy = new Date();
  const hoyMid = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return Math.round((venc.getTime() - hoyMid.getTime()) / 86400000);
}

function fmtFecha(fechaISO: string): string {
  const [y, m, d] = fechaISO.split("-");
  return `${d}/${m}/${y}`;
}

function fmtPeriodo(p: string): string {
  const m = p.match(/^(\d{4})-(\d{2})$/);
  return m ? `${m[2]}/${m[1]}` : p;
}

function EstadoBadge({ row }: { row: Form931Row }) {
  if (row.enviado_ypf && row.enviado_loma) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
        <Check size={12} /> Completo
      </span>
    );
  }
  const d = diasRestantes(row.fecha_limite);
  let cls = "bg-slate-100 text-slate-600 border-slate-200/60";
  let txt = `en ${d} días`;
  if (d < 0) { cls = "bg-red-100 text-red-700 border-red-200/60"; txt = `vencido hace ${Math.abs(d)} d`; }
  else if (d === 0) { cls = "bg-red-100 text-red-700 border-red-200/60"; txt = "vence hoy"; }
  else if (d <= 5) { cls = "bg-red-50 text-red-700 border-red-200/50"; txt = `en ${d} días`; }
  else if (d <= 15) { cls = "bg-amber-50 text-amber-700 border-amber-200/60"; txt = `en ${d} días`; }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cls}`}>
      <CalendarClock size={12} /> {txt}
    </span>
  );
}

/** Toggle de envío de un canal (YPF/Loma) con su responsable de referencia. */
function EnvioToggle({
  enviado,
  responsable,
  canal,
  loading,
  disabled,
  onToggle,
}: {
  enviado: boolean;
  responsable: string;
  /** Plataforma — sólo se imprime en la tarjeta de celular, donde no hay columna que la nombre. */
  canal?: string;
  loading: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      onClick={onToggle}
      title={enviado ? "Marcar como NO enviado" : "Marcar como enviado"}
      className={`inline-flex items-center gap-1.5 px-2 py-1 max-md:h-9 max-md:px-2.5 rounded-md border text-[11px] font-semibold transition-colors disabled:opacity-50 ${
        enviado
          ? "bg-emerald-500 border-emerald-500 text-white"
          : "bg-card border-border text-muted-foreground hover:border-emerald-400"
      }`}
    >
      {loading ? (
        <Loader2 size={12} className="animate-spin" />
      ) : (
        <span className={`flex items-center justify-center w-3.5 h-3.5 shrink-0 rounded-sm border ${enviado ? "border-white/70" : "border-border"}`}>
          {enviado && <Check size={10} />}
        </span>
      )}
      {canal && <span>{canal}:</span>}
      {enviado ? "Enviado" : "Pendiente"}
      <span className={`font-normal ${enviado ? "text-white/80" : "text-muted-foreground/60"}`}>· {responsable}</span>
    </button>
  );
}

type DialogState =
  | { mode: "closed" }
  | { mode: "add" }
  | { mode: "edit"; row: Form931Row };

export default function Form931Client({
  periodos,
  canWrite,
}: {
  periodos: Form931Row[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState>({ mode: "closed" });
  const [togglingKey, setTogglingKey] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [periodo, setPeriodo] = useState("");
  const [fecha, setFecha] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openAdd = () => {
    setPeriodo(""); setFecha(""); setObservaciones("");
    setError(null); setDialog({ mode: "add" });
  };
  const openEdit = (row: Form931Row) => {
    setPeriodo(row.periodo); setFecha(row.fecha_limite); setObservaciones(row.observaciones ?? "");
    setError(null); setDialog({ mode: "edit", row });
  };

  const handleToggle = async (row: Form931Row, canal: Canal931) => {
    const actual = canal === "ypf" ? row.enviado_ypf : row.enviado_loma;
    setTogglingKey(`${row.id}:${canal}`);
    await toggleEnvioForm931Action(row.id, canal, !actual);
    setTogglingKey(null);
    router.refresh();
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await deleteForm931Action(id);
    setDeletingId(null);
    setConfirmId(null);
    router.refresh();
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const res =
      dialog.mode === "edit"
        ? await updateForm931Action(dialog.row.id, {
            periodo, fecha_limite: fecha, observaciones: observaciones || null,
          })
        : await createForm931Action({
            periodo, fecha_limite: fecha, observaciones: observaciones || null,
          });
    setSaving(false);
    if ("error" in res) { setError(res.error); return; }
    setDialog({ mode: "closed" });
    router.refresh();
  };

  /** Editar / eliminar — se usa igual en la tabla (desktop) y en las tarjetas (celular). */
  const renderAcciones = (p: Form931Row) =>
    confirmId === p.id ? (
      <div className="flex items-center justify-end gap-1">
        <Button variant="ghost" size="sm" className="h-7 max-md:h-9 px-2 max-md:px-3 text-[11px] text-red-600 hover:bg-red-50" disabled={deletingId === p.id} onClick={() => handleDelete(p.id)}>
          {deletingId === p.id ? <Loader2 size={13} className="animate-spin" /> : "Eliminar"}
        </Button>
        <Button variant="ghost" size="sm" className="h-7 max-md:h-9 px-2 max-md:px-3 text-[11px] text-muted-foreground" onClick={() => setConfirmId(null)}>Cancelar</Button>
      </div>
    ) : (
      <div className="flex items-center justify-end gap-1">
        <Button variant="ghost" size="sm" className="h-7 w-7 max-md:h-9 max-md:w-9 p-0 text-muted-foreground hover:text-primary hover:bg-primary/5" title="Editar" onClick={() => openEdit(p)}>
          <Pencil size={14} />
        </Button>
        <Button variant="ghost" size="sm" className="h-7 w-7 max-md:h-9 max-md:w-9 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50" title="Eliminar" onClick={() => setConfirmId(p.id)}>
          <Trash2 size={14} />
        </Button>
      </div>
    );

  return (
    <div className="bg-card rounded-[8px] border border-border shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3.5 sm:py-4 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <FileCheck2 size={16} className="shrink-0 text-primary" />
          <h2 className="text-foreground text-sm font-semibold">Períodos del Formulario 931</h2>
        </div>
        {canWrite && (
          <Button variant="brand" size="sm" onClick={openAdd}>
            <Plus size={14} /> Agregar período
          </Button>
        )}
      </div>

      {/* Celular: una tarjeta por período. La tabla de 6 columnas con los dos
          toggles no entra en 343px y el toggle es la acción principal. */}
      <div className="md:hidden divide-y divide-border">
        {periodos.length === 0 ? (
          <p className="py-10 px-4 text-center text-muted-foreground text-sm">
            No hay períodos cargados. {canWrite && "Usá “Agregar período” para empezar."}
          </p>
        ) : (
          periodos.map((p) => {
            const completo = p.enviado_ypf && p.enviado_loma;
            return (
              <div key={p.id} className={`px-4 py-3.5 space-y-2.5 ${completo ? "opacity-60" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground tabular-nums">{fmtPeriodo(p.periodo)}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      Límite {fmtFecha(p.fecha_limite)}
                    </p>
                  </div>
                  <div className="shrink-0">
                    <EstadoBadge row={p} />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <EnvioToggle
                    enviado={p.enviado_ypf}
                    responsable="Nico"
                    canal="YPF"
                    loading={togglingKey === `${p.id}:ypf`}
                    disabled={!canWrite}
                    onToggle={() => handleToggle(p, "ypf")}
                  />
                  <EnvioToggle
                    enviado={p.enviado_loma}
                    responsable="Noelia"
                    canal="Loma Negra"
                    loading={togglingKey === `${p.id}:loma`}
                    disabled={!canWrite}
                    onToggle={() => handleToggle(p, "loma")}
                  />
                </div>

                {canWrite && renderAcciones(p)}
              </div>
            );
          })
        )}
      </div>

      <div className="hidden md:block">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider pl-6">Período</TableHead>
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Fecha límite</TableHead>
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">YPF</TableHead>
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Loma Negra</TableHead>
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Estado</TableHead>
              {canWrite && <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right pr-6">Acciones</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {periodos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canWrite ? 6 : 5} className="py-16 text-center text-muted-foreground text-sm">
                  No hay períodos cargados. {canWrite && "Usá “Agregar período” para empezar."}
                </TableCell>
              </TableRow>
            ) : (
              periodos.map((p) => {
                const completo = p.enviado_ypf && p.enviado_loma;
                return (
                  <TableRow key={p.id} className={`hover:bg-muted/10 transition-colors ${completo ? "opacity-60" : ""}`}>
                    <TableCell className="font-semibold text-foreground pl-6 tabular-nums">{fmtPeriodo(p.periodo)}</TableCell>
                    <TableCell className="text-foreground font-medium tabular-nums">{fmtFecha(p.fecha_limite)}</TableCell>
                    <TableCell>
                      <EnvioToggle
                        enviado={p.enviado_ypf}
                        responsable="Nico"
                        loading={togglingKey === `${p.id}:ypf`}
                        disabled={!canWrite}
                        onToggle={() => handleToggle(p, "ypf")}
                      />
                    </TableCell>
                    <TableCell>
                      <EnvioToggle
                        enviado={p.enviado_loma}
                        responsable="Noelia"
                        loading={togglingKey === `${p.id}:loma`}
                        disabled={!canWrite}
                        onToggle={() => handleToggle(p, "loma")}
                      />
                    </TableCell>
                    <TableCell><EstadoBadge row={p} /></TableCell>
                    {canWrite && (
                      <TableCell className="text-right pr-6">{renderAcciones(p)}</TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialog.mode !== "closed"} onOpenChange={(v) => !v && setDialog({ mode: "closed" })}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="text-foreground text-lg sm:text-xl">
              {dialog.mode === "edit" ? "Editar período" : "Agregar período"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {dialog.mode === "edit"
                ? "Actualizá el período, la fecha límite o las observaciones."
                : "Cargá un nuevo período del F931 y su fecha límite de envío."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {error && <InlineFeedback variant="error" message={error} onDismiss={() => setError(null)} autoHideMs={0} />}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="f931-periodo" className="text-sm font-medium text-foreground">Período</Label>
                <Input id="f931-periodo" value={periodo} onChange={(e) => setPeriodo(e.target.value)} placeholder="Ej: 2026-06" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="f931-fecha" className="text-sm font-medium text-foreground">Fecha límite</Label>
                <Input id="f931-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="f931-obs" className="text-sm font-medium text-foreground">Observaciones <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <Input id="f931-obs" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Ej: enviado por mail a compras YPF" />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setDialog({ mode: "closed" })} disabled={saving}>Cancelar</Button>
            <Button variant="brand" onClick={handleSave} disabled={saving || !periodo.trim() || !fecha}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              {dialog.mode === "edit" ? "Guardar cambios" : "Agregar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
