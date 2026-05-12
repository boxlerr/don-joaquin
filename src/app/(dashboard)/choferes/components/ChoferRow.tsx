"use client";

import { useState } from "react";
import { TableRow, TableCell } from "@/components/ui/table";
import StatusBadge from "@/components/ui/StatusBadge";
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
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { ChevronDown, ChevronRight, Edit, RefreshCw, Trash2, UserCog } from "lucide-react";
import { updateChoferAction, updateChoferEstadoAction, deleteChoferAction } from "../actions";

export default function ChoferRow({ chofer }: { chofer: any }) {
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit form state
  const [nombre, setNombre] = useState(chofer.nombre || "");
  const [apellido, setApellido] = useState(chofer.apellido || "");
  const [dni, setDni] = useState(chofer.dni || "");
  const [estado, setEstado] = useState<"activo" | "inactivo">(chofer.estado || "activo");
  const [telefono, setTelefono] = useState(chofer.telefono || "");
  const [localidad, setLocalidad] = useState(chofer.localidad || "");

  const handleEditOpen = (e: React.MouseEvent) => {
    e.stopPropagation(); // Evita que colapse la fila al tocar el botón
    setNombre(chofer.nombre || "");
    setApellido(chofer.apellido || "");
    setDni(chofer.dni || "");
    setEstado(chofer.estado || "activo");
    setTelefono(chofer.telefono || "");
    setLocalidad(chofer.localidad || "");
    setEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await updateChoferAction(chofer.id, {
        nombre,
        apellido,
        dni,
        estado,
        telefono,
        localidad,
      });
      if (res.error) {
        setError(res.error);
      } else {
        setEditOpen(false);
      }
    } catch {
      setError("Error al actualizar los datos.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEstado = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    const nuevoEstado = chofer.estado === "activo" ? "inactivo" : "activo";
    try {
      await updateChoferEstadoAction(chofer.id, nuevoEstado);
    } catch {
      alert("No se pudo cambiar el estado.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`¿Estás seguro de eliminar al chofer ${chofer.apellido}, ${chofer.nombre}?`)) return;
    setLoading(true);
    try {
      const res = await deleteChoferAction(chofer.id);
      if (res.error) alert(res.error);
    } catch {
      alert("Error al eliminar el chofer.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <TableRow 
        className={`hover:bg-[#F8FAFC] transition-all cursor-pointer select-none ${expanded ? "bg-[#F8FAFC] font-medium" : ""}`}
        onClick={() => setExpanded(!expanded)}
      >
        <TableCell className="font-medium text-[#0F172A]">
          <div className="flex items-center gap-2">
            <span className="text-[#94A3B8] transition-transform duration-200">
              {expanded ? <ChevronDown size={15} className="text-[#0088D1]" /> : <ChevronRight size={15} />}
            </span>
            <span>{chofer.apellido}, {chofer.nombre}</span>
          </div>
        </TableCell>
        <TableCell className="font-mono">{chofer.dni}</TableCell>
        <TableCell className="text-[#475569]">{chofer.localidad ?? "—"}</TableCell>
        <TableCell className="text-[#475569]">{chofer.telefono ?? "—"}</TableCell>
        <TableCell className="text-[#475569] text-xs">
          {new Date(chofer.fecha_ingreso).toLocaleDateString("es-AR")}
        </TableCell>
        <TableCell>
          <StatusBadge
            label={chofer.estado}
            tone={chofer.estado === "activo" ? "success" : "neutral"}
          />
        </TableCell>
      </TableRow>

      {/* Panel Desplegable Entero */}
      {expanded && (
        <TableRow className="bg-[#F8FAFC] hover:bg-[#F8FAFC]">
          <TableCell colSpan={6} className="p-0 border-b border-[#E2E8F0]">
            <div className="px-8 py-4 bg-gradient-to-r from-[#F1F5F9]/50 via-[#F8FAFC] to-[#F1F5F9]/50 border-t border-[#E2E8F0] animate-in fade-in-50 slide-in-from-top-1 duration-150">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-[#64748B]">
                  <UserCog size={14} className="text-[#0088D1]" />
                  <span>Opciones de gestión para el legajo de <strong>{chofer.nombre}</strong></span>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs border-[#CBD5E1] text-[#334155] hover:bg-white"
                    onClick={handleEditOpen}
                    disabled={loading}
                  >
                    <Edit size={13} className="mr-1.5 text-[#0088D1]" />
                    Modificar datos
                  </Button>
                  
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs border-[#CBD5E1] text-[#334155] hover:bg-white"
                    onClick={handleToggleEstado}
                    disabled={loading}
                  >
                    <RefreshCw size={13} className={`mr-1.5 ${chofer.estado === "activo" ? "text-amber-500" : "text-emerald-500"}`} />
                    {chofer.estado === "activo" ? "Pasar a Inactivo" : "Pasar a Activo"}
                  </Button>

                  <div className="w-px h-4 bg-[#CBD5E1] mx-1" />

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                    onClick={handleDelete}
                    disabled={loading}
                  >
                    <Trash2 size={13} className="mr-1.5" />
                    Eliminar
                  </Button>
                </div>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}

      {/* Edit Modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-[#0F172A] text-xl">Modificar datos del chofer</DialogTitle>
            <DialogDescription className="text-[#475569]">
              Actualizá la información personal y de contacto.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-4 py-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-nombre" className="text-sm font-medium text-[#1E293B]">Nombre</Label>
                <Input 
                  id="edit-nombre" 
                  required 
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-apellido" className="text-sm font-medium text-[#1E293B]">Apellido</Label>
                <Input 
                  id="edit-apellido" 
                  required 
                  value={apellido}
                  onChange={(e) => setApellido(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-dni" className="text-sm font-medium text-[#1E293B]">DNI</Label>
                <Input 
                  id="edit-dni" 
                  required 
                  value={dni}
                  onChange={(e) => setDni(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-estado" className="text-sm font-medium text-[#1E293B]">Estado</Label>
                <Select value={estado} onValueChange={(v) => setEstado((v ?? "activo") as any)}>
                  <SelectTrigger id="edit-estado" className="w-full">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="activo">Activo</SelectItem>
                    <SelectItem value="inactivo">Inactivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-telefono" className="text-sm font-medium text-[#1E293B]">Teléfono</Label>
                <Input 
                  id="edit-telefono" 
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-localidad" className="text-sm font-medium text-[#1E293B]">Localidad</Label>
                <Input 
                  id="edit-localidad" 
                  value={localidad}
                  onChange={(e) => setLocalidad(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter className="pt-4 border-t-transparent sm:justify-end gap-2 bg-transparent -mx-0 -mb-0 rounded-none pb-0 mt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setEditOpen(false)}
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
                {loading ? "Guardando..." : "Guardar cambios"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
