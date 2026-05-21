"use client";

import { useState } from "react";
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
  User,
  Fingerprint,
  Phone,
  MapPin,
  Calendar,
  ChevronDown,
  Check,
} from "lucide-react";
import { addChoferAction } from "../actions";

const ESTADOS = [
  { value: "activo", label: "Activo" },
  { value: "inactivo", label: "Inactivo" },
];

export default function AddChoferDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [dni, setDni] = useState("");
  const [estado, setEstado] = useState<"activo" | "inactivo">("activo");
  const [telefono, setTelefono] = useState("");
  const [localidad, setLocalidad] = useState("");
  const [fechaIngreso, setFechaIngreso] = useState(new Date().toISOString().split("T")[0]);

  const reset = () => {
    setNombre("");
    setApellido("");
    setDni("");
    setEstado("activo");
    setTelefono("");
    setLocalidad("");
    setFechaIngreso(new Date().toISOString().split("T")[0]);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await addChoferAction({
        nombre,
        apellido,
        dni,
        estado,
        telefono,
        localidad,
        fecha_ingreso: fechaIngreso,
      });

      if (result.error) {
        setError(result.error);
      } else {
        setOpen(false);
        reset();
      }
    } catch {
      setError("Ocurrió un error inesperado.");
    } finally {
      setLoading(false);
    }
  };

  const getEstadoDotColor = (val: string) => {
    return val === "activo" ? "bg-[#10B981]" : "bg-[#94A3B8]";
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger render={children as React.ReactElement} />
      <DialogContent className="sm:max-w-[500px] p-6 gap-0">
        {/* Header */}
        <DialogHeader className="border-b border-border pb-4 -mx-6 px-6 pt-1">
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center size-12 rounded-full bg-[#E1F5FE] text-primary shrink-0">
              <User size={22} />
            </div>
            <div>
              <DialogTitle className="text-foreground text-lg font-bold">
                Agregar nuevo chofer
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs font-medium mt-0.5">
                Ingresá los datos personales y de contacto del chofer.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg font-medium">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* Nombre */}
            <InputFieldWithIcon
              label="Nombre *"
              name="nombre"
              placeholder="Ej: Juan"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              icon={User}
            />

            {/* Apellido */}
            <InputFieldWithIcon
              label="Apellido *"
              name="apellido"
              placeholder="Ej: Pérez"
              required
              value={apellido}
              onChange={(e) => setApellido(e.target.value)}
              icon={User}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* DNI */}
            <InputFieldWithIcon
              label="DNI *"
              name="dni"
              placeholder="Ej: 12345678"
              required
              value={dni}
              onChange={(e) => setDni(e.target.value)}
              icon={Fingerprint}
            />

            {/* Estado */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">Estado *</Label>
              <div className="relative flex items-center h-10 w-full rounded-lg border border-border bg-card overflow-hidden focus-within:ring-2 focus-within:ring-[#0088D1]/20 focus-within:border-[#0088D1] transition-all">
                <div className="flex items-center justify-center w-10 h-full border-r border-border bg-muted/40/50 shrink-0">
                  <span className={`size-2.5 rounded-full ${getEstadoDotColor(estado)}`} />
                </div>
                <div className="relative flex-1 h-full">
                  <select
                    name="estado"
                    value={estado}
                    className="w-full h-full px-3 pr-10 text-sm bg-transparent border-0 outline-none focus:outline-none focus:ring-0 text-foreground appearance-none cursor-pointer font-medium"
                    onChange={(e) => setEstado(e.target.value as "activo" | "inactivo")}
                  >
                    {ESTADOS.map((e) => (
                      <option key={e.value} value={e.value}>
                        {e.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={14}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 pointer-events-none"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Telefono */}
            <InputFieldWithIcon
              label="Teléfono"
              name="telefono"
              placeholder="Ej: +54 9 11 ..."
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              icon={Phone}
            />

            {/* Localidad */}
            <InputFieldWithIcon
              label="Localidad"
              name="localidad"
              placeholder="Ej: Arrecifes"
              value={localidad}
              onChange={(e) => setLocalidad(e.target.value)}
              icon={MapPin}
            />
          </div>

          {/* Fecha de ingreso */}
          <InputFieldWithIcon
            label="Fecha de ingreso *"
            name="fecha_ingreso"
            type="date"
            required
            value={fechaIngreso}
            onChange={(e) => setFechaIngreso(e.target.value)}
            icon={Calendar}
          />

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-4 mt-6 border-t border-slate-100 -mx-6 px-6">
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
              {loading ? (
                "Guardando..."
              ) : (
                <>
                  <Check size={16} strokeWidth={2.5} /> Guardar chofer
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Subcomponente Input con Icono incorporado
function InputFieldWithIcon({
  label,
  name,
  id,
  type = "text",
  placeholder,
  required,
  value,
  onChange,
  error,
  icon: Icon,
}: {
  label: string;
  name: string;
  id?: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  icon: React.ComponentType<any>;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs font-semibold text-muted-foreground">{label}</Label>
      <div className={`relative flex items-center h-10 w-full rounded-lg border bg-card overflow-hidden focus-within:ring-2 transition-all ${
        error ? "border-red-300 focus-within:ring-red-100 focus-within:border-red-500" : "border-border focus-within:ring-[#0088D1]/20 focus-within:border-[#0088D1]"
      }`}>
        <div className="flex items-center justify-center w-10 h-full border-r border-border bg-muted/40/50 text-primary shrink-0">
          <Icon size={15} />
        </div>
        <input
          id={id}
          name={name}
          type={type}
          placeholder={placeholder}
          required={required}
          value={value}
          onChange={onChange}
          className="flex-1 h-full px-3 text-sm bg-transparent border-0 outline-none focus:outline-none focus:ring-0 text-foreground"
        />
      </div>
    </div>
  );
}
