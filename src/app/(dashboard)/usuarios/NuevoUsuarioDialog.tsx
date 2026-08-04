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
import { Plus, Copy, Check } from "lucide-react";
import { crearUsuarioAction, type CredencialesNuevoUsuario } from "./actions";
import { rolLabel } from "./area-meta";

type Rol = { id: string; codigo: string; nombre: string };

/** Texto listo para pegar en un WhatsApp o un mail. */
function textoCredenciales(c: CredencialesNuevoUsuario): string {
  const url = typeof window !== "undefined" ? window.location.origin : "";
  return [
    `Acceso al sistema Don Joaquin${url ? ` — ${url}` : ""}`,
    `Usuario: ${rolLabel(c.rol)}`,
    `Email: ${c.email}`,
    `Contraseña: ${c.password}`,
    "En el primer ingreso te va a pedir cambiar la contraseña.",
  ].join("\n");
}

export default function NuevoUsuarioDialog({ roles }: { roles: Rol[] }) {
  const router = useRouter();
  // El rol Administrador no se asigna desde la UI: solo a mano en la base de datos.
  const rolesDisponibles = roles.filter((r) => r.codigo !== "admin");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creado, setCreado] = useState<CredencialesNuevoUsuario | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

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
    setCreado(null);
    setCopiado(null);
  };

  const copiar = (texto: string, clave: string) => {
    navigator.clipboard.writeText(texto);
    setCopiado(clave);
    setTimeout(() => setCopiado((c) => (c === clave ? null : c)), 1500);
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
      // No se cierra: primero se muestran los datos para pasárselos al usuario.
      setCreado(res.credenciales);
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
          {creado ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-foreground text-lg sm:text-xl">Usuario creado</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Pasale estos datos por el canal que uses. La contraseña no se vuelve a mostrar:
                  después solo se puede generar un link para que la cambie.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2 py-1">
                {[
                  { clave: "rol", label: "Tipo de usuario", valor: rolLabel(creado.rol) },
                  { clave: "email", label: "Email", valor: creado.email },
                  { clave: "password", label: "Contraseña", valor: creado.password },
                ].map((f) => (
                  <div
                    key={f.clave}
                    className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {f.label}
                      </p>
                      <p className="truncate text-sm font-medium text-foreground">{f.valor}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => copiar(f.valor, f.clave)}
                      title={`Copiar ${f.label.toLowerCase()}`}
                      className="shrink-0 rounded p-1.5 max-md:p-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      {copiado === f.clave ? <Check size={15} /> : <Copy size={15} />}
                    </button>
                  </div>
                ))}
              </div>

              <DialogFooter className="pt-3 border-t border-[#F1F5F9] gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    reset();
                    setOpen(false);
                  }}
                  className="text-muted-foreground border-border"
                >
                  Listo
                </Button>
                <Button
                  type="button"
                  variant="brand"
                  onClick={() => copiar(textoCredenciales(creado), "todo")}
                >
                  {copiado === "todo" ? <Check size={15} /> : <Copy size={15} />}
                  {copiado === "todo" ? "Copiado" : "Copiar todo"}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="text-foreground text-lg sm:text-xl">Nuevo usuario</DialogTitle>
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
