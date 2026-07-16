"use client";

import { useEffect, useState } from "react";
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
import { editarUsuarioAction } from "./actions";

type Editable = { id: string; nombre: string | null; apellido: string | null; email: string };

export default function EditarUsuarioDialog({
  usuario,
  open,
  onOpenChange,
  onDone,
}: {
  usuario: Editable | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [email, setEmail] = useState("");

  // Precargar los valores del usuario al abrir.
  useEffect(() => {
    if (usuario) {
      setNombre(usuario.nombre ?? "");
      setApellido(usuario.apellido ?? "");
      setEmail(usuario.email);
      setError(null);
    }
  }, [usuario]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuario) return;
    setLoading(true);
    setError(null);
    const res = await editarUsuarioAction(usuario.id, { nombre, apellido, email });
    setLoading(false);
    if ("error" in res) {
      setError(res.error);
    } else {
      onOpenChange(false);
      onDone();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="text-foreground text-xl">Editar usuario</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Cambiá el nombre o el email de acceso. Si cambiás el email, es el que va a usar para iniciar sesión.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">
                Nombre <span className="text-red-400">*</span>
              </Label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">Apellido</Label>
              <Input value={apellido} onChange={(e) => setApellido(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-foreground">
              Email <span className="text-red-400">*</span>
            </Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@donjoaquin.com"
            />
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
