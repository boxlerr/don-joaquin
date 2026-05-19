"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import InlineFeedback from "@/components/ui/InlineFeedback";

export type SiniestroEditing = {
  id: string;
  camion_id: string;
  chofer_id: string | null;
  fecha: string;
  descripcion: string;
  monto_danos?: number | null;
  compania_seguro?: string | null;
  numero_siniestro_seguro?: string | null;
  terceros_involucrados?: string | null;
};

type FieldErrors = {
  camionId?: string;
  fecha?: string;
  descripcion?: string;
  montoDanos?: string;
};

export default function AddSiniestroDialog({
  children,
  camiones,
  choferes,
  defaultCamionId,
  editing,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  onSavedLocal,
}: {
  children?: React.ReactNode;
  camiones: { id: string; patente: string; marca: string; modelo: string }[];
  choferes: { id: string; nombre: string; apellido: string | null }[];
  defaultCamionId?: string;
  editing?: SiniestroEditing | null;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  onSavedLocal?: (data: {
    camion_id: string;
    chofer_id: string | null;
    fecha: string;
    descripcion: string;
    monto_danos: number | null;
    compania_seguro: string;
    numero_siniestro_seguro: string;
    terceros_involucrados: string;
  }) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [camionId, setCamionId] = useState(defaultCamionId ?? "");
  const [choferId, setChoferId] = useState<string>("none");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [descripcion, setDescripcion] = useState("");
  const [montoDanos, setMontoDanos] = useState("");
  const [companiaSeguro, setCompaniaSeguro] = useState("");
  const [numeroSiniestroSeguro, setNumeroSiniestroSeguro] = useState("");
  const [tercerosInvolucrados, setTercerosInvolucrados] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setCamionId(editing.camion_id);
      setChoferId(editing.chofer_id ?? "none");
      setFecha(editing.fecha);
      setDescripcion(editing.descripcion);
      setMontoDanos(editing.monto_danos != null ? String(editing.monto_danos) : "");
      setCompaniaSeguro(editing.compania_seguro ?? "");
      setNumeroSiniestroSeguro(editing.numero_siniestro_seguro ?? "");
      setTercerosInvolucrados(editing.terceros_involucrados ?? "");
    } else {
      setCamionId(defaultCamionId ?? "");
      setChoferId("none");
      setFecha(new Date().toISOString().split("T")[0]);
      setDescripcion("");
      setMontoDanos("");
      setCompaniaSeguro("");
      setNumeroSiniestroSeguro("");
      setTercerosInvolucrados("");
    }
    setError(null);
    setSuccess(null);
    setErrors({});
  }, [open, editing, defaultCamionId]);

  const validate = (): FieldErrors => {
    const e: FieldErrors = {};
    if (!camionId) e.camionId = "Seleccioná un camión";
    if (!fecha) e.fecha = "Fecha requerida";
    if (!descripcion.trim()) e.descripcion = "Descripción requerida";
    if (montoDanos) {
      const m = parseFloat(montoDanos);
      if (!Number.isFinite(m) || m < 0) e.montoDanos = "Monto inválido (debe ser ≥ 0)";
    }
    return e;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        camion_id: camionId,
        chofer_id: choferId === "none" ? null : choferId,
        fecha,
        descripcion: descripcion.trim(),
        monto_danos: montoDanos ? parseFloat(montoDanos) : null,
        compania_seguro: companiaSeguro.trim(),
        numero_siniestro_seguro: numeroSiniestroSeguro.trim(),
        terceros_involucrados: tercerosInvolucrados.trim(),
      };

      if (onSavedLocal) {
        onSavedLocal(payload);
        setSuccess(editing ? "Siniestro actualizado" : "Siniestro registrado");
        setTimeout(() => setOpen(false), 800);
      } else {
        setError("Error de configuración del formulario.");
      }
    } catch {
      setError("Ocurrió un error inesperado.");
    } finally {
      setLoading(false);
    }
  };

  const errClass = (key: keyof FieldErrors) => (errors[key] ? "border-red-300 focus-visible:ring-red-300" : "");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children && <DialogTrigger render={children as React.ReactElement} />}
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="text-[#0F172A] text-xl">
            {editing ? "Editar siniestro" : "Registrar siniestro"}
          </DialogTitle>
          <DialogDescription className="text-[#475569]">
            {editing ? "Actualizá los datos del siniestro registrado." : "Ingresá los datos del siniestro para registrarlo en el sistema."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {error && <InlineFeedback variant="error" message={error} onDismiss={() => setError(null)} autoHideMs={0} />}
          {success && <InlineFeedback variant="success" message={success} onDismiss={() => setSuccess(null)} />}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="camion" className="text-sm font-medium text-[#1E293B]">Camión</Label>
              <Select value={camionId} onValueChange={(v) => setCamionId(v ?? "")}>
                <SelectTrigger id="camion" className={`w-full ${errClass("camionId")}`}>
                  <SelectValue placeholder="Seleccionar camión..." />
                </SelectTrigger>
                <SelectContent>
                  {camiones.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.patente} - {c.marca} {c.modelo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.camionId && <p className="text-xs text-red-600">{errors.camionId}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="chofer" className="text-sm font-medium text-[#1E293B]">Chofer Involucrado</Label>
              <Select value={choferId} onValueChange={(v) => setChoferId(v ?? "none")}>
                <SelectTrigger id="chofer" className="w-full">
                  <SelectValue placeholder="Seleccionar chofer..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin chofer / Otro</SelectItem>
                  {choferes.map((ch) => (
                    <SelectItem key={ch.id} value={ch.id}>
                      {ch.nombre} {ch.apellido || ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fecha" className="text-sm font-medium text-[#1E293B]">Fecha del Siniestro</Label>
              <Input
                id="fecha"
                type="date"
                required
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className={errClass("fecha")}
              />
              {errors.fecha && <p className="text-xs text-red-600">{errors.fecha}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="monto" className="text-sm font-medium text-[#1E293B]">Monto Estimado Daños ($)</Label>
              <Input
                id="monto"
                type="number"
                placeholder="Ej: 150000"
                value={montoDanos}
                onChange={(e) => setMontoDanos(e.target.value)}
                className={errClass("montoDanos")}
              />
              {errors.montoDanos && <p className="text-xs text-red-600">{errors.montoDanos}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="compania" className="text-sm font-medium text-[#1E293B]">Compañía de Seguro</Label>
              <Input
                id="compania"
                placeholder="Ej: La Caja, San Cristóbal"
                value={companiaSeguro}
                onChange={(e) => setCompaniaSeguro(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nroSiniestro" className="text-sm font-medium text-[#1E293B]">Nro Siniestro/Reclamación</Label>
              <Input
                id="nroSiniestro"
                placeholder="Ej: SIN-12345/26"
                value={numeroSiniestroSeguro}
                onChange={(e) => setNumeroSiniestroSeguro(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="terceros" className="text-sm font-medium text-[#1E293B]">Terceros Involucrados (Datos)</Label>
            <Input
              id="terceros"
              placeholder="Ej: Juan Pérez (Patente XYZ-789) / Compañía Rivadavia"
              value={tercerosInvolucrados}
              onChange={(e) => setTercerosInvolucrados(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descripcion" className="text-sm font-medium text-[#1E293B]">Detalles / Descripción del Accidente</Label>
            <textarea
              id="descripcion"
              required
              className="flex min-h-[90px] w-full rounded-md border border-[#E2E8F0] bg-white px-3 py-2 text-sm placeholder:text-[#94A3B8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0088D1] disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Describí detalladamente lo sucedido (ej: Colisión en ruta 3 km 120, despiste por calzada húmeda, etc.)..."
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
            {errors.descripcion && <p className="text-xs text-red-600">{errors.descripcion}</p>}
          </div>

          <DialogFooter className="pt-4 border-t-transparent sm:justify-end gap-2 bg-transparent -mx-0 -mb-0 rounded-none pb-0 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="text-[#475569] border-[#E2E8F0] hover:bg-[#F8FAFC]"
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="brand"
              disabled={loading}
              className="bg-[#0088D1] hover:bg-[#0277BD] text-white"
            >
              {loading ? "Guardando..." : editing ? "Guardar cambios" : "Registrar siniestro"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
