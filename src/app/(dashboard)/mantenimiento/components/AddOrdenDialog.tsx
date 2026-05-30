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
  Wrench,
  ChevronDown,
  Check,
  Calendar,
  FileText,
  Truck,
  Hash,
  AlertCircle,
  Users,
  Building2,
} from "lucide-react";
import type { Unidad, MantenimientoOrden, Chofer } from "./MantenimientoTable";

interface AddOrdenDialogProps {
  children: React.ReactNode;
  camiones: Unidad[];
  choferes: Chofer[];
  nextId: string;
  onAdd: (newOrden: MantenimientoOrden) => void;
}

export default function AddOrdenDialog({
  children,
  camiones,
  choferes,
  nextId,
  onAdd,
}: AddOrdenDialogProps) {
  const [open, setOpen] = useState(false);
  const [patente, setPatente] = useState(camiones[0]?.patente || "");
  const [tipo, setTipo] = useState("Preventivo");
  const [choferId, setChoferId] = useState("");
  const [fechaProgramada, setFechaProgramada] = useState("");
  const [estado, setEstado] = useState("Programada");
  const [prioridad, setPrioridad] = useState("Media");
  const [descripcion, setDescripcion] = useState("");
  const [encargado, setEncargado] = useState<"Propio" | "Tercerizado">("Propio");
  const [empresa, setEmpresa] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setPatente(camiones.length > 0 ? camiones[0].patente : "");
    setTipo("Preventivo");
    setChoferId("");
    setFechaProgramada("");
    setEstado("Programada");
    setPrioridad("Media");
    setDescripcion("");
    setEncargado("Propio");
    setEmpresa("");
    setError(null);
  };

  const getEstadoDotColor = (val: string) => {
    switch (val) {
      case "Programada":
        return "bg-[#0088D1]";
      case "En proceso":
        return "bg-[#F59E0B]";
      case "Completada":
        return "bg-[#22C55E]";
      case "Vencida":
        return "bg-[#EF4444]";
      default:
        return "bg-slate-400";
    }
  };

  const getPrioridadDotColor = (val: string) => {
    switch (val) {
      case "Alta":
        return "bg-[#EF4444]";
      case "Media":
        return "bg-[#F59E0B]";
      case "Baja":
        return "bg-[#22C55E]";
      default:
        return "bg-slate-400";
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (camiones.length === 0) {
      setError("Debe registrar al menos un camión en la sección de Camiones antes de crear una orden.");
      return;
    }

    if (!patente) {
      setError("Debe seleccionar una unidad.");
      return;
    }

    if (!fechaProgramada.trim()) {
      setError("La fecha programada es requerida.");
      return;
    }

    // Validate simple DD/MM/AAAA format
    const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
    if (!dateRegex.test(fechaProgramada.trim())) {
      setError("Formato de fecha inválido. Utilice el formato DD/MM/AAAA (ej: 22/05/2026).");
      return;
    }

    if (tipo === "Correctivo" && !choferId) {
      setError("Debe seleccionar un chofer para el mantenimiento correctivo.");
      return;
    }

    if (encargado === "Tercerizado" && !empresa.trim()) {
      setError("El nombre de la empresa encargada es requerido para mantenimientos tercerizados.");
      return;
    }

    if (!descripcion.trim()) {
      setError("La descripción es requerida.");
      return;
    }

    const selectedTruck = camiones.find((c) => c.patente === patente);
    if (!selectedTruck) {
      setError("El camión seleccionado no es válido.");
      return;
    }

    const selectedChofer = tipo === "Correctivo" ? choferes.find((c) => c.id === choferId) : undefined;

    onAdd({
      id: nextId,
      unidad: {
        patente: selectedTruck.patente,
        marca: selectedTruck.marca,
        modelo: selectedTruck.modelo,
      },
      tipo,
      descripcion: descripcion.trim(),
      fechaProgramada: fechaProgramada.trim(),
      estado,
      prioridad,
      encargado,
      empresa: encargado === "Tercerizado" ? empresa.trim() : "",
      chofer: selectedChofer,
    });

    setOpen(false);
    reset();
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
            <div className="flex items-center justify-center size-12 rounded-full bg-[#E1F5FE] text-[#0088D1] shrink-0">
              <Wrench size={22} />
            </div>
            <div>
              <DialogTitle className="text-foreground text-lg font-bold">
                Agregar nueva orden
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs font-medium mt-0.5">
                Ingresá los datos del mantenimiento para programarlo en la flota.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-5">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs font-medium flex items-start gap-2">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* N° Orden (disabled) */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">N° Orden</Label>
              <div className="relative flex items-center h-10 w-full rounded-lg border border-border bg-[#F1F5F9] overflow-hidden text-muted-foreground">
                <div className="flex items-center justify-center w-10 h-full border-r border-border bg-muted/50 shrink-0">
                  <Hash size={15} />
                </div>
                <input
                  type="text"
                  disabled
                  value={nextId}
                  className="flex-1 h-full px-3 text-sm bg-transparent border-0 outline-none font-medium cursor-not-allowed"
                />
              </div>
            </div>

            {/* Unidad */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">Unidad *</Label>
              <div className="relative flex items-center h-10 w-full rounded-lg border border-border bg-card overflow-hidden focus-within:ring-2 focus-within:ring-[#0088D1]/20 focus-within:border-[#0088D1] transition-all">
                <div className="flex items-center justify-center w-10 h-full border-r border-border bg-muted/50 text-[#0088D1] shrink-0">
                  <Truck size={15} />
                </div>
                <div className="relative flex-1 h-full">
                  <select
                    name="patente"
                    value={patente}
                    className="w-full h-full px-3 pr-10 text-sm bg-transparent border-0 outline-none focus:outline-none focus:ring-0 text-foreground appearance-none cursor-pointer font-medium"
                    onChange={(e) => setPatente(e.target.value)}
                  >
                    {camiones.length === 0 ? (
                      <option value="">Sin camiones</option>
                    ) : (
                      camiones.map((c) => (
                        <option key={c.patente} value={c.patente}>
                          {c.patente} ({c.marca} {c.modelo})
                        </option>
                      ))
                    )}
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
            {/* Tipo */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">Tipo *</Label>
              <div className="relative flex items-center h-10 w-full rounded-lg border border-border bg-card overflow-hidden focus-within:ring-2 focus-within:ring-[#0088D1]/20 focus-within:border-[#0088D1] transition-all">
                <div className="flex items-center justify-center w-10 h-full border-r border-border bg-muted/50 text-[#0088D1] shrink-0">
                  <Wrench size={15} />
                </div>
                <div className="relative flex-1 h-full">
                  <select
                    name="tipo"
                    value={tipo}
                    className="w-full h-full px-3 pr-10 text-sm bg-transparent border-0 outline-none focus:outline-none focus:ring-0 text-foreground appearance-none cursor-pointer font-medium"
                    onChange={(e) => {
                      const val = e.target.value;
                      setTipo(val);
                      if (val === "Preventivo") setChoferId("");
                    }}
                  >
                    <option value="Preventivo">Preventivo</option>
                    <option value="Correctivo">Correctivo</option>
                  </select>
                  <ChevronDown
                    size={14}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 pointer-events-none"
                  />
                </div>
              </div>
            </div>

            {/* Fecha Programada */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">Fecha Programada *</Label>
              <div className="relative flex items-center h-10 w-full rounded-lg border border-border bg-card overflow-hidden focus-within:ring-2 focus-within:ring-[#0088D1]/20 focus-within:border-[#0088D1] transition-all">
                <div className="flex items-center justify-center w-10 h-full border-r border-border bg-muted/50 text-muted-foreground shrink-0">
                  <Calendar size={15} />
                </div>
                <input
                  type="text"
                  name="fechaProgramada"
                  placeholder="Ej: 22/05/2026"
                  required
                  value={fechaProgramada}
                  onChange={(e) => setFechaProgramada(e.target.value)}
                  className="flex-1 h-full px-3 text-sm bg-transparent border-0 outline-none focus:outline-none focus:ring-0 text-foreground font-medium"
                />
              </div>
            </div>
          </div>

          {/* Chofer (Correctivo) */}
          {tipo === "Correctivo" && (
            <div className="space-y-1 animate-in fade-in slide-in-from-top-2 duration-200">
              <Label className="text-xs font-semibold text-muted-foreground">Chofer Asignado *</Label>
              <div className="relative flex items-center h-10 w-full rounded-lg border border-border bg-card overflow-hidden focus-within:ring-2 focus-within:ring-[#0088D1]/20 focus-within:border-[#0088D1] transition-all">
                <div className="flex items-center justify-center w-10 h-full border-r border-border bg-muted/50 text-[#0088D1] shrink-0">
                  <Users size={15} />
                </div>
                <div className="relative flex-1 h-full">
                  <select
                    name="choferId"
                    value={choferId}
                    required
                    className="w-full h-full px-3 pr-10 text-sm bg-transparent border-0 outline-none focus:outline-none focus:ring-0 text-foreground appearance-none cursor-pointer font-medium"
                    onChange={(e) => setChoferId(e.target.value)}
                  >
                    <option value="">Seleccionar chofer...</option>
                    {choferes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.apellido}, {c.nombre}
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
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* Estado */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">Estado *</Label>
              <div className="relative flex items-center h-10 w-full rounded-lg border border-border bg-card overflow-hidden focus-within:ring-2 focus-within:ring-[#0088D1]/20 focus-within:border-[#0088D1] transition-all">
                <div className="flex items-center justify-center w-10 h-full border-r border-border bg-muted/50 shrink-0">
                  <span className={`size-2.5 rounded-full ${getEstadoDotColor(estado)}`} />
                </div>
                <div className="relative flex-1 h-full">
                  <select
                    name="estado"
                    value={estado}
                    className="w-full h-full px-3 pr-10 text-sm bg-transparent border-0 outline-none focus:outline-none focus:ring-0 text-foreground appearance-none cursor-pointer font-medium"
                    onChange={(e) => setEstado(e.target.value)}
                  >
                    <option value="Programada">Programada</option>
                    <option value="En proceso">En proceso</option>
                    <option value="Completada">Completada</option>
                    <option value="Vencida">Vencida</option>
                  </select>
                  <ChevronDown
                    size={14}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 pointer-events-none"
                  />
                </div>
              </div>
            </div>

            {/* Prioridad */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">Prioridad *</Label>
              <div className="relative flex items-center h-10 w-full rounded-lg border border-border bg-card overflow-hidden focus-within:ring-2 focus-within:ring-[#0088D1]/20 focus-within:border-[#0088D1] transition-all">
                <div className="flex items-center justify-center w-10 h-full border-r border-border bg-muted/50 shrink-0">
                  <span className={`size-2.5 rounded-full ${getPrioridadDotColor(prioridad)}`} />
                </div>
                <div className="relative flex-1 h-full">
                  <select
                    name="prioridad"
                    value={prioridad}
                    className="w-full h-full px-3 pr-10 text-sm bg-transparent border-0 outline-none focus:outline-none focus:ring-0 text-foreground appearance-none cursor-pointer font-medium"
                    onChange={(e) => setPrioridad(e.target.value)}
                  >
                    <option value="Baja">Baja</option>
                    <option value="Media">Media</option>
                    <option value="Alta">Alta</option>
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
            {/* Encargado */}
            <div className={encargado === "Tercerizado" ? "col-span-1" : "col-span-2"}>
              <Label className="text-xs font-semibold text-muted-foreground">Encargado del Mantenimiento *</Label>
              <div className="relative flex items-center h-10 w-full rounded-lg border border-border bg-card overflow-hidden focus-within:ring-2 focus-within:ring-[#0088D1]/20 focus-within:border-[#0088D1] transition-all">
                <div className="flex items-center justify-center w-10 h-full border-r border-border bg-muted/50 text-[#0088D1] shrink-0">
                  <Users size={15} />
                </div>
                <div className="relative flex-1 h-full">
                  <select
                    name="encargado"
                    value={encargado}
                    className="w-full h-full px-3 pr-10 text-sm bg-transparent border-0 outline-none focus:outline-none focus:ring-0 text-foreground appearance-none cursor-pointer font-medium"
                    onChange={(e) => {
                      const val = e.target.value as "Propio" | "Tercerizado";
                      setEncargado(val);
                      if (val === "Propio") setEmpresa("");
                    }}
                  >
                    <option value="Propio">Propio</option>
                    <option value="Tercerizado">Tercerizado</option>
                  </select>
                  <ChevronDown
                    size={14}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 pointer-events-none"
                  />
                </div>
              </div>
            </div>

            {/* Empresa Encargada */}
            {encargado === "Tercerizado" && (
              <div className="col-span-1 animate-in fade-in slide-in-from-left-2 duration-200">
                <Label className="text-xs font-semibold text-muted-foreground">Empresa Encargada *</Label>
                <div className="relative flex items-center h-10 w-full rounded-lg border border-border bg-card overflow-hidden focus-within:ring-2 focus-within:ring-[#0088D1]/20 focus-within:border-[#0088D1] transition-all">
                  <div className="flex items-center justify-center w-10 h-full border-r border-border bg-muted/50 text-[#0088D1] shrink-0">
                    <Building2 size={15} />
                  </div>
                  <input
                    type="text"
                    name="empresa"
                    placeholder="Ej: Taller mecánico"
                    value={empresa}
                    onChange={(e) => setEmpresa(e.target.value)}
                    className="flex-1 h-full px-3 text-sm bg-transparent border-0 outline-none focus:outline-none focus:ring-0 text-foreground font-medium"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Descripción */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-muted-foreground">Descripción *</Label>
            <div className="relative flex items-start w-full rounded-lg border border-border bg-card overflow-hidden focus-within:ring-2 focus-within:ring-[#0088D1]/20 focus-within:border-[#0088D1] transition-all">
              <div className="flex items-center justify-center w-10 h-10 border-r border-border bg-muted/50 text-muted-foreground shrink-0">
                <FileText size={15} />
              </div>
              <textarea
                name="descripcion"
                placeholder="Ej: Cambio de aceite y filtros de aire/combustible"
                required
                rows={3}
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                className="flex-1 min-h-[80px] p-2.5 text-sm bg-transparent border-0 outline-none focus:outline-none focus:ring-0 text-foreground resize-y font-medium font-sans"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-4 mt-6 border-t border-border -mx-6 px-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false);
                reset();
              }}
              className="h-10 px-6 rounded-lg text-sm font-semibold border border-border text-muted-foreground hover:bg-muted/40 transition-colors"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-[#0088D1] hover:bg-[#0277BD] text-white flex items-center justify-center gap-1.5 h-10 px-6 rounded-lg font-bold shadow-sm hover:shadow transition-all"
            >
              <Check size={16} strokeWidth={2.5} /> Guardar orden
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
