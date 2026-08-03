"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/combobox";
import {
  Landmark, DollarSign, Fingerprint, Calendar, MessageSquare, Check,
  Sliders, Home, FileText, Hash,
} from "lucide-react";
import { updateChequeAction, type ChequeOrigen, type ChequeTipo } from "../actions";
import { describirError } from "../errores";
import {
  BancoField,
  FieldBlock,
  FieldInput,
  LibradorField,
  OrigenField,
  TIPO_OPTS,
  type BancoOption,
  type LibradorOption,
} from "./cheque-form-fields";

export type ChequeEditable = {
  id: string;
  numero: string | null;
  tipo: ChequeTipo;
  origen: ChequeOrigen;
  /** Hace falta para saber si todavía se puede corregir de qué lado es. */
  estado: string;
  librador_nombre: string;
  librador_cuit: string | null;
  importe: number;
  fecha_vencimiento: string;
  banco_nombre: string | null;
  sucursal_banco: string | null;
  cuenta_corriente: string | null;
  observaciones: string | null;
};

/** Mientras el cheque no arrancó a moverse, se puede corregir el lado. */
const ESTADOS_ORIGEN_EDITABLE = ["cartera", "emitido", "anulado"];

export default function EditChequeDialog({
  cheque,
  libradores,
  bancos,
  open,
  onOpenChange,
}: {
  cheque: ChequeEditable;
  libradores: LibradorOption[];
  bancos: BancoOption[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [numero, setNumero] = useState(cheque.numero ?? "");
  const [origen, setOrigen] = useState<ChequeOrigen>(cheque.origen);
  const [tipo, setTipo] = useState<ChequeTipo>(cheque.tipo);
  const [libradorNombre, setLibradorNombre] = useState(cheque.librador_nombre);
  const [libradorCuit, setLibradorCuit] = useState(cheque.librador_cuit ?? "");
  const [importe, setImporte] = useState(String(cheque.importe));
  const [fechaVencimiento, setFechaVencimiento] = useState(
    cheque.fecha_vencimiento.split("T")[0],
  );
  const [bancoNombre, setBancoNombre] = useState(cheque.banco_nombre ?? "");
  const [sucursal, setSucursal] = useState(cheque.sucursal_banco ?? "");
  const [cuentaCorriente, setCuentaCorriente] = useState(cheque.cuenta_corriente ?? "");
  const [observaciones, setObservaciones] = useState(cheque.observaciones ?? "");

  const puedeCambiarOrigen = ESTADOS_ORIGEN_EDITABLE.includes(cheque.estado);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importe || isNaN(Number(importe))) return;
    setLoading(true);
    setError(null);
    try {
      const res = await updateChequeAction({
        id: cheque.id,
        numero: numero || null,
        origen,
        tipo,
        librador_nombre: libradorNombre,
        librador_cuit: libradorCuit || null,
        importe: parseFloat(importe),
        fecha_vencimiento: fechaVencimiento,
        banco_nombre: bancoNombre || null,
        sucursal_banco: sucursal || null,
        cuenta_corriente: cuentaCorriente || null,
        observaciones: observaciones || null,
      });
      if (res.error) {
        setError(res.error);
      } else {
        onOpenChange(false);
        router.refresh();
      }
    } catch (e) {
      setError(describirError(e, "No se pudo guardar el cheque."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] p-6 gap-0">
        <DialogHeader className="border-b border-border pb-4 -mx-6 px-6 pt-1">
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center size-12 rounded-full bg-[#E1F5FE] text-primary shrink-0">
              <Landmark size={22} />
            </div>
            <div>
              <DialogTitle className="text-foreground text-lg font-bold">Editar cheque</DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs font-medium mt-0.5">
                Corregí los datos cargados. El estado se cambia desde las acciones de la fila.
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

          {/* De quién es el cheque — se puede corregir si todavía no se movió */}
          <OrigenField
            value={origen}
            onValueChange={setOrigen}
            disabled={!puedeCambiarOrigen}
            disabledHint="El cheque ya está en circulación: para cambiarlo de lado hay que borrarlo y cargarlo de nuevo."
          />

          {/* Tipo (Echeq / Físico) + Librador */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SelectField
              label="Tipo de cheque *"
              icon={Sliders}
              options={TIPO_OPTS}
              value={tipo}
              onValueChange={(v) => setTipo((v || "electronico") as ChequeTipo)}
            />

            <LibradorField
              libradores={libradores}
              nombre={libradorNombre}
              onNombreChange={setLibradorNombre}
              onCuitChange={setLibradorCuit}
              label={origen === "propio" ? "Librador (nuestra firma) *" : "Librador *"}
            />
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
              <FieldBlock label="Número de cheque" icon={Hash}>
                <FieldInput
                  icon={Hash}
                  placeholder="Nº impreso en el cheque"
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                />
              </FieldBlock>
              <BancoField bancos={bancos} value={bancoNombre} onValueChange={setBancoNombre} />
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
              onClick={() => onOpenChange(false)}
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
              {loading ? "Guardando..." : (<><Check size={16} strokeWidth={2.5} /> Guardar cambios</>)}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
