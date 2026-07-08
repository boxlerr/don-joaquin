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
  DialogTrigger,
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
  addEntrevistaAction,
  updateEntrevistaAction,
  getCvsAction,
  crearUrlSubidaCvAction,
  vincularCvAction,
  deleteCvAction,
  type EntrevistaFormData,
} from "../actions";
import AdjuntosEditable from "@/components/ui/AdjuntosEditable";
import type { Entrevista } from "./EntrevistasTable";

const PREOCUPACIONAL_OPCIONES = [
  { value: "no_aplica", label: "No corresponde / sin definir" },
  { value: "pendiente", label: "Se le va a hacer" },
  { value: "apto", label: "Se hizo — dio apto" },
  { value: "no_apto", label: "Se hizo — dio no apto" },
];

const RESULTADO_OPCIONES = [
  { value: "pendiente", label: "Pendiente / en evaluación" },
  { value: "ingresa", label: "Ingresa al transporte" },
  { value: "no_ingresa", label: "No ingresa" },
];

export default function EntrevistaFormDialog({
  children,
  entrevista,
}: {
  children: React.ReactNode;
  /** Si se pasa, el diálogo funciona en modo edición. */
  entrevista?: Entrevista;
}) {
  const router = useRouter();
  const isEdit = !!entrevista;

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nombre, setNombre] = useState(entrevista?.nombre ?? "");
  const [fecha, setFecha] = useState(
    entrevista?.fecha_entrevista ?? new Date().toISOString().split("T")[0],
  );
  const [edad, setEdad] = useState(entrevista?.edad != null ? String(entrevista.edad) : "");
  const [localidad, setLocalidad] = useState(entrevista?.localidad ?? "");
  const [telefono, setTelefono] = useState(entrevista?.telefono ?? "");
  const [dni, setDni] = useState(entrevista?.dni ?? "");
  const [email, setEmail] = useState(entrevista?.email ?? "");
  const [puesto, setPuesto] = useState(entrevista?.puesto ?? "");
  const [experiencia, setExperiencia] = useState(entrevista?.experiencia ?? "");
  const [observaciones, setObservaciones] = useState(entrevista?.observaciones ?? "");
  const [preocupacional, setPreocupacional] = useState(
    entrevista?.preocupacional ?? "no_aplica",
  );
  const [resultado, setResultado] = useState(entrevista?.resultado ?? "pendiente");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    setLoading(true);
    setError(null);

    const payload: EntrevistaFormData = {
      nombre,
      fecha_entrevista: fecha || undefined,
      edad: edad || undefined,
      localidad: localidad || undefined,
      telefono: telefono || undefined,
      dni: dni || undefined,
      email: email || undefined,
      puesto: puesto || undefined,
      experiencia: experiencia || undefined,
      observaciones: observaciones || undefined,
      preocupacional,
      resultado,
    };

    try {
      const res = isEdit
        ? await updateEntrevistaAction(entrevista!.id, payload)
        : await addEntrevistaAction(payload);

      if ("error" in res && res.error) {
        setError(res.error);
      } else {
        setOpen(false);
        if (!isEdit) {
          // Reset en modo alta
          setNombre("");
          setFecha(new Date().toISOString().split("T")[0]);
          setEdad("");
          setLocalidad("");
          setTelefono("");
          setDni("");
          setEmail("");
          setPuesto("");
          setExperiencia("");
          setObservaciones("");
          setPreocupacional("no_aplica");
          setResultado("pendiente");
        }
        router.refresh();
      }
    } catch {
      setError("Ocurrió un error al guardar la entrevista.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={children as React.ReactElement} />
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="text-foreground text-xl">
            {isEdit ? "Editar entrevista" : "Registrar entrevista"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {isEdit
              ? "Actualizá los datos y las observaciones de esta persona."
              : "Registrá a la persona entrevistada. Las observaciones son tu nota libre para reconocerla más adelante."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="ent-nombre" className="text-sm font-medium text-foreground">
              Nombre y apellido
            </Label>
            <Input
              id="ent-nombre"
              placeholder="Ej: Carlos Pérez"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ent-fecha" className="text-sm font-medium text-foreground">
                Fecha de entrevista
              </Label>
              <Input
                id="ent-fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ent-edad" className="text-sm font-medium text-foreground">
                Edad
              </Label>
              <Input
                id="ent-edad"
                type="number"
                min={14}
                max={99}
                placeholder="Ej: 38"
                value={edad}
                onChange={(e) => setEdad(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ent-localidad" className="text-sm font-medium text-foreground">
                De dónde es
              </Label>
              <Input
                id="ent-localidad"
                placeholder="Localidad / ciudad"
                value={localidad}
                onChange={(e) => setLocalidad(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ent-telefono" className="text-sm font-medium text-foreground">
                Teléfono (opcional)
              </Label>
              <Input
                id="ent-telefono"
                placeholder="Para recontactar"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ent-dni" className="text-sm font-medium text-foreground">DNI</Label>
              <Input id="ent-dni" placeholder="Ej: 30.123.456" value={dni} onChange={(e) => setDni(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ent-email" className="text-sm font-medium text-foreground">Email (opcional)</Label>
              <Input id="ent-email" type="email" placeholder="correo@ejemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ent-puesto" className="text-sm font-medium text-foreground">Puesto al que aplica</Label>
              <Input id="ent-puesto" placeholder="Ej: Chofer larga distancia" value={puesto} onChange={(e) => setPuesto(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ent-exp" className="text-sm font-medium text-foreground">Experiencia (opcional)</Label>
              <Input id="ent-exp" placeholder="Ej: 5 años en carga" value={experiencia} onChange={(e) => setExperiencia(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ent-obs" className="text-sm font-medium text-foreground">
              Observaciones
            </Label>
            <textarea
              id="ent-obs"
              rows={4}
              placeholder="Tu impresión personal: cómo lo viste, qué te llamó la atención, si lo recomendarías, etc."
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              className="w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-y"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">Preocupacional</Label>
              <Select value={preocupacional} onValueChange={(v) => setPreocupacional(v ?? "no_aplica")}>
                <SelectTrigger className="w-full">
                  <SelectValue>{(v) => PREOCUPACIONAL_OPCIONES.find((o) => o.value === v)?.label ?? ""}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PREOCUPACIONAL_OPCIONES.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">¿Entra al transporte?</Label>
              <Select value={resultado} onValueChange={(v) => setResultado(v ?? "pendiente")}>
                <SelectTrigger className="w-full">
                  <SelectValue>{(v) => RESULTADO_OPCIONES.find((o) => o.value === v)?.label ?? ""}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {RESULTADO_OPCIONES.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2 border-t border-border pt-3">
            <Label className="text-sm font-medium text-foreground">CV / documentos</Label>
            {isEdit ? (
              <AdjuntosEditable
                entidadId={entrevista!.id}
                getArchivos={getCvsAction}
                crearUrlSubida={crearUrlSubidaCvAction}
                vincularArchivos={vincularCvAction}
                deleteArchivo={deleteCvAction}
                canEdit
                addLabel="Subir CV / documento"
                emptyHint="Sin CV cargado. Subilo para tenerlo guardado y poder previsualizarlo."
              />
            ) : (
              <p className="text-xs text-muted-foreground">Registrá primero al candidato y después vas a poder adjuntar el CV (se guarda y se puede previsualizar).</p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando..." : isEdit ? "Guardar cambios" : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
