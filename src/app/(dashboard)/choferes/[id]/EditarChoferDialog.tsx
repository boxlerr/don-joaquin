"use client";

import { useState } from "react";
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
import { updateChoferInfoAction } from "./actions";
import type { ChoferDetail } from "./types";

interface Props {
  chofer: ChoferDetail;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}

export default function EditarChoferDialog({ chofer, open, onOpenChange, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nombre, setNombre] = useState(chofer.nombre);
  const [apellido, setApellido] = useState(chofer.apellido);
  const [email, setEmail] = useState(chofer.email ?? "");
  const [telefono, setTelefono] = useState(chofer.telefono ?? "");
  const [telefonoEmergencia, setTelefonoEmergencia] = useState(chofer.telefono_emergencia ?? "");
  const [domicilio, setDomicilio] = useState(chofer.domicilio ?? "");
  const [cbu, setCbu] = useState(chofer.cbu ?? "");
  const [aliasCbu, setAliasCbu] = useState(chofer.alias_cbu ?? "");
  const [banco, setBanco] = useState(chofer.banco ?? "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await updateChoferInfoAction(chofer.id, {
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      email: email.trim() || undefined,
      telefono: telefono.trim() || undefined,
      telefono_emergencia: telefonoEmergencia.trim() || undefined,
      domicilio: domicilio.trim() || undefined,
      cbu: cbu.trim() || undefined,
      alias_cbu: aliasCbu.trim() || undefined,
      banco: banco.trim() || undefined,
    });

    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else {
      onSuccess();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="text-foreground text-xl">Editar datos del chofer</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Actualizá la información de contacto y bancaria.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Nombre" required>
              <Input required value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </Field>
            <Field label="Apellido" required>
              <Input required value={apellido} onChange={(e) => setApellido(e.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Email">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Teléfono">
              <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Tel. emergencia">
              <Input
                value={telefonoEmergencia}
                onChange={(e) => setTelefonoEmergencia(e.target.value)}
              />
            </Field>
            <Field label="Domicilio">
              <Input value={domicilio} onChange={(e) => setDomicilio(e.target.value)} />
            </Field>
          </div>

          <div className="pt-2 border-t border-[#F1F5F9]">
            <p className="text-xs text-muted-foreground/70 mb-3">Datos bancarios</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Banco">
                <Input value={banco} onChange={(e) => setBanco(e.target.value)} />
              </Field>
              <Field label="Alias CBU">
                <Input value={aliasCbu} onChange={(e) => setAliasCbu(e.target.value)} />
              </Field>
            </div>
            <div className="mt-3">
              <Field label="CBU">
                <Input
                  value={cbu}
                  onChange={(e) => setCbu(e.target.value)}
                  className="font-mono"
                  maxLength={22}
                />
              </Field>
            </div>
          </div>

          <DialogFooter className="pt-3 border-t border-[#F1F5F9] gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="text-muted-foreground border-border"
            >
              Cancelar
            </Button>
            <Button type="submit" variant="brand" disabled={loading}>
              {loading ? "Guardando..." : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-[#1E293B]">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}
