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
import { Trash2, Save, Truck, Wrench, Fuel, FileText, Calendar, MapPin, Plus, Pencil } from "lucide-react";
import { updateCamionAction, deleteCamionAction, getServiceHistoryAction, getGasoilHistoryAction, getCamionDocumentosAction, deleteServiceAction, deleteGasoilAction } from "../actions";
import type { Camion, ServiceRecord, GasoilRecord, DocumentoVigenciaCamion, TipoDocumentoCamion } from "../types";
import CamionDocumentosTab from "./CamionDocumentosTab";
import AddServiceDialog, { type ServiceEditing } from "./AddServiceDialog";
import AddGasoilDialog, { type GasoilEditing } from "./AddGasoilDialog";

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

  // Docs state
  const [documentos, setDocumentos] = useState<DocumentoVigenciaCamion[]>([]);
  const [tipos, setTipos] = useState<TipoDocumentoCamion[]>([]);
  const [docsLoaded, setDocsLoaded] = useState(false);

  // Service/Gasoil dialog state
  const [serviceDialog, setServiceDialog] = useState<{ open: boolean; editing: ServiceEditing | null }>({
    open: false,
    editing: null,
  });
  const [gasoilDialog, setGasoilDialog] = useState<{ open: boolean; editing: GasoilEditing | null }>({
    open: false,
    editing: null,
  });

  // Refrescar y cargar la información cuando se abra la hoja o cambie el camión
  useEffect(() => {
    if (camion && open) {
      setFormData({
        patente: camion.patente || "",
        marca: camion.marca || "",
        modelo: camion.modelo || "",
        ano: camion.ano?.toString() || "",
        capacidad_tn: camion.capacidad_tn?.toString() || "",
        tipo_camion: camion.tipo_camion || "otro",
        estado: camion.estado || "activo",
      });
      // Forzar siempre la recarga de los datos para garantizar frescura
      setServicesLoaded(false);
      setGasoilLoaded(false);
      setDocsLoaded(false);
      setError(null);

      // Si se abre directo en una tab en particular, cargarla
      if (activeTab === "services") {
        fetchServices(0);
      } else if (activeTab === "gasoil") {
        fetchGasoil(0);
      } else if (activeTab === "docs") {
        fetchDocs();
      }
    }
  }, [camion?.id, open]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const fetchDocs = useCallback(async () => {
    const result = await getCamionDocumentosAction(camion.id);
    setDocumentos(result.documentos as DocumentoVigenciaCamion[]);
    setTipos(result.tipos as TipoDocumentoCamion[]);
    setDocsLoaded(true);
  }, [camion?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    // Siempre buscar de nuevo al cambiar a la pestaña para obtener las cargas recientes
    if (tab === "services") fetchServices(0);
    if (tab === "gasoil") fetchGasoil(0);
    if (tab === "docs") fetchDocs();
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

  const handleDeleteService = async (id: string) => {
    if (!confirm("¿Eliminar este service?")) return;
    const res = await deleteServiceAction(id);
    if (res.error) setError(res.error);
    else setServices((prev) => prev.filter((s) => s.id !== id));
  };

  const handleDeleteGasoil = async (id: string) => {
    if (!confirm("¿Eliminar esta carga de gasoil?")) return;
    const res = await deleteGasoilAction(id);
    if (res.error) setError(res.error);
    else setGasoil((prev) => prev.filter((g) => g.id !== id));
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
                      <SelectValue placeholder="Estado" />
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
                      <SelectValue placeholder="Tipo" />
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
              <div className="flex justify-end">
                <Button
                  variant="brand"
                  size="sm"
                  onClick={() => setServiceDialog({ open: true, editing: null })}
                >
                  <Plus size={14} />
                  Nuevo service
                </Button>
              </div>
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
                      className="p-4 bg-white border border-[#E2E8F0] rounded-lg hover:border-[#CBD5E1] transition-all group"
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
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-[#0F172A]">
                            ${Number(s.costo || 0).toLocaleString("es-AR")}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setServiceDialog({
                                open: true,
                                editing: {
                                  id: s.id,
                                  fecha: s.fecha,
                                  tipo: s.tipo,
                                  km_odometro: s.km_odometro,
                                  taller: s.taller,
                                  costo: s.costo,
                                  descripcion: s.descripcion,
                                },
                              })
                            }
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-[#E1F5FE] text-[#0088D1]"
                            title="Editar service"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteService(s.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-50 text-red-500 hover:text-red-600"
                            title="Eliminar service"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
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
              <div className="flex justify-end">
                <Button
                  variant="brand"
                  size="sm"
                  onClick={() => setGasoilDialog({ open: true, editing: null })}
                >
                  <Plus size={14} />
                  Nueva carga
                </Button>
              </div>
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
                      className="p-4 bg-white border border-[#E2E8F0] rounded-lg hover:border-[#CBD5E1] transition-all group"
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
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-[#0F172A]">
                            ${Number(g.importe_total || 0).toLocaleString("es-AR")}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setGasoilDialog({
                                open: true,
                                editing: {
                                  id: g.id,
                                  fecha: g.fecha,
                                  litros: g.litros,
                                  km_odometro: g.km_odometro,
                                  importe_total: g.importe_total,
                                  estacion: g.estacion,
                                },
                              })
                            }
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-[#E1F5FE] text-[#0088D1]"
                            title="Editar carga"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteGasoil(g.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-50 text-red-500 hover:text-red-600"
                            title="Eliminar carga"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
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

          {activeTab === "docs" && docsLoaded && (
            <CamionDocumentosTab
              camion_id={camion.id}
              documentos={documentos}
              tipos={tipos}
              onRefresh={fetchDocs}
            />
          )}
          {activeTab === "docs" && !docsLoaded && (
            <div className="py-8 text-center text-sm text-[#64748B]">Cargando documentos...</div>
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

      <AddServiceDialog
        camiones={[camion]}
        defaultCamionId={camion.id}
        editing={serviceDialog.editing}
        open={serviceDialog.open}
        onOpenChange={(v) => setServiceDialog((prev) => ({ ...prev, open: v }))}
        onSaved={() => fetchServices(0)}
      />
      <AddGasoilDialog
        camiones={[camion]}
        defaultCamionId={camion.id}
        editing={gasoilDialog.editing}
        open={gasoilDialog.open}
        onOpenChange={(v) => setGasoilDialog((prev) => ({ ...prev, open: v }))}
        onSaved={() => fetchGasoil(0)}
      />
    </Dialog>
  );
}
