"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  entregarChequeAction,
  depositarChequeAction,
  acreditarChequeAction,
  rechazarChequeAction,
  anularChequeAction,
  type ChequeMotivoRechazo,
} from "../actions";

export type Transicion = "entregar" | "depositar" | "acreditar" | "rechazar" | "anular";

const MOTIVOS_RECHAZO: Record<ChequeMotivoRechazo, string> = {
  sin_fondos: "Sin fondos suficientes",
  firma_no_corresponde: "Firma no corresponde",
  cuenta_cerrada: "Cuenta cerrada",
  formal: "Defecto formal",
  otro: "Otro",
};

const TITULOS: Record<Transicion, { titulo: string; descripcion: string; cta: string }> = {
  entregar: {
    titulo: "Entregar cheque",
    descripcion: "Registrá la entrega del cheque a un tercero.",
    cta: "Confirmar entrega",
  },
  depositar: {
    titulo: "Depositar cheque",
    descripcion: "Registrá el depósito del cheque en un banco.",
    cta: "Confirmar depósito",
  },
  acreditar: {
    titulo: "Acreditar cheque",
    descripcion: "Confirmá la acreditación efectiva del cheque en cuenta.",
    cta: "Confirmar acreditación",
  },
  rechazar: {
    titulo: "Rechazar cheque",
    descripcion: "Registrá el rechazo del cheque por parte del banco.",
    cta: "Confirmar rechazo",
  },
  anular: {
    titulo: "Anular cheque",
    descripcion: "Marcá el cheque como anulado. Esta acción no se revierte.",
    cta: "Confirmar anulación",
  },
};

export default function ChequeTransitionDialog({
  chequeId,
  numero,
  transicion,
  open,
  onOpenChange,
}: {
  chequeId: string;
  numero: string;
  transicion: Transicion;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const today = new Date().toISOString().split("T")[0];

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fecha, setFecha] = useState(today);
  const [observaciones, setObservaciones] = useState("");
  const [entregadoA, setEntregadoA] = useState("");
  const [bancoDeposito, setBancoDeposito] = useState("");
  const [motivoRechazo, setMotivoRechazo] = useState<ChequeMotivoRechazo>("sin_fondos");
  const [motivoDetalle, setMotivoDetalle] = useState("");
  const [motivoAnulacion, setMotivoAnulacion] = useState("");

  const meta = TITULOS[transicion];

  const reset = () => {
    setFecha(today);
    setObservaciones("");
    setEntregadoA("");
    setBancoDeposito("");
    setMotivoRechazo("sin_fondos");
    setMotivoDetalle("");
    setMotivoAnulacion("");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      let res: { error?: string; success?: boolean } = {};
      if (transicion === "entregar") {
        res = await entregarChequeAction({
          id: chequeId,
          entregado_a: entregadoA,
          fecha_entrega: fecha,
          observaciones: observaciones || null,
        });
      } else if (transicion === "depositar") {
        res = await depositarChequeAction({
          id: chequeId,
          banco_deposito: bancoDeposito,
          fecha_deposito: fecha,
          observaciones: observaciones || null,
        });
      } else if (transicion === "acreditar") {
        res = await acreditarChequeAction({
          id: chequeId,
          fecha,
          observaciones: observaciones || null,
        });
      } else if (transicion === "rechazar") {
        res = await rechazarChequeAction({
          id: chequeId,
          motivo: motivoRechazo,
          motivo_detalle: motivoDetalle || null,
          fecha,
          observaciones: observaciones || null,
        });
      } else if (transicion === "anular") {
        res = await anularChequeAction({
          id: chequeId,
          motivo: motivoAnulacion,
          fecha,
          observaciones: observaciones || null,
        });
      }
      if (res.error) {
        setError(res.error);
      } else {
        onOpenChange(false);
        reset();
        router.refresh();
      }
    } catch {
      setError("Ocurrió un error inesperado.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-foreground text-xl">
            {meta.titulo}{" "}
            <span className="text-sm font-normal text-muted-foreground/70 font-mono">#{numero}</span>
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">{meta.descripcion}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
              {error}
            </div>
          )}

          {transicion === "entregar" && (
            <div className="space-y-2">
              <Label htmlFor="tr-entregado-a" className="text-sm font-medium text-[#1E293B]">
                Entregado a <span className="text-red-500">*</span>
              </Label>
              <Input
                id="tr-entregado-a"
                placeholder="Nombre o razón social"
                required
                value={entregadoA}
                onChange={(e) => setEntregadoA(e.target.value)}
              />
            </div>
          )}

          {transicion === "depositar" && (
            <div className="space-y-2">
              <Label htmlFor="tr-banco-dep" className="text-sm font-medium text-[#1E293B]">
                Banco de depósito <span className="text-red-500">*</span>
              </Label>
              <Input
                id="tr-banco-dep"
                placeholder="Ej: Galicia - Cta. Cte. 1234"
                required
                value={bancoDeposito}
                onChange={(e) => setBancoDeposito(e.target.value)}
              />
            </div>
          )}

          {transicion === "rechazar" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="tr-motivo" className="text-sm font-medium text-[#1E293B]">
                  Motivo del rechazo <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={motivoRechazo}
                  onValueChange={(v) => setMotivoRechazo(v as ChequeMotivoRechazo)}
                >
                  <SelectTrigger id="tr-motivo" className="w-full">
                    <SelectValue placeholder="Seleccionar motivo">
                      {(value: unknown) =>
                        MOTIVOS_RECHAZO[value as ChequeMotivoRechazo] ?? null
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(MOTIVOS_RECHAZO) as ChequeMotivoRechazo[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {MOTIVOS_RECHAZO[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tr-motivo-detalle" className="text-sm font-medium text-[#1E293B]">
                  Detalle (opcional)
                </Label>
                <Input
                  id="tr-motivo-detalle"
                  placeholder="Información adicional del rechazo"
                  value={motivoDetalle}
                  onChange={(e) => setMotivoDetalle(e.target.value)}
                />
              </div>
            </>
          )}

          {transicion === "anular" && (
            <div className="space-y-2">
              <Label htmlFor="tr-motivo-anul" className="text-sm font-medium text-[#1E293B]">
                Motivo de anulación <span className="text-red-500">*</span>
              </Label>
              <Input
                id="tr-motivo-anul"
                placeholder="Ej: Error en el importe"
                required
                value={motivoAnulacion}
                onChange={(e) => setMotivoAnulacion(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="tr-fecha" className="text-sm font-medium text-[#1E293B]">
              Fecha <span className="text-red-500">*</span>
            </Label>
            <Input
              id="tr-fecha"
              type="date"
              required
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tr-obs" className="text-sm font-medium text-[#1E293B]">
              Observaciones
            </Label>
            <Input
              id="tr-obs"
              placeholder="Notas internas (opcional)"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
            />
          </div>

          <DialogFooter className="pt-2 sm:justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant={transicion === "anular" || transicion === "rechazar" ? "destructive" : "brand"}
              disabled={loading}
            >
              {loading ? "Guardando..." : meta.cta}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
