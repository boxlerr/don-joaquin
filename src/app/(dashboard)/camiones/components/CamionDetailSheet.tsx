"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trash2, Save, Truck, Wrench, Fuel, FileText, Calendar, MapPin, DollarSign } from "lucide-react";
import { updateCamionAction, deleteCamionAction, getCamionHistoryAction } from "../actions";
import StatusBadge from "@/components/ui/StatusBadge";

export default function CamionDetailSheet({
  camion,
  open,
  onOpenChange,
}: {
  camion: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [activeTab, setActiveTab] = useState<"info" | "services" | "gasoil" | "docs">("info");
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<{ services: any[]; gasoil: any[] }>({
    services: [],
    gasoil: [],
  });

  // Editable fields for 'info' tab
  const [formData, setFormData] = useState({
    patente: "",
    marca: "",
    modelo: "",
    ano: "",
    capacidad_tn: "",
    tipo_camion: "otro",
    estado: "activo",
  });

  useEffect(() => {
    if (camion) {
      setFormData({
        patente: camion.patente || "",
        marca: camion.marca || "",
        modelo: camion.modelo || "",
        ano: camion.ano?.toString() || "",
        capacidad_tn: camion.capacidad_tn?.toString() || "",
        tipo_camion: camion.tipo_camion || "otro",
        estado: camion.estado || "activo",
      });
      
      if (open) {
        fetchHistory();
      }
    }
  }, [camion, open]);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const data = await getCamionHistoryAction(camion.id);
      setHistory(data);
    } catch (err) {
      console.error("Error fetching history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleUpdate = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await updateCamionAction(camion.id, {
        ...formData,
        ano: parseInt(formData.ano),
        capacidad_tn: parseFloat(formData.capacidad_tn),
      });
      if (result.error) {
        setError(result.error);
      } else {
        onOpenChange(false);
      }
    } catch (err) {
      setError("Ocurrió un error al actualizar.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("¿Estás seguro de eliminar este camión?")) return;
    setLoading(true);
    try {
      const result = await deleteCamionAction(camion.id);
      if (result.error) {
        setError(result.error);
      } else {
        onOpenChange(false);
      }
    } catch (err) {
      setError("Ocurrió un error al eliminar.");
    } finally {
      setLoading(false);
    }
  };

  if (!camion) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[650px] p-0 flex flex-col gap-0 border-l border-[#E2E8F0]">
        <SheetHeader className="p-6 border-b border-[#E2E8F0] bg-white">
          <div className="flex items-center justify-between mb-2">
            <Badge variant="outline" className="bg-[#F8FAFC] text-[#64748B] font-mono border-[#E2E8F0]">
              ID: {camion.id.slice(0, 8)}
            </Badge>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="text-red-600 border-red-100 hover:bg-red-50 hover:border-red-200"
                onClick={handleDelete}
                disabled={loading}
              >
                <Trash2 size={14} className="mr-1" />
                Eliminar
              </Button>
            </div>
          </div>
          <SheetTitle className="text-2xl font-bold text-[#0F172A] flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#0088D1]/10 flex items-center justify-center text-[#0088D1]">
              <Truck size={24} />
            </div>
            {camion.patente}
          </SheetTitle>
          <SheetDescription className="text-[#64748B] text-base">
            {camion.marca} {camion.modelo} — {camion.ano}
          </SheetDescription>
        </SheetHeader>

        {/* Custom Tabs */}
        <div className="flex items-center px-6 border-b border-[#E2E8F0] bg-[#F8FAFC]">
          {[
            { id: "info", label: "Información", icon: Truck },
            { id: "services", label: "Services", icon: Wrench },
            { id: "gasoil", label: "Gasoil", icon: Fuel },
            { id: "docs", label: "Documentos", icon: FileText },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-[1px] ${
                activeTab === tab.id
                  ? "text-[#0088D1] border-[#0088D1]"
                  : "text-[#64748B] border-transparent hover:text-[#0F172A]"
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-[#FDFDFD]">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
              {error}
            </div>
          )}

          {activeTab === "info" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-[#1E293B]">Patente</Label>
                  <Input 
                    value={formData.patente} 
                    onChange={(e) => setFormData({...formData, patente: e.target.value.toUpperCase()})}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-[#1E293B]">Estado</Label>
                  <Select 
                    value={formData.estado} 
                    onValueChange={(val) => setFormData({...formData, estado: val})}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Estado">
                        {(value: string) => {
                          if (value === "activo") return "Activo";
                          if (value === "en_mantenimiento") return "En Mantenimiento";
                          if (value === "inactivo") return "Inactivo";
                          if (value === "baja") return "Baja";
                          return "Estado";
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="activo">Activo</SelectItem>
                      <SelectItem value="en_mantenimiento">En Mantenimiento</SelectItem>
                      <SelectItem value="inactivo">Inactivo</SelectItem>
                      <SelectItem value="baja">Baja</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-[#1E293B]">Marca</Label>
                  <Input 
                    value={formData.marca} 
                    onChange={(e) => setFormData({...formData, marca: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-[#1E293B]">Modelo</Label>
                  <Input 
                    value={formData.modelo} 
                    onChange={(e) => setFormData({...formData, modelo: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-[#1E293B]">Año</Label>
                  <Input 
                    type="number" 
                    value={formData.ano} 
                    onChange={(e) => setFormData({...formData, ano: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-[#1E293B]">Capacidad (TN)</Label>
                  <Input 
                    type="number" 
                    step="0.1" 
                    value={formData.capacidad_tn} 
                    onChange={(e) => setFormData({...formData, capacidad_tn: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-[#1E293B]">Tipo</Label>
                  <Select 
                    value={formData.tipo_camion} 
                    onValueChange={(val) => setFormData({...formData, tipo_camion: val})}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Tipo">
                        {(value: string) => {
                          if (value === "tractor") return "Tractor";
                          if (value === "chasis_rigido") return "Chasis Rígido";
                          if (value === "batea") return "Batea";
                          if (value === "otro") return "Otro";
                          return "Tipo";
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tractor">Tractor</SelectItem>
                      <SelectItem value="chasis_rigido">Chasis Rígido</SelectItem>
                      <SelectItem value="batea">Batea</SelectItem>
                      <SelectItem value="otro">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {activeTab === "services" && (
            <div className="space-y-4">
              {loadingHistory ? (
                <div className="py-8 text-center text-sm text-[#64748B]">Cargando historial...</div>
              ) : history.services.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-[#64748B]">
                  <Wrench size={48} className="mb-4 opacity-20" />
                  <p className="text-sm">No hay services registrados.</p>
                </div>
              ) : (
                history.services.map((s) => (
                  <div key={s.id} className="p-4 bg-white border border-[#E2E8F0] rounded-xl shadow-sm hover:border-[#CBD5E1] transition-all">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="bg-[#E0F2FE] text-[#0369A1] hover:bg-[#E0F2FE]">
                          {s.tipo.replace("_", " ")}
                        </Badge>
                        <span className="text-xs text-[#64748B] flex items-center gap-1">
                          <Calendar size={12} />
                          {new Date(s.fecha).toLocaleDateString("es-AR")}
                        </span>
                      </div>
                      <div className="text-sm font-bold text-[#0F172A]">
                        ${Number(s.costo || 0).toLocaleString("es-AR")}
                      </div>
                    </div>
                    <p className="text-sm text-[#0F172A] font-medium mb-1">{s.descripcion}</p>
                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[#F1F5F9]">
                      <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
                        <Truck size={12} />
                        {s.km_odometro.toLocaleString()} KM
                      </div>
                      {s.taller && (
                        <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
                          <MapPin size={12} />
                          {s.taller}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "gasoil" && (
            <div className="space-y-4">
              {loadingHistory ? (
                <div className="py-8 text-center text-sm text-[#64748B]">Cargando historial...</div>
              ) : history.gasoil.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-[#64748B]">
                  <Fuel size={48} className="mb-4 opacity-20" />
                  <p className="text-sm">No hay cargas registradas.</p>
                </div>
              ) : (
                history.gasoil.map((g) => (
                  <div key={g.id} className="p-4 bg-white border border-[#E2E8F0] rounded-xl shadow-sm hover:border-[#CBD5E1] transition-all">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-[#0F172A] flex items-center gap-1">
                          <Fuel size={12} className="text-[#0088D1]" />
                          {g.litros.toLocaleString()} Lts
                        </span>
                        <span className="text-xs text-[#64748B] flex items-center gap-1">
                          <Calendar size={12} />
                          {new Date(g.fecha).toLocaleDateString("es-AR")}
                        </span>
                      </div>
                      <div className="text-sm font-bold text-[#0F172A]">
                        ${Number(g.importe_total || 0).toLocaleString("es-AR")}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="text-xs text-[#64748B]">
                        {g.estacion || "Estación no especificada"}
                      </div>
                      <div className="text-xs font-mono text-[#64748B]">
                        {g.km_odometro.toLocaleString()} KM
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "docs" && (
            <div className="flex flex-col items-center justify-center py-12 text-[#64748B]">
              <FileText size={48} className="mb-4 opacity-20" />
              <p className="text-sm">Documentación del vehículo próximamente...</p>
            </div>
          )}
        </div>

        <SheetFooter className="p-6 border-t border-[#E2E8F0] bg-white sm:justify-end gap-3 shadow-[0_-4px_12px_rgba(0,0,0,0.03)]">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="text-[#475569] border-[#E2E8F0] px-6"
            disabled={loading}
          >
            Cerrar
          </Button>
          {activeTab === "info" && (
            <Button 
              className="bg-[#0088D1] hover:bg-[#0277BD] text-white gap-2 px-6"
              onClick={handleUpdate}
              disabled={loading}
            >
              <Save size={16} />
              {loading ? "Guardando..." : "Guardar cambios"}
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
