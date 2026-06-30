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
import {
  Landmark, DollarSign, User, Fingerprint, Calendar, MessageSquare, Check, type LucideIcon,
} from "lucide-react";
import { createChequeAction } from "../actions";

export type LibradorOption = { nombre: string; cuit: string | null };

export default function AddChequeDialog({
  children,
  libradores,
}: {
  children: React.ReactNode;
  libradores: LibradorOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().split("T")[0];

  const [libradorNombre, setLibradorNombre] = useState("");
  const [libradorCuit, setLibradorCuit] = useState("");
  const [importe, setImporte] = useState("");
  const [fechaVencimiento, setFechaVencimiento] = useState(today);
  const [observaciones, setObservaciones] = useState("");

  const resetForm = () => {
    setLibradorNombre("");
    setLibradorCuit("");
    setImporte("");
    setFechaVencimiento(today);
    setObservaciones("");
    setError(null);
  };

  // Al elegir/escribir un librador conocido, autocompleta su CUIT.
  const onLibradorChange = (v: string) => {
    setLibradorNombre(v);
    const match = libradores.find((l) => l.nombre.toLowerCase() === v.trim().toLowerCase());
    if (match?.cuit) setLibradorCuit(match.cuit);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importe || isNaN(Number(importe))) return;
    setLoading(true);
    setError(null);
    try {
      const res = await createChequeAction({
        librador_nombre: libradorNombre,
        librador_cuit: libradorCuit || null,
        tipo: "electronico", // siempre echeq diferido electrónico
        importe: parseFloat(importe),
        fecha_vencimiento: fechaVencimiento,
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
      <DialogContent className="sm:max-w-[520px] p-6 gap-0">
        <DialogHeader className="border-b border-border pb-4 -mx-6 px-6 pt-1">
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center size-12 rounded-full bg-[#E1F5FE] text-primary shrink-0">
              <Landmark size={22} />
            </div>
            <div>
              <DialogTitle className="text-foreground text-lg font-bold">Registrar Cheque</DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs font-medium mt-0.5">
                Echeq diferido. Quedará en cartera. Solo importe, librador y vencimiento.
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

          <datalist id="libradores-list">
            {libradores.map((l) => (
              <option key={l.nombre} value={l.nombre} />
            ))}
          </datalist>

          {/* Librador + CUIT */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputFieldWithIcon
              label="Librador *"
              name="libradorNombre"
              placeholder="Ej: Loma Negra"
              required
              value={libradorNombre}
              onChange={(e) => onLibradorChange(e.target.value)}
              icon={User}
              list="libradores-list"
            />
            <InputFieldWithIcon
              label="CUIT del librador"
              name="libradorCuit"
              placeholder="30-12345678-9 (se autocompleta)"
              value={libradorCuit}
              onChange={(e) => setLibradorCuit(e.target.value)}
              icon={Fingerprint}
            />
          </div>
          <p className="-mt-2 text-[11px] text-muted-foreground">
            Elegí uno de la lista o <strong>escribí uno nuevo</strong> y completá su CUIT: queda
            guardado para la próxima vez.
          </p>

          {/* Importe + Vencimiento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputFieldWithIcon
              label="Importe ($) *"
              name="importe"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              required
              value={importe}
              onChange={(e) => setImporte(e.target.value)}
              icon={DollarSign}
            />
            <InputFieldWithIcon
              label="Fecha de vencimiento *"
              name="fechaVencimiento"
              type="date"
              required
              value={fechaVencimiento}
              onChange={(e) => setFechaVencimiento(e.target.value)}
              icon={Calendar}
            />
          </div>

          {/* Observaciones */}
          <InputFieldWithIcon
            label="Observaciones"
            name="observaciones"
            placeholder="Notas internas (opcional)"
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            icon={MessageSquare}
          />

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

function InputFieldWithIcon({
  label, name, type = "text", placeholder, required, value, onChange, icon: Icon, step, min, list,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  icon: LucideIcon;
  step?: string;
  min?: string;
  list?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-semibold text-muted-foreground">{label}</Label>
      <div className="relative flex items-center h-10 w-full rounded-lg border border-border bg-card overflow-hidden focus-within:ring-2 focus-within:ring-[#0088D1]/20 focus-within:border-[#0088D1] transition-all">
        <div className="flex items-center justify-center w-10 h-full border-r border-border bg-muted/50 text-primary shrink-0">
          <Icon size={15} />
        </div>
        <input
          name={name}
          type={type}
          placeholder={placeholder}
          required={required}
          value={value}
          onChange={onChange}
          step={step}
          min={min}
          list={list}
          className="flex-1 h-full px-3 text-sm bg-transparent border-0 outline-none focus:outline-none focus:ring-0 text-foreground"
        />
      </div>
    </div>
  );
}
