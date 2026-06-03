"use client";

import { useRef, useState } from "react";
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
import { Camera, Loader2, Trash2 } from "lucide-react";
import { updateChoferInfoAction } from "./actions";
import {
  uploadFotoChoferAction,
  deleteFotoChoferAction,
} from "../actions";
import { createClient } from "@/lib/supabase/client";
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
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [fotoError, setFotoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();
  const fotoUrl = chofer.foto
    ? supabase.storage.from(chofer.foto.bucket).getPublicUrl(chofer.foto.path).data.publicUrl
    : null;
  const initials = `${chofer.nombre[0] ?? ""}${chofer.apellido[0] ?? ""}`.toUpperCase();

  const [nombre, setNombre] = useState(chofer.nombre);
  const [apellido, setApellido] = useState(chofer.apellido);
  const [telefono, setTelefono] = useState(chofer.telefono ?? "");
  const [telefonoEmergencia, setTelefonoEmergencia] = useState(chofer.telefono_emergencia ?? "");
  const [domicilio, setDomicilio] = useState(chofer.domicilio ?? "");
  const [cbu, setCbu] = useState(chofer.cbu ?? "");
  const [aliasCbu, setAliasCbu] = useState(chofer.alias_cbu ?? "");
  const [banco, setBanco] = useState(chofer.banco ?? "");

  const handleFotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setFotoError("Solo se permiten imágenes (JPG, PNG, WEBP, GIF, HEIC).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFotoError(`La imagen pesa ${(file.size / 1024 / 1024).toFixed(2)} MB. Máximo 5 MB.`);
      return;
    }

    setUploadingFoto(true);
    setFotoError(null);
    try {
      const formData = new FormData();
      formData.set("chofer_id", chofer.id);
      formData.set("file", file);
      const res = await uploadFotoChoferAction(formData);
      if (res.error) setFotoError(res.error);
      else onSuccess();
    } catch (err) {
      console.error(err);
      setFotoError("No se pudo subir la foto. Probá con otra imagen o formato.");
    } finally {
      setUploadingFoto(false);
    }
  };

  const handleFotoDelete = async () => {
    setUploadingFoto(true);
    setFotoError(null);
    try {
      const res = await deleteFotoChoferAction(chofer.id);
      if (res.error) setFotoError(res.error);
      else onSuccess();
    } finally {
      setUploadingFoto(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await updateChoferInfoAction(chofer.id, {
      nombre: nombre.trim(),
      apellido: apellido.trim(),
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

          <div className="flex items-center gap-4 pb-4 border-b border-[#F1F5F9]">
            <div className="relative group/avatar flex-shrink-0">
              <div
                className="w-16 h-16 rounded-full bg-[#E1F5FE] border-2 border-[#B3E5FC] flex items-center justify-center cursor-pointer overflow-hidden shadow-inner relative"
                onClick={() => fileInputRef.current?.click()}
                title={fotoUrl ? "Hacer clic para cambiar la foto" : "Hacer clic para subir una foto"}
              >
                {fotoUrl ? (
                  <img src={fotoUrl} alt={`${chofer.nombre} ${chofer.apellido}`} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-primary text-xl font-bold">{initials}</span>
                )}
                <div className="absolute inset-0 bg-black/55 flex flex-col items-center justify-center gap-0.5 opacity-0 group-hover/avatar:opacity-100 transition-opacity">
                  <Camera size={16} className="text-white" />
                  <span className="text-[9px] font-medium text-white tracking-wider uppercase">
                    {fotoUrl ? "Cambiar" : "Subir"}
                  </span>
                </div>
                {uploadingFoto && (
                  <div className="absolute inset-0 bg-card/80 flex items-center justify-center z-10">
                    <Loader2 size={20} className="animate-spin text-primary" />
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFotoChange}
                />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <Label className="text-sm font-medium text-foreground">Foto de perfil</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                JPG, PNG, WEBP o HEIC. Máximo 5 MB.
              </p>
              {fotoError && (
                <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">{fotoError}</p>
              )}
              {fotoUrl && !uploadingFoto && (
                <button
                  type="button"
                  onClick={handleFotoDelete}
                  className="mt-2 inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700 hover:underline"
                >
                  <Trash2 size={12} />
                  Eliminar foto
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Nombre" required>
              <Input required value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </Field>
            <Field label="Apellido" required>
              <Input required value={apellido} onChange={(e) => setApellido(e.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
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
      <Label className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}
