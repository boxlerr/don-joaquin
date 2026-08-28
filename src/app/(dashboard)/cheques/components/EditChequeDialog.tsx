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
  Sliders, Home, FileText, Hash, Activity,
} from "lucide-react";
import { updateChequeAction } from "../actions";
import {
  ESTADOS_POR_ORIGEN,
  type ChequeEstado,
  type ChequeOrigen,
  type ChequeTipo,
} from "../transiciones";
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

const ESTADO_OPTS_LABEL: Record<ChequeEstado, string> = {
  cartera: "En cartera",
  entregado: "Entregado",
  depositado: "Depositado",
  acreditado: "Acreditado",
  emitido: "Emitido",
  debitado: "Debitado",
  rechazado: "Rechazado",
  anulado: "Anulado",
};

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
  const [estado, setEstado] = useState<ChequeEstado>(cheque.estado as ChequeEstado);
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

  // Los estados posibles dependen del lado; al cruzar de lado hay que quedarse
  // con uno que exista del otro.
  const estadosPosibles = ESTADOS_POR_ORIGEN[origen];
  const estadoValido = estadosPosibles.includes(estado)
    ? estado
    : origen === "propio"
      ? "emitido"
      : "cartera";

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
        estado: estadoValido,
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
      {/* p-4 en celular (y los -mx tienen que seguirlo o el borde queda corrido). */}
      <DialogContent className="sm:max-w-[880px] p-4 sm:p-6 gap-0">
        <DialogHeader className="border-b border-border pb-4 -mx-4 px-4 sm:-mx-6 sm:px-6 pt-1">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="flex items-center justify-center size-10 sm:size-12 rounded-full bg-[#E1F5FE] text-primary shrink-0">
              <Landmark size={22} />
            </div>
            <div className="min-w-0 pr-8">
              <DialogTitle className="text-foreground text-lg font-bold">Editar cheque</DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs font-medium mt-0.5">
                Corregí cualquier dato, incluido el estado.
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

          {/* De quién es y en qué estado está: lo que define todo lo demás */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <OrigenField
              value={origen}
              onValueChange={setOrigen}
              disabled={!puedeCambiarOrigen}
              disabledHint="El cheque ya está en circulación: para cambiarlo de lado hay que borrarlo y cargarlo de nuevo."
            />
            <SelectField
              label="Estado"
              icon={Activity}
              options={estadosPosibles.map((e) => ({ id: e, label: ESTADO_OPTS_LABEL[e] }))}
              value={estadoValido}
              onValueChange={(v) => setEstado((v || estadoValido) as ChequeEstado)}
              hint="Se puede corregir a mano: si se anuló por error, volvé a ponerlo donde estaba."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

            <FieldBlock label="CUIT del librador" icon={Fingerprint}>
              <FieldInput
                icon={Fingerprint}
                placeholder="30-12345678-9"
                value={libradorCuit}
                onChange={(e) => setLibradorCuit(e.target.value)}
              />
            </FieldBlock>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <FieldBlock label={origen === "propio" ? "Fecha de pago *" : "Fecha de cobro *"} icon={Calendar}>
              <FieldInput
                icon={Calendar}
                type="date"
                required
                value={fechaVencimiento}
                onChange={(e) => setFechaVencimiento(e.target.value)}
              />
            </FieldBlock>
            <FieldBlock label="Observaciones" icon={MessageSquare}>
              <FieldInput
                icon={MessageSquare}
                placeholder="Notas internas (opcional)"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
              />
            </FieldBlock>
          </div>

          {/* Datos bancarios — opcionales */}
          <details className="rounded-lg border border-border bg-muted/20 px-3 py-2">
            <summary className="cursor-pointer text-xs font-semibold text-muted-foreground select-none py-2.5 sm:py-0">
              Datos del banco (opcional)
            </summary>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              <FieldBlock label="Número de cheque" icon={Hash}>
                <FieldInput
                  icon={Hash}
                  placeholder="Nº impreso en el cheque"
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                />
              </FieldBlock>
              <BancoField bancos={bancos} value={bancoNombre} onValueChange={setBancoNombre} />
              <FieldBlock label="Sucursal" icon={Home}>
                <FieldInput icon={Home} placeholder="Ej: 045 - Centro" value={sucursal} onChange={(e) => setSucursal(e.target.value)} />
              </FieldBlock>
              <FieldBlock label="Cuenta corriente" icon={FileText}>
                <FieldInput icon={FileText} placeholder="Nº de cuenta" value={cuentaCorriente} onChange={(e) => setCuentaCorriente(e.target.value)} />
              </FieldBlock>
            </div>
          </details>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 pt-4 mt-6 border-t border-border -mx-4 px-4 sm:-mx-6 sm:px-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto h-10 px-6 rounded-lg text-sm font-semibold border border-border text-muted-foreground hover:bg-muted/40 transition-colors"
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto bg-[#0088D1] hover:bg-[#0277BD] text-white flex items-center justify-center gap-1.5 h-10 px-6 rounded-lg font-bold shadow-sm hover:shadow transition-all disabled:opacity-50"
            >
              {loading ? "Guardando..." : (<><Check size={16} strokeWidth={2.5} /> Guardar cambios</>)}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
