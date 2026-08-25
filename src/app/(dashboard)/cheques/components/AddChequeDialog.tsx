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
import { SelectField } from "@/components/ui/combobox";
import {
  Landmark, DollarSign, Fingerprint, Calendar, MessageSquare, Check,
  Sliders, Home, FileText, User,
} from "lucide-react";
import { createChequeAction } from "../actions";
import type { ChequeOrigen, ChequeTipo } from "../transiciones";
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

export type { LibradorOption };

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

  const [origen, setOrigen] = useState<ChequeOrigen>("recibido");
  const [tipo, setTipo] = useState<ChequeTipo>("electronico"); // echeq preseleccionado
  const [libradorNombre, setLibradorNombre] = useState("");
  const [libradorCuit, setLibradorCuit] = useState("");
  const [entregadoA, setEntregadoA] = useState("");
  const [numero, setNumero] = useState("");
  const [fechaEmision, setFechaEmision] = useState("");
  const [importe, setImporte] = useState("");
  const [fechaVencimiento, setFechaVencimiento] = useState(today);
  const [bancoNombre, setBancoNombre] = useState("");
  const [sucursal, setSucursal] = useState("");
  const [cuentaCorriente, setCuentaCorriente] = useState("");
  const [observaciones, setObservaciones] = useState("");

  const esPropio = origen === "propio";

  const resetForm = () => {
    setOrigen("recibido");
    setTipo("electronico");
    setLibradorNombre("");
    setLibradorCuit("");
    setEntregadoA("");
    setNumero("");
    setFechaEmision("");
    setImporte("");
    setFechaVencimiento(today);
    setBancoNombre("");
    setSucursal("");
    setCuentaCorriente("");
    setObservaciones("");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importe || isNaN(Number(importe))) return;
    setLoading(true);
    setError(null);
    try {
      const res = await createChequeAction({
        origen,
        entregado_a: esPropio ? entregadoA || null : null,
        tipo,
        librador_nombre: libradorNombre,
        librador_cuit: libradorCuit || null,
        numero: numero.trim() || null,
        fecha_emision: fechaEmision || null,
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
        setOpen(false);
        resetForm();
        router.refresh();
      }
    } catch (e) {
      setError(describirError(e, "No se pudo registrar el cheque."));
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
      {/* p-4 en celular (y los -mx tienen que seguirlo o el borde queda corrido). */}
      <DialogContent className="sm:max-w-[880px] p-4 sm:p-6 gap-0">
        <DialogHeader className="border-b border-border pb-4 -mx-4 px-4 sm:-mx-6 sm:px-6 pt-1">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="flex items-center justify-center size-10 sm:size-12 rounded-full bg-[#E1F5FE] text-primary shrink-0">
              <Landmark size={22} />
            </div>
            <div className="min-w-0 pr-8">
              <DialogTitle className="text-foreground text-lg font-bold">Registrar Cheque</DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs font-medium mt-0.5">
                {esPropio
                  ? "Cheque nuestro. Queda como emitido, aparte de la cartera."
                  : "Diferido. Quedará en cartera. Lo importante: importe, librador y vencimiento."}
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

          {/* De quién es el cheque: define todo lo demás */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <OrigenField value={origen} onValueChange={setOrigen} />
            <SelectField
              label="Tipo de cheque *"
              icon={Sliders}
              options={TIPO_OPTS}
              value={tipo}
              onValueChange={(v) => setTipo((v || "electronico") as ChequeTipo)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <LibradorField
              libradores={libradores}
              nombre={libradorNombre}
              onNombreChange={setLibradorNombre}
              onCuitChange={setLibradorCuit}
              label={esPropio ? "Librador (nuestra firma) *" : "Librador *"}
              hint={
                esPropio
                  ? "La razón social con la que se emitió el cheque."
                  : "Si no está en la lista, escribilo: queda guardado para la próxima."
              }
            />

            <FieldBlock label="CUIT del librador" icon={Fingerprint}>
              <FieldInput
                icon={Fingerprint}
                placeholder="30-12345678-9"
                value={libradorCuit}
                onChange={(e) => setLibradorCuit(e.target.value)}
              />
            </FieldBlock>

            {esPropio ? (
              <FieldBlock label="Entregado a" icon={User}>
                <FieldInput
                  icon={User}
                  placeholder="Nombre o razón social"
                  value={entregadoA}
                  onChange={(e) => setEntregadoA(e.target.value)}
                />
              </FieldBlock>
            ) : (
              <FieldBlock label="Observaciones" icon={MessageSquare}>
                <FieldInput
                  icon={MessageSquare}
                  placeholder="Notas internas (opcional)"
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                />
              </FieldBlock>
            )}
          </div>

          {/* Número y emisión: el alta no los mandaba y todos los cheques de
              producción quedaron con los dos campos en null. */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FieldBlock label="Número de cheque" icon={FileText}>
              <FieldInput
                icon={FileText}
                placeholder="Ej: 00012345"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
              />
            </FieldBlock>
            <FieldBlock label="Fecha de emisión" icon={Calendar}>
              <FieldInput
                icon={Calendar}
                type="date"
                value={fechaEmision}
                onChange={(e) => setFechaEmision(e.target.value)}
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
            <FieldBlock label="Fecha de vencimiento *" icon={Calendar}>
              <FieldInput
                icon={Calendar}
                type="date"
                required
                value={fechaVencimiento}
                onChange={(e) => setFechaVencimiento(e.target.value)}
              />
            </FieldBlock>
            {esPropio && (
              <FieldBlock label="Observaciones" icon={MessageSquare}>
                <FieldInput
                  icon={MessageSquare}
                  placeholder="Notas internas (opcional)"
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                />
              </FieldBlock>
            )}
          </div>

          {/* Datos bancarios — opcionales */}
          <details className="rounded-lg border border-border bg-muted/20 px-3 py-2">
            <summary className="cursor-pointer text-xs font-semibold text-muted-foreground select-none py-2.5 sm:py-0">
              Datos del banco (opcional)
            </summary>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
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
              onClick={() => setOpen(false)}
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
              {loading ? "Registrando..." : (<><Check size={16} strokeWidth={2.5} /> Confirmar cheque</>)}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
