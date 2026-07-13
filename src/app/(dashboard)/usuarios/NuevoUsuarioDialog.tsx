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
import { Combobox } from "@/components/ui/combobox";
import { Plus } from "lucide-react";
import { crearUsuarioAction } from "./actions";
import { rolLabel } from "./area-meta";

type Rol = { id: string; codigo: string; nombre: string };

export default function NuevoUsuarioDialog({ roles }: { roles: Rol[] }) {
  const router = useRouter();
  // El rol Administrador no se asigna desde la UI: solo a mano en la base de datos.
  const rolesDisponibles = roles.filter((r) => r.codigo !== "admin");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rolId, setRolId] = useState(rolesDisponibles[0]?.id ?? "");

  const reset = () => {
    setNombre("");
    setApellido("");
    setEmail("");
    setPassword("");
    setRolId(rolesDisponibles[0]?.id ?? "");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.set("nombre", nombre);
    formData.set("apellido", apellido);
    formData.set("email", email);
    formData.set("password", password);
    formData.set("rol_id", rolId);

    const res = await crearUsuarioAction(formData);
    setLoading(false);

    if ("error" in res) {
      setError(res.error);
    } else {
      reset();
      setOpen(false);
      router.refresh();
    }
  };

  return (
    <>
      <Button variant="brand" size="sm" onClick={() => setOpen(true)}>
        <Plus size={14} />
        Nuevo usuario
      </Button>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v) reset();
          setOpen(v);
        }}
      >
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-foreground text-xl">Nuevo usuario</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Crea un acceso administrativo. El usuario deberá cambiar la contraseña en su primer ingreso.
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

            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">
                Contraseña inicial <span className="text-red-400">*</span>
              </Label>
              <Input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">
                Rol <span className="text-red-400">*</span>
              </Label>
              <Combobox
                value={rolId}
                onValueChange={setRolId}
                options={rolesDisponibles.map((r) => ({ id: r.id, label: rolLabel(r.nombre) }))}
                searchable={false}
                triggerClassName="h-10 w-full"
              />
            </div>

            <DialogFooter className="pt-3 border-t border-[#F1F5F9] gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  reset();
                  setOpen(false);
                }}
                disabled={loading}
                className="text-muted-foreground border-border"
              >
                Cancelar
              </Button>
              <Button type="submit" variant="brand" disabled={loading}>
                {loading ? "Creando..." : "Crear usuario"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
