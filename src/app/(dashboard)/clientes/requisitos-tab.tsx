"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Dialog } from "@base-ui/react/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Plus,
  Trash2,
  X,
  ClipboardList,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from "lucide-react";
import {
  getRequisitosAction,
  addRequisitoAction,
  deleteRequisitoAction,
  setRequisitoEstadoAction,
  type Requisito,
  type RequisitoEstado,
  type ContactoActionState,
} from "./sub-resources-actions";

const TIPOS: { value: string; label: string }[] = [
  { value: "habilitacion_proveedor", label: "Habilitación proveedor" },
  { value: "documentacion_chofer", label: "Doc. chofer" },
  { value: "documentacion_camion", label: "Doc. camión" },
  { value: "reporte_periodico", label: "Reporte periódico" },
  { value: "auditoria", label: "Auditoría" },
  { value: "otro", label: "Otro" },
];

const FRECUENCIAS: { value: string; label: string }[] = [
  { value: "", label: "Sin frecuencia" },
  { value: "unica", label: "Única vez" },
  { value: "mensual", label: "Mensual" },
  { value: "trimestral", label: "Trimestral" },
  { value: "semestral", label: "Semestral" },
  { value: "anual", label: "Anual" },
];

const TIPO_LABEL = Object.fromEntries(TIPOS.map((t) => [t.value, t.label]));

const ESTADO_META: Record<
  RequisitoEstado,
  { label: string; icon: typeof CheckCircle2; bg: string; text: string; border: string }
> = {
  pendiente: {
    label: "Pendiente",
    icon: Clock,
    bg: "bg-[#FFFBEB]",
    text: "text-[#92400E]",
    border: "border-[#FDE68A]",
  },
  cumplido: {
    label: "Cumplido",
    icon: CheckCircle2,
    bg: "bg-[#ECFDF5]",
    text: "text-[#047857]",
    border: "border-[#A7F3D0]",
  },
  vencido: {
    label: "Vencido",
    icon: AlertTriangle,
    bg: "bg-[#FEF2F2]",
    text: "text-[#B91C1C]",
    border: "border-[#FECACA]",
  },
};

function isFechaVencida(fecha: string | null): boolean {
  if (!fecha) return false;
  const hoy = new Date().toISOString().slice(0, 10);
  return fecha < hoy;
}

export default function RequisitosTab({ clienteId }: { clienteId: string }) {
  const [items, setItems] = useState<Requisito[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    getRequisitosAction(clienteId).then((d) => {
      if (!cancel) {
        setItems(d);
        setLoading(false);
      }
    });
    return () => {
      cancel = true;
    };
  }, [clienteId, tick]);

  const refresh = () => setTick((t) => t + 1);

  const handleDelete = (id: string, desc: string) => {
    if (!confirm(`¿Eliminar el requisito "${desc}"?`)) return;
    startTransition(async () => {
      await deleteRequisitoAction(id);
      refresh();
    });
  };

  const handleSetEstado = (id: string, estado: RequisitoEstado) => {
    startTransition(async () => {
      await setRequisitoEstadoAction(id, estado);
      refresh();
    });
  };

  const counts = items.reduce(
    (acc, r) => {
      acc[r.estado]++;
      return acc;
    },
    { pendiente: 0, cumplido: 0, vencido: 0 } as Record<RequisitoEstado, number>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground/70 uppercase">
            {items.length} requisito{items.length === 1 ? "" : "s"}
          </p>
          {counts.pendiente > 0 && (
            <span className="text-[10px] font-semibold uppercase tracking-wide bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A] rounded-full px-2 py-0.5">
              {counts.pendiente} pendiente{counts.pendiente === 1 ? "" : "s"}
            </span>
          )}
          {counts.vencido > 0 && (
            <span className="text-[10px] font-semibold uppercase tracking-wide bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA] rounded-full px-2 py-0.5">
              {counts.vencido} vencido{counts.vencido === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <AddRequisitoDialog clienteId={clienteId} onAdded={refresh} />
      </div>

      {loading ? (
        <div className="py-10 flex items-center justify-center text-muted-foreground">
          <Loader2 size={18} className="animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground bg-card border border-dashed border-border rounded-[8px]">
          Aún no hay requisitos cargados.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((r) => {
            const vencida = isFechaVencida(r.proxima_fecha) && r.estado !== "cumplido";
            const meta = ESTADO_META[r.estado];
            const Icon = meta.icon;
            return (
              <li
                key={r.id}
                className="bg-card border border-border rounded-[8px] p-3 group"
              >
                <div className="flex items-start gap-3">
                  <span className="size-9 rounded-md bg-[#E1F5FE] text-primary flex items-center justify-center shrink-0">
                    <ClipboardList size={16} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-foreground font-semibold text-sm">
                        {r.descripcion}
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-wide bg-muted text-muted-foreground rounded-full px-2 py-0.5">
                        {TIPO_LABEL[r.tipo] ?? r.tipo}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide ${meta.bg} ${meta.text} border ${meta.border} rounded-full px-2 py-0.5`}
                      >
                        <Icon size={9} />
                        {meta.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                      {r.frecuencia && (
                        <span className="capitalize">{r.frecuencia.replace("_", " ")}</span>
                      )}
                      {r.proxima_fecha && (
                        <span
                          className={`inline-flex items-center gap-1 ${
                            vencida ? "text-[#B91C1C] font-semibold" : ""
                          }`}
                        >
                          <Calendar size={11} />
                          {new Date(r.proxima_fecha).toLocaleDateString("es-AR")}
                          {vencida && " · vencida"}
                        </span>
                      )}
                      {r.responsable_interno && (
                        <span>Responsable: {r.responsable_interno}</span>
                      )}
                      {r.formato_requerido && (
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
                          {r.formato_requerido}
                        </span>
                      )}
                    </div>
                    {r.observaciones && (
                      <p className="text-xs text-muted-foreground italic mt-1">{r.observaciones}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(r.id, r.descripcion)}
                    disabled={pending}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-red-50 text-red-500 hover:text-red-600 disabled:opacity-30"
                    title="Eliminar requisito"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                <div className="flex items-center gap-1 mt-2 pl-12">
                  {(["pendiente", "cumplido", "vencido"] as RequisitoEstado[]).map((e) => {
                    const isCurrent = r.estado === e;
                    const m = ESTADO_META[e];
                    return (
                      <button
                        key={e}
                        type="button"
                        disabled={pending || isCurrent}
                        onClick={() => handleSetEstado(r.id, e)}
                        className={`text-[10px] px-2 h-6 rounded uppercase tracking-wide font-semibold transition-colors ${
                          isCurrent
                            ? `${m.bg} ${m.text} border ${m.border}`
                            : "text-muted-foreground/70 hover:bg-muted hover:text-muted-foreground"
                        } disabled:cursor-not-allowed`}
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function AddRequisitoDialog({
  clienteId,
  onAdded,
}: {
  clienteId: string;
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ContactoActionState, FormData>(
    addRequisitoAction,
    null
  );

  useEffect(() => {
    if (state?.ok) {
      setOpen(false);
      onAdded();
    }
  }, [state, onAdded]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Button variant="brand" size="sm" onClick={() => setOpen(true)}>
        <Plus size={14} />
        Agregar requisito
      </Button>

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[min(560px,calc(100vw-2rem))] max-h-[90vh] flex flex-col bg-card rounded-[12px] shadow-2xl border border-border transition duration-150 ease-out data-ending-style:opacity-0 data-ending-style:scale-95 data-starting-style:opacity-0 data-starting-style:scale-95">
          <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b border-border">
            <div>
              <Dialog.Title className="text-foreground text-base font-semibold">
                Nuevo requisito
              </Dialog.Title>
              <Dialog.Description className="text-muted-foreground text-xs mt-0.5">
                Documentación o reporte que el cliente exige para operar.
              </Dialog.Description>
            </div>
            <Dialog.Close
              render={
                <button
                  type="button"
                  className="size-7 rounded-full text-muted-foreground hover:bg-muted inline-flex items-center justify-center"
                  aria-label="Cerrar"
                />
              }
            >
              <X size={16} />
            </Dialog.Close>
          </div>

          <form
            action={formAction}
            key={open ? "open" : "closed"}
            className="flex-1 overflow-y-auto px-5 py-4 space-y-3"
          >
            <input type="hidden" name="cliente_id" value={clienteId} />

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Tipo *</label>
              <select
                name="tipo"
                defaultValue="otro"
                className="w-full h-9 px-3 text-sm border border-border rounded-md bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-[#0088D1]/30 focus:border-[#0088D1]"
              >
                {TIPOS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <Field
              label="Descripción *"
              name="descripcion"
              required
              error={state?.fieldErrors?.descripcion}
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                  Frecuencia
                </label>
                <select
                  name="frecuencia"
                  defaultValue=""
                  className="w-full h-9 px-3 text-sm border border-border rounded-md bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-[#0088D1]/30 focus:border-[#0088D1]"
                >
                  {FRECUENCIAS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
              <Field label="Próxima fecha" name="proxima_fecha" type="date" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Formato requerido"
                name="formato_requerido"
                placeholder="PDF, Excel..."
              />
              <Field label="Responsable interno" name="responsable_interno" />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Estado</label>
              <select
                name="estado"
                defaultValue="pendiente"
                className="w-full h-9 px-3 text-sm border border-border rounded-md bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-[#0088D1]/30 focus:border-[#0088D1]"
              >
                <option value="pendiente">Pendiente</option>
                <option value="cumplido">Cumplido</option>
                <option value="vencido">Vencido</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                Observaciones
              </label>
              <textarea
                name="observaciones"
                rows={2}
                className="w-full px-3 py-2 text-sm border border-border rounded-md bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-[#0088D1]/30 focus:border-[#0088D1] resize-none"
              />
            </div>

            {state?.error && (
              <div className="bg-[#FEF2F2] border border-[#FECACA] text-[#7F1D1D] text-sm rounded-md px-3 py-2">
                {state.error}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <SubmitButton />
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
  error,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  error?: string;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-muted-foreground mb-1 block">{label}</label>
      <Input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="text-sm"
      />
      {error && <p className="text-xs text-[#B91C1C] mt-1">{error}</p>}
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="brand" size="sm" disabled={pending}>
      {pending ? "Guardando..." : "Guardar requisito"}
    </Button>
  );
}
