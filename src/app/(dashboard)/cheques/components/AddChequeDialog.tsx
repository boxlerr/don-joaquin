"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/combobox";
import {
  Landmark, DollarSign, User, Fingerprint, Calendar, MessageSquare, Check,
  Sliders, Home, FileText, Plus, type LucideIcon,
} from "lucide-react";
import { createChequeAction, type ChequeTipo } from "../actions";

export type LibradorOption = { nombre: string; cuit: string | null };
type BancoOption = { id: string; nombre: string };

const TIPO_OPTS = [
  { id: "electronico", label: "Echeq (electrónico)" },
  { id: "diferido", label: "Cheque físico" },
];

export default function AddChequeDialog({
  children,
  libradores,
  bancos,
}: {
  children: React.ReactNode;
  libradores: LibradorOption[];
  bancos: BancoOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().split("T")[0];

  const [tipo, setTipo] = useState<ChequeTipo>("electronico"); // echeq preseleccionado
  const [libradorNombre, setLibradorNombre] = useState("");
  const [libradorCuit, setLibradorCuit] = useState("");
  const [libradorNuevo, setLibradorNuevo] = useState(false);
  const [importe, setImporte] = useState("");
  const [fechaVencimiento, setFechaVencimiento] = useState(today);
  const [bancoId, setBancoId] = useState("");
  const [sucursal, setSucursal] = useState("");
  const [cuentaCorriente, setCuentaCorriente] = useState("");
  const [observaciones, setObservaciones] = useState("");

  const resetForm = () => {
    setTipo("electronico");
    setLibradorNombre("");
    setLibradorCuit("");
    setLibradorNuevo(false);
    setImporte("");
    setFechaVencimiento(today);
    setBancoId("");
    setSucursal("");
    setCuentaCorriente("");
    setObservaciones("");
    setError(null);
  };

  // Al elegir un librador de la lista, autocompleta su CUIT.
  const onLibradorSelect = (nombre: string) => {
    setLibradorNombre(nombre);
    const match = libradores.find((l) => l.nombre === nombre);
    if (match?.cuit) setLibradorCuit(match.cuit);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importe || isNaN(Number(importe))) return;
    setLoading(true);
    setError(null);
    try {
      const res = await createChequeAction({
        tipo,
        librador_nombre: libradorNombre,
        librador_cuit: libradorCuit || null,
        importe: parseFloat(importe),
        fecha_vencimiento: fechaVencimiento,
        banco_id: bancoId || null,
        sucursal_banco: sucursal || null,
        cuenta_corriente: cuentaCorriente || null,
        observaciones: observaciones || null,
      });
      if (res.error) {
        setError(res.error);
      } else {
        setOpen(false);
        resetForm();
        router.refresh();
      }
    } catch {
      setError("Error al registrar el cheque.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) resetForm();
      }}
    >
      <DialogTrigger render={children as React.ReactElement} />
      <DialogContent className="sm:max-w-[540px] p-6 gap-0">
        <DialogHeader className="border-b border-border pb-4 -mx-6 px-6 pt-1">
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center size-12 rounded-full bg-[#E1F5FE] text-primary shrink-0">
              <Landmark size={22} />
            </div>
            <div>
              <DialogTitle className="text-foreground text-lg font-bold">Registrar Cheque</DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs font-medium mt-0.5">
                Diferido. Quedará en cartera. Lo importante: importe, librador y vencimiento.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg font-medium">
              {error}
            </div>
          )}

          {/* Tipo (Echeq / Físico) + Librador */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SelectField
              label="Tipo de cheque *"
              icon={Sliders}
              options={TIPO_OPTS}
              value={tipo}
              onValueChange={(v) => setTipo((v || "electronico") as ChequeTipo)}
            />

            {libradorNuevo ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-muted-foreground">Librador (nuevo) *</Label>
                  <button
                    type="button"
                    className="text-[11px] text-primary hover:underline"
                    onClick={() => { setLibradorNuevo(false); setLibradorNombre(""); }}
                  >
                    Elegir de la lista
                  </button>
                </div>
                <FieldInput
                  icon={User}
                  placeholder="Nombre / razón social"
                  value={libradorNombre}
                  onChange={(e) => setLibradorNombre(e.target.value)}
                  required
                />
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-muted-foreground">Librador *</Label>
                  <button
                    type="button"
                    className="inline-flex items-center gap-0.5 text-[11px] text-primary hover:underline"
                    onClick={() => { setLibradorNuevo(true); setLibradorNombre(""); setLibradorCuit(""); }}
                  >
                    <Plus size={11} /> Cargar otro
                  </button>
                </div>
                <SelectField
                  icon={User}
                  options={libradores.map((l) => ({ id: l.nombre, label: l.nombre }))}
                  value={libradorNombre}
                  onValueChange={onLibradorSelect}
                  placeholder="Elegí un librador..."
                  searchPlaceholder="Buscar librador..."
                />
              </div>
            )}
          </div>

          {/* CUIT */}
          <FieldBlock label="CUIT del librador" icon={Fingerprint}>
            <FieldInput
              icon={Fingerprint}
              placeholder="30-12345678-9 (se autocompleta de la lista)"
              value={libradorCuit}
              onChange={(e) => setLibradorCuit(e.target.value)}
            />
          </FieldBlock>

          {/* Importe + Vencimiento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldBlock label="Importe ($) *" icon={DollarSign}>
              <FieldInput
                icon={DollarSign}
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                required
                value={importe}
                onChange={(e) => setImporte(e.target.value)}
              />
            </FieldBlock>
            <FieldBlock label="Fecha de vencimiento *" icon={Calendar}>
              <FieldInput
                icon={Calendar}
                type="date"
                required
                value={fechaVencimiento}
                onChange={(e) => setFechaVencimiento(e.target.value)}
              />
            </FieldBlock>
          </div>

          {/* Datos bancarios — opcionales */}
          <details className="rounded-lg border border-border bg-muted/20 px-3 py-2">
            <summary className="cursor-pointer text-xs font-semibold text-muted-foreground select-none">
              Datos del banco (opcional)
            </summary>
            <div className="mt-3 space-y-3">
              <SelectField
                label="Banco"
                icon={Landmark}
                options={bancos.map((b) => ({ id: b.id, label: b.nombre }))}
                value={bancoId}
                onValueChange={setBancoId}
                placeholder="Sin banco"
                clearable
                searchPlaceholder="Buscar banco..."
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FieldBlock label="Sucursal" icon={Home}>
                  <FieldInput icon={Home} placeholder="Ej: 045 - Centro" value={sucursal} onChange={(e) => setSucursal(e.target.value)} />
                </FieldBlock>
                <FieldBlock label="Cuenta corriente" icon={FileText}>
                  <FieldInput icon={FileText} placeholder="Nº de cuenta" value={cuentaCorriente} onChange={(e) => setCuentaCorriente(e.target.value)} />
                </FieldBlock>
              </div>
            </div>
          </details>

          {/* Observaciones */}
          <FieldBlock label="Observaciones" icon={MessageSquare}>
            <FieldInput icon={MessageSquare} placeholder="Notas internas (opcional)" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
          </FieldBlock>

          <div className="flex justify-end gap-3 pt-4 mt-6 border-t border-border -mx-6 px-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="h-10 px-6 rounded-lg text-sm font-semibold border border-border text-muted-foreground hover:bg-muted/40 transition-colors"
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-[#0088D1] hover:bg-[#0277BD] text-white flex items-center justify-center gap-1.5 h-10 px-6 rounded-lg font-bold shadow-sm hover:shadow transition-all disabled:opacity-50"
            >
              {loading ? "Registrando..." : (<><Check size={16} strokeWidth={2.5} /> Confirmar cheque</>)}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FieldBlock({ label, children }: { label: string; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-semibold text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function FieldInput({
  icon: Icon, type = "text", placeholder, required, value, onChange, step, min,
}: {
  icon: LucideIcon;
  type?: string;
  placeholder?: string;
  required?: boolean;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  step?: string;
  min?: string;
}) {
  return (
    <div className="relative flex items-center h-10 w-full rounded-lg border border-border bg-card overflow-hidden focus-within:ring-2 focus-within:ring-[#0088D1]/20 focus-within:border-[#0088D1] transition-all">
      <div className="flex items-center justify-center w-10 h-full border-r border-border bg-muted/50 text-primary shrink-0">
        <Icon size={15} />
      </div>
      <input
        type={type}
        placeholder={placeholder}
        required={required}
        value={value}
        onChange={onChange}
        step={step}
        min={min}
        className="flex-1 h-full px-3 text-sm bg-transparent border-0 outline-none focus:outline-none focus:ring-0 text-foreground"
      />
    </div>
  );
}
