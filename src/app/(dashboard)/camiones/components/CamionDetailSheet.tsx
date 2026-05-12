"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Trash2, Save, Truck, Wrench, Fuel, FileText, Calendar, MapPin } from "lucide-react";
import { updateCamionAction, deleteCamionAction, getServiceHistoryAction, getGasoilHistoryAction } from "../actions";
import type { Camion, ServiceRecord, GasoilRecord } from "../types";

type TabId = "info" | "services" | "gasoil" | "docs";

export default function CamionDetailSheet({
  camion,
  open,
  onOpenChange,
}: {
  camion: Camion;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [activeTab, setActiveTab] = useState<TabId>("info");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    patente: "",
    marca: "",
    modelo: "",
    ano: "",
    capacidad_tn: "",
    tipo_camion: "otro",
    estado: "activo",
  });

  // Services state
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [servicesPage, setServicesPage] = useState(0);
  const [servicesHasMore, setServicesHasMore] = useState(false);
  const [servicesLoaded, setServicesLoaded] = useState(false);
  const [loadingServices, setLoadingServices] = useState(false);

  // Gasoil state
  const [gasoil, setGasoil] = useState<GasoilRecord[]>([]);
  const [gasoilPage, setGasoilPage] = useState(0);
  const [gasoilHasMore, setGasoilHasMore] = useState(false);
  const [gasoilLoaded, setGasoilLoaded] = useState(false);
  const [loadingGasoil, setLoadingGasoil] = useState(false);

  // Reset all state when the truck changes
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
      setActiveTab("info");
      setServices([]);
      setServicesPage(0);
      setServicesHasMore(false);
      setServicesLoaded(false);
      setGasoil([]);
      setGasoilPage(0);
      setGasoilHasMore(false);
      setGasoilLoaded(false);
      setError(null);
    }
  }, [camion?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchServices = useCallback(async (page: number) => {
    setLoadingServices(true);
    try {
      const result = await getServiceHistoryAction(camion.id, page);
      setServices((prev) => page === 0 ? result.data as ServiceRecord[] : [...prev, ...result.data as ServiceRecord[]]);
      setServicesHasMore(result.hasMore);
      setServicesPage(page);
      setServicesLoaded(true);
    } finally {
      setLoadingServices(false);
    }
  }, [camion?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchGasoil = useCallback(async (page: number) => {
    setLoadingGasoil(true);
    try {
      const result = await getGasoilHistoryAction(camion.id, page);
      setGasoil((prev) => page === 0 ? result.data as GasoilRecord[] : [...prev, ...result.data as GasoilRecord[]]);
      setGasoilHasMore(result.hasMore);
      setGasoilPage(page);
      setGasoilLoaded(true);
    } finally {
      setLoadingGasoil(false);
    }
  }, [camion?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    if (tab === "services" && !servicesLoaded) fetchServices(0);
    if (tab === "gasoil" && !gasoilLoaded) fetchGasoil(0);
  };

  const handleUpdate = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await updateCamionAction(camion.id, {
        ...formData,
        ano: parseInt(formData.ano),
        capacidad_tn: parseFloat(formData.capacidad_tn),
        tipo_camion: formData.tipo_camion as "tractor" | "chasis_rigido" | "batea" | "otro",
        estado: formData.estado as "activo" | "inactivo" | "baja" | "en_mantenimiento",
      });
      if (result.error) {
        setError(result.error);
      } else {
        onOpenChange(false);
      }
    } catch {
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
    } catch {
      setError("Ocurrió un error al eliminar.");
    } finally {
      setLoading(false);
    }
  };

  if (!camion) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-[680px] p-0 gap-0 overflow-hidden"
      >
        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-[#E2E8F0] bg-white">
          <div className="flex items-center justify-between mb-3">
            <Badge
              variant="outline"
              className="bg-[#F8FAFC] text-[#64748B] font-mono border-[#E2E8F0] text-xs"
            >
              ID: {camion.id.slice(0, 8)}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 border-red-100 hover:bg-red-50 hover:border-red-200"
              onClick={handleDelete}
              disabled={loading}
            >
              <Trash2 size={14} />
              Eliminar
            </Button>
          </div>
          <DialogTitle className="text-xl font-bold text-[#0F172A] flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#0088D1]/10 flex items-center justify-center text-[#0088D1] shrink-0">
              <Truck size={20} />
            </div>
            {camion.patente}
          </DialogTitle>
          <DialogDescription className="text-[#64748B] text-sm mt-0.5">
            {camion.marca} {camion.modelo} — {camion.ano}
          </DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex items-center px-6 border-b border-[#E2E8F0] bg-[#F8FAFC]">
          {[
            { id: "info" as TabId, label: "Información", icon: Truck },
            { id: "services" as TabId, label: "Services", icon: Wrench },
            { id: "gasoil" as TabId, label: "Gasoil", icon: Fuel },
            { id: "docs" as TabId, label: "Documentos", icon: FileText },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab.id
                  ? "text-[#0088D1] border-[#0088D1]"
                  : "text-[#64748B] border-transparent hover:text-[#0F172A]"
              }`}
            >
              <tab.icon size={15} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="overflow-y-auto max-h-[50vh] p-6 bg-[#FDFDFD]">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
              {error}
            </div>
          )}

          {activeTab === "info" && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-[#1E293B]">Patente</Label>
                  <Input
                    value={formData.patente}
                    onChange={(e) =>
                      setFormData({ ...formData, patente: e.target.value.toUpperCase() })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-[#1E293B]">Estado</Label>
                  <Select
                    value={formData.estado}
                    onValueChange={(val) =>
                      setFormData({ ...formData, estado: val ?? formData.estado })
                    }
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
                    onChange={(e) => setFormData({ ...formData, marca: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-[#1E293B]">Modelo</Label>
                  <Input
                    value={formData.modelo}
                    onChange={(e) => setFormData({ ...formData, modelo: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-[#1E293B]">Año</Label>
                  <Input
                    type="number"
                    value={formData.ano}
                    onChange={(e) => setFormData({ ...formData, ano: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-[#1E293B]">Capacidad (TN)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formData.capacidad_tn}
                    onChange={(e) => setFormData({ ...formData, capacidad_tn: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-[#1E293B]">Tipo</Label>
                  <Select
                    value={formData.tipo_camion}
                    onValueChange={(val) =>
                      setFormData({ ...formData, tipo_camion: val ?? formData.tipo_camion })
                    }
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
            <div className="space-y-3">
              {loadingServices && services.length === 0 ? (
                <div className="py-8 text-center text-sm text-[#64748B]">Cargando historial...</div>
              ) : services.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-[#64748B]">
                  <Wrench size={40} className="mb-3 opacity-20" />
                  <p className="text-sm">No hay services registrados.</p>
                </div>
              ) : (
                <>
                  {services.map((s) => (
                    <div
                      key={s.id}
                      className="p-4 bg-white border border-[#E2E8F0] rounded-lg hover:border-[#CBD5E1] transition-all"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="secondary"
                            className="bg-[#E0F2FE] text-[#0369A1] hover:bg-[#E0F2FE]"
                          >
                            {s.tipo.replace("_", " ")}
                          </Badge>
                          <span className="text-xs text-[#64748B] flex items-center gap-1">
                            <Calendar size={11} />
                            {new Date(s.fecha).toLocaleDateString("es-AR")}
                          </span>
                        </div>
                        <span className="text-sm font-bold text-[#0F172A]">
                          ${Number(s.costo || 0).toLocaleString("es-AR")}
                        </span>
                      </div>
                      <p className="text-sm text-[#0F172A] font-medium mb-2">{s.descripcion}</p>
                      <div className="flex items-center gap-4 pt-2 border-t border-[#F1F5F9]">
                        <span className="flex items-center gap-1 text-xs text-[#64748B]">
                          <Truck size={11} />
                          {s.km_odometro.toLocaleString()} KM
                        </span>
                        {s.taller && (
                          <span className="flex items-center gap-1 text-xs text-[#64748B]">
                            <MapPin size={11} />
                            {s.taller}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {servicesHasMore && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      disabled={loadingServices}
                      onClick={() => fetchServices(servicesPage + 1)}
                    >
                      {loadingServices ? "Cargando..." : "Cargar más"}
                    </Button>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === "gasoil" && (
            <div className="space-y-3">
              {loadingGasoil && gasoil.length === 0 ? (
                <div className="py-8 text-center text-sm text-[#64748B]">Cargando historial...</div>
              ) : gasoil.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-[#64748B]">
                  <Fuel size={40} className="mb-3 opacity-20" />
                  <p className="text-sm">No hay cargas registradas.</p>
                </div>
              ) : (
                <>
                  {gasoil.map((g) => (
                    <div
                      key={g.id}
                      className="p-4 bg-white border border-[#E2E8F0] rounded-lg hover:border-[#CBD5E1] transition-all"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-[#0F172A] flex items-center gap-1">
                            <Fuel size={12} className="text-[#0088D1]" />
                            {g.litros.toLocaleString()} Lts
                          </span>
                          <span className="text-xs text-[#64748B] flex items-center gap-1">
                            <Calendar size={11} />
                            {new Date(g.fecha).toLocaleDateString("es-AR")}
                          </span>
                        </div>
                        <span className="text-sm font-bold text-[#0F172A]">
                          ${Number(g.importe_total || 0).toLocaleString("es-AR")}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-[#64748B]">
                        <span>{g.estacion || "Estación no especificada"}</span>
                        <span className="font-mono">{g.km_odometro.toLocaleString()} KM</span>
                      </div>
                    </div>
                  ))}
                  {gasoilHasMore && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      disabled={loadingGasoil}
                      onClick={() => fetchGasoil(gasoilPage + 1)}
                    >
                      {loadingGasoil ? "Cargando..." : "Cargar más"}
                    </Button>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === "docs" && (
            <div className="flex flex-col items-center justify-center py-12 text-[#64748B]">
              <FileText size={40} className="mb-3 opacity-20" />
              <p className="text-sm">Documentación del vehículo próximamente...</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t border-[#E2E8F0] bg-white">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cerrar
          </Button>
          {activeTab === "info" && (
            <Button
              variant="brand"
              onClick={handleUpdate}
              disabled={loading}
            >
              <Save size={14} />
              {loading ? "Guardando..." : "Guardar cambios"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
