"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Landmark, Plus, Pencil, Trash2, Loader2, Check, CalendarClock,
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
  togglePresentadoImpuestoAction,
  updateImpuestoAction,
  createImpuestoAction,
  deleteImpuestoAction,
  type ImpuestoRow,
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

function VencimientoBadge({ fechaISO, presentado }: { fechaISO: string; presentado: boolean }) {
  if (presentado) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
        <Check size={12} /> Presentado
      </span>
    );
  }
  const d = diasRestantes(fechaISO);
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

type DialogState =
  | { mode: "closed" }
  | { mode: "add" }
  | { mode: "edit"; row: ImpuestoRow };

export default function ImpuestosClient({
  impuestos,
  canWrite,
}: {
  impuestos: ImpuestoRow[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState>({ mode: "closed" });
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form state (compartido add/edit)
  const [nombre, setNombre] = useState("");
  const [organismo, setOrganismo] = useState("");
  const [fecha, setFecha] = useState("");
  const [periodo, setPeriodo] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openAdd = () => {
    setNombre(""); setOrganismo(""); setFecha(""); setPeriodo(""); setObservaciones("");
    setError(null); setDialog({ mode: "add" });
  };
  const openEdit = (row: ImpuestoRow) => {
    setNombre(row.nombre); setOrganismo(row.organismo ?? ""); setFecha(row.fecha_vencimiento);
    setPeriodo(row.periodo ?? ""); setObservaciones(row.observaciones ?? "");
    setError(null); setDialog({ mode: "edit", row });
  };

  const handleToggle = async (row: ImpuestoRow) => {
    setTogglingId(row.id);
    await togglePresentadoImpuestoAction(row.id, !row.presentado);
    setTogglingId(null);
    router.refresh();
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await deleteImpuestoAction(id);
    setDeletingId(null);
    setConfirmId(null);
    router.refresh();
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const res =
      dialog.mode === "edit"
        ? await updateImpuestoAction(dialog.row.id, {
            nombre, organismo: organismo || null, fecha_vencimiento: fecha, observaciones: observaciones || null,
          })
        : await createImpuestoAction({
            nombre, organismo: organismo || null, periodo: periodo || null, fecha_vencimiento: fecha,
          });
    setSaving(false);
    if ("error" in res) { setError(res.error); return; }
    setDialog({ mode: "closed" });
    router.refresh();
  };

  return (
    <div className="bg-card rounded-[8px] border border-border shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Landmark size={16} className="text-primary" />
          <h2 className="text-foreground text-sm font-semibold">Calendario de vencimientos</h2>
        </div>
        {canWrite && (
          <Button variant="brand" size="sm" onClick={openAdd}>
            <Plus size={14} /> Agregar impuesto
          </Button>
        )}
      </div>

      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow>
            {canWrite && <TableHead className="w-10 pl-6" />}
            <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Impuesto</TableHead>
            <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Organismo</TableHead>
            <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Vencimiento</TableHead>
            <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Estado</TableHead>
            {canWrite && <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right pr-6">Acciones</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {impuestos.length === 0 ? (
            <TableRow>
              <TableCell colSpan={canWrite ? 6 : 4} className="py-16 text-center text-muted-foreground text-sm">
                No hay impuestos cargados. {canWrite && "Usá “Agregar impuesto” para empezar."}
              </TableCell>
            </TableRow>
          ) : (
            impuestos.map((i) => (
              <TableRow key={i.id} className={`hover:bg-muted/10 transition-colors ${i.presentado ? "opacity-60" : ""}`}>
                {canWrite && (
                  <TableCell className="pl-6">
                    <button
                      type="button"
                      title={i.presentado ? "Marcar como pendiente" : "Marcar como presentado"}
                      onClick={() => handleToggle(i)}
                      disabled={togglingId === i.id}
                      className={`flex items-center justify-center w-5 h-5 rounded border transition-colors ${
                        i.presentado
                          ? "bg-emerald-500 border-emerald-500 text-white"
                          : "border-border hover:border-emerald-400"
                      }`}
                    >
                      {togglingId === i.id ? <Loader2 size={12} className="animate-spin" /> : i.presentado ? <Check size={12} /> : null}
                    </button>
                  </TableCell>
                )}
                <TableCell className={`font-semibold text-foreground ${i.presentado ? "line-through" : ""}`}>
                  {i.nombre}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {i.organismo ? (
                    <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-semibold border border-slate-200/40">
                      {i.organismo}
                    </span>
                  ) : <span className="text-muted-foreground/40">—</span>}
                </TableCell>
                <TableCell className="text-foreground font-medium tabular-nums">{fmtFecha(i.fecha_vencimiento)}</TableCell>
                <TableCell><VencimientoBadge fechaISO={i.fecha_vencimiento} presentado={i.presentado} /></TableCell>
                {canWrite && (
                  <TableCell className="text-right pr-6">
                    {confirmId === i.id ? (
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px] text-red-600 hover:bg-red-50" disabled={deletingId === i.id} onClick={() => handleDelete(i.id)}>
                          {deletingId === i.id ? <Loader2 size={13} className="animate-spin" /> : "Eliminar"}
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px] text-muted-foreground" onClick={() => setConfirmId(null)}>Cancelar</Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-primary hover:bg-primary/5" title="Editar" onClick={() => openEdit(i)}>
                          <Pencil size={14} />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50" title="Eliminar" onClick={() => setConfirmId(i.id)}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <Dialog open={dialog.mode !== "closed"} onOpenChange={(v) => !v && setDialog({ mode: "closed" })}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="text-foreground text-xl">
              {dialog.mode === "edit" ? "Editar impuesto" : "Agregar impuesto"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {dialog.mode === "edit" ? "Actualizá los datos y la fecha de vencimiento." : "Cargá un impuesto y su vencimiento."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {error && <InlineFeedback variant="error" message={error} onDismiss={() => setError(null)} autoHideMs={0} />}
            <div className="space-y-2">
              <Label htmlFor="imp-nombre" className="text-sm font-medium text-foreground">Impuesto</Label>
              <Input id="imp-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: IVA, SICORE 1er. Q…" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="imp-org" className="text-sm font-medium text-foreground">Organismo</Label>
                <Input id="imp-org" value={organismo} onChange={(e) => setOrganismo(e.target.value)} placeholder="AFIP, ARBA…" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="imp-fecha" className="text-sm font-medium text-foreground">Vencimiento</Label>
                <Input id="imp-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </div>
            </div>
            {dialog.mode === "add" && (
              <div className="space-y-2">
                <Label htmlFor="imp-periodo" className="text-sm font-medium text-foreground">Período <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                <Input id="imp-periodo" value={periodo} onChange={(e) => setPeriodo(e.target.value)} placeholder="Ej: 2026-07" />
              </div>
            )}
            {dialog.mode === "edit" && (
              <div className="space-y-2">
                <Label htmlFor="imp-obs" className="text-sm font-medium text-foreground">Observaciones <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                <Input id="imp-obs" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setDialog({ mode: "closed" })} disabled={saving}>Cancelar</Button>
            <Button variant="brand" onClick={handleSave} disabled={saving || !nombre.trim() || !fecha}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              {dialog.mode === "edit" ? "Guardar cambios" : "Agregar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
