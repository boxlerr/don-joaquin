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
import InlineFeedback from "@/components/ui/InlineFeedback";
import {
  Trash2, Save, Truck, Wrench, Fuel, FileText, Calendar, MapPin, Plus, Pencil, Camera, Receipt,
} from "lucide-react";
import {
  updateCamionAction,
  deleteCamionAction,
  getServiceHistoryAction,
  getGasoilHistoryAction,
  getCamionDocumentosAction,
  deleteServiceAction,
  deleteGasoilAction,
  getFotosCamionAction,
} from "../actions";
import type {
  Camion,
  ServiceRecord,
  GasoilRecord,
  DocumentoVigenciaCamion,
  TipoDocumentoCamion,
  FotoCamion,
} from "../types";
import CamionDocumentosTab from "./CamionDocumentosTab";
import CamionFotosTab from "./CamionFotosTab";
import CamionGastosTab from "./CamionGastosTab";
import AddServiceDialog, { type ServiceEditing } from "./AddServiceDialog";
import AddGasoilDialog, { type GasoilEditing } from "./AddGasoilDialog";

type TabId = "info" | "fotos" | "services" | "gasoil" | "gastos" | "docs";

type FormData = {
  patente: string;
  marca: string;
  modelo: string;
  ano: string;
  capacidad_tn: string;
  tipo_camion: string;
  estado: string;
};

type FieldErrors = Partial<Record<keyof FormData, string>>;

const PATENTE_REGEX = /^[A-Z0-9\s-]{6,10}$/;
const CURRENT_YEAR = new Date().getFullYear();

const ESTADO_STYLES: Record<string, string> = {
  activo: "bg-[#ECFDF5] text-[#065F46] font-medium",
  en_mantenimiento: "bg-[#FEF3C7] text-[#92400E] font-medium",
  inactivo: "bg-muted text-muted-foreground font-medium",
  baja: "bg-[#FEF2F2] text-[#7F1D1D] font-medium",
};

const ESTADO_DOT: Record<string, string> = {
  activo: "bg-[#10B981]",
  en_mantenimiento: "bg-[#F59E0B]",
  inactivo: "bg-[#94A3B8]",
  baja: "bg-[#EF4444]",
};

function EstadoOption({ value, label }: { value: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`size-2 rounded-full ${ESTADO_DOT[value]}`} />
      {label}
    </span>
  );
}

function validate(data: FormData): FieldErrors {
  const errs: FieldErrors = {};
  if (!data.patente.trim()) errs.patente = "Patente requerida";
  else if (!PATENTE_REGEX.test(data.patente.trim())) errs.patente = "Formato inválido (ej: AB123CD)";
  if (!data.marca.trim()) errs.marca = "Marca requerida";
  if (!data.modelo.trim()) errs.modelo = "Modelo requerido";
  const ano = parseInt(data.ano);
  if (!Number.isFinite(ano)) errs.ano = "Año requerido";
  else if (ano < 1900 || ano > CURRENT_YEAR + 1) errs.ano = `Año entre 1900 y ${CURRENT_YEAR + 1}`;
  const cap = parseFloat(data.capacidad_tn);
  if (!Number.isFinite(cap) || cap <= 0) errs.capacidad_tn = "Capacidad mayor a 0";
  return errs;
}

function shallowEq(a: FormData, b: FormData): boolean {
  return (
    a.patente === b.patente &&
    a.marca === b.marca &&
    a.modelo === b.modelo &&
    a.ano === b.ano &&
    a.capacidad_tn === b.capacidad_tn &&
    a.tipo_camion === b.tipo_camion &&
    a.estado === b.estado
  );
}

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
  const [success, setSuccess] = useState<string | null>(null);

  const emptyForm: FormData = {
    patente: "",
    marca: "",
    modelo: "",
    ano: "",
    capacidad_tn: "",
    tipo_camion: "otro",
    estado: "activo",
  };
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [initialFormData, setInitialFormData] = useState<FormData>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Partial<Record<keyof FormData, boolean>>>({});

  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [servicesPage, setServicesPage] = useState(0);
  const [servicesHasMore, setServicesHasMore] = useState(false);
  const [loadingServices, setLoadingServices] = useState(false);

  const [gasoil, setGasoil] = useState<GasoilRecord[]>([]);
  const [gasoilPage, setGasoilPage] = useState(0);
  const [gasoilHasMore, setGasoilHasMore] = useState(false);
  const [loadingGasoil, setLoadingGasoil] = useState(false);

  const [documentos, setDocumentos] = useState<DocumentoVigenciaCamion[]>([]);
  const [tipos, setTipos] = useState<TipoDocumentoCamion[]>([]);
  const [docsLoaded, setDocsLoaded] = useState(false);

  const [fotos, setFotos] = useState<FotoCamion[]>([]);
  const [fotosLoaded, setFotosLoaded] = useState(false);

  const [serviceDialog, setServiceDialog] = useState<{ open: boolean; editing: ServiceEditing | null }>({
    open: false,
    editing: null,
  });
  const [gasoilDialog, setGasoilDialog] = useState<{ open: boolean; editing: GasoilEditing | null }>({
    open: false,
    editing: null,
  });

  useEffect(() => {
    if (camion && open) {
      const fresh: FormData = {
        patente: camion.patente || "",
        marca: camion.marca || "",
        modelo: camion.modelo || "",
        ano: camion.ano?.toString() || "",
        capacidad_tn: camion.capacidad_tn?.toString() || "",
        tipo_camion: camion.tipo_camion || "otro",
        estado: camion.estado || "activo",
      };
      setFormData(fresh);
      setInitialFormData(fresh);
      setFieldErrors({});
      setTouched({});
      setFotosLoaded(false);
      setDocsLoaded(false);
      setError(null);
      setSuccess(null);

      if (activeTab === "services") fetchServices(0);
      else if (activeTab === "gasoil") fetchGasoil(0);
      else if (activeTab === "docs") fetchDocs();
      else if (activeTab === "fotos") fetchFotos();
    }
  }, [camion?.id, open]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchServices = useCallback(async (page: number) => {
    setLoadingServices(true);
    try {
      const result = await getServiceHistoryAction(camion.id, page);
      setServices((prev) => page === 0 ? result.data as ServiceRecord[] : [...prev, ...result.data as ServiceRecord[]]);
      setServicesHasMore(result.hasMore);
      setServicesPage(page);
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

  const fetchFotos = useCallback(async () => {
    const result = await getFotosCamionAction(camion.id);
    setFotos(result.fotos as FotoCamion[]);
    setFotosLoaded(true);
  }, [camion?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    if (tab === "services") fetchServices(0);
    if (tab === "gasoil") fetchGasoil(0);
    if (tab === "docs") fetchDocs();
    if (tab === "fotos") fetchFotos();
  };

  const updateField = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    const next = { ...formData, [key]: value };
    setFormData(next);
    if (touched[key]) {
      const errs = validate(next);
      setFieldErrors((prev) => ({ ...prev, [key]: errs[key] }));
    }
  };

  const markTouched = (key: keyof FormData) => {
    setTouched((prev) => ({ ...prev, [key]: true }));
    const errs = validate(formData);
    setFieldErrors((prev) => ({ ...prev, [key]: errs[key] }));
  };

  const isDirty = !shallowEq(formData, initialFormData);
  const hasErrors = Object.values(fieldErrors).some(Boolean);

  const handleUpdate = async () => {
    const allErrs = validate(formData);
    if (Object.keys(allErrs).length > 0) {
      setFieldErrors(allErrs);
      setTouched({
        patente: true, marca: true, modelo: true, ano: true, capacidad_tn: true,
        tipo_camion: true, estado: true,
      });
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await updateCamionAction(camion.id, {
        patente: formData.patente.trim().toUpperCase(),
        marca: formData.marca.trim(),
        modelo: formData.modelo.trim(),
        ano: parseInt(formData.ano),
        capacidad_tn: parseFloat(formData.capacidad_tn),
        tipo_camion: formData.tipo_camion as "tractor" | "chasis_rigido" | "batea" | "otro",
        estado: formData.estado as "activo" | "inactivo" | "baja" | "en_mantenimiento",
      });
      if (result.error) {
        setError(result.error);
      } else {
        setInitialFormData(formData);
        setSuccess("Cambios guardados");
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
      if (result.error) setError(result.error);
      else onOpenChange(false);
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

  const requestClose = () => {
    if (isDirty && !confirm("Tenés cambios sin guardar. ¿Salir igual?")) return;
    onOpenChange(false);
  };

  if (!camion) return null;

  const fieldClass = (key: keyof FormData) => {
    const dirty = formData[key] !== initialFormData[key];
    const hasErr = !!fieldErrors[key];
    if (hasErr) return "border-red-300 focus-visible:ring-red-300";
    if (dirty) return "border-[#BAE6FD] focus-visible:ring-[#0088D1]/40";
    return "";
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) requestClose();
        else onOpenChange(v);
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-[680px] p-0 gap-0 overflow-hidden"
      >
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border bg-card">
          <div className="flex items-center justify-between mb-3">
            <Badge
              variant="outline"
              className="bg-muted/40 text-muted-foreground font-mono border-border text-xs"
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
          <DialogTitle className="text-xl font-bold text-foreground flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#0088D1]/10 flex items-center justify-center text-primary shrink-0">
              <Truck size={20} />
            </div>
            {camion.patente}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm mt-0.5">
            {camion.marca} {camion.modelo} — {camion.ano}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center px-6 border-b border-border bg-muted/40 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {[
            { id: "info" as TabId, label: "Información", icon: Truck },
            { id: "fotos" as TabId, label: "Fotos", icon: Camera },
            { id: "services" as TabId, label: "Services", icon: Wrench },
            { id: "gasoil" as TabId, label: "Gasoil", icon: Fuel },
            { id: "gastos" as TabId, label: "Gastos", icon: Receipt },
            { id: "docs" as TabId, label: "Documentos", icon: FileText },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
                activeTab === tab.id
                  ? "text-primary border-[#0088D1]"
                  : "text-muted-foreground border-transparent hover:text-foreground"
              }`}
            >
              <tab.icon size={15} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto max-h-[50vh] p-6 bg-card">
          {error && (
            <div className="mb-4">
              <InlineFeedback variant="error" message={error} onDismiss={() => setError(null)} autoHideMs={0} />
            </div>
          )}
          {success && activeTab === "info" && (
            <div className="mb-4">
              <InlineFeedback variant="success" message={success} onDismiss={() => setSuccess(null)} />
            </div>
          )}

          {activeTab === "info" && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-[#1E293B]">Patente</Label>
                  <Input
                    value={formData.patente}
                    onChange={(e) => updateField("patente", e.target.value.toUpperCase())}
                    onBlur={() => markTouched("patente")}
                    className={fieldClass("patente")}
                  />
                  {fieldErrors.patente && <p className="text-xs text-red-600">{fieldErrors.patente}</p>}
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-[#1E293B]">Estado</Label>
                  <Select
                    value={formData.estado}
                    onValueChange={(val) => updateField("estado", val ?? formData.estado)}
                  >
                    <SelectTrigger
                      className={`w-full ${ESTADO_STYLES[formData.estado] ?? ""} ${fieldClass("estado")}`}
                    >
                      <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="activo">
                        <EstadoOption value="activo" label="Activo" />
                      </SelectItem>
                      <SelectItem value="en_mantenimiento">
                        <EstadoOption value="en_mantenimiento" label="En Mantenimiento" />
                      </SelectItem>
                      <SelectItem value="inactivo">
                        <EstadoOption value="inactivo" label="Inactivo" />
                      </SelectItem>
                      <SelectItem value="baja">
                        <EstadoOption value="baja" label="Baja" />
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-[#1E293B]">Marca</Label>
                  <Input
                    value={formData.marca}
                    onChange={(e) => updateField("marca", e.target.value)}
                    onBlur={() => markTouched("marca")}
                    className={fieldClass("marca")}
                  />
                  {fieldErrors.marca && <p className="text-xs text-red-600">{fieldErrors.marca}</p>}
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-[#1E293B]">Modelo</Label>
                  <Input
                    value={formData.modelo}
                    onChange={(e) => updateField("modelo", e.target.value)}
                    onBlur={() => markTouched("modelo")}
                    className={fieldClass("modelo")}
                  />
                  {fieldErrors.modelo && <p className="text-xs text-red-600">{fieldErrors.modelo}</p>}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-[#1E293B]">Año</Label>
                  <Input
                    type="number"
                    value={formData.ano}
                    onChange={(e) => updateField("ano", e.target.value)}
                    onBlur={() => markTouched("ano")}
                    className={fieldClass("ano")}
                  />
                  {fieldErrors.ano && <p className="text-xs text-red-600">{fieldErrors.ano}</p>}
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-[#1E293B]">Capacidad (TN)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formData.capacidad_tn}
                    onChange={(e) => updateField("capacidad_tn", e.target.value)}
                    onBlur={() => markTouched("capacidad_tn")}
                    className={fieldClass("capacidad_tn")}
                  />
                  {fieldErrors.capacidad_tn && <p className="text-xs text-red-600">{fieldErrors.capacidad_tn}</p>}
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-[#1E293B]">Tipo</Label>
                  <Select
                    value={formData.tipo_camion}
                    onValueChange={(val) => updateField("tipo_camion", val ?? formData.tipo_camion)}
                  >
                    <SelectTrigger className={`w-full ${fieldClass("tipo_camion")}`}>
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

          {activeTab === "fotos" && (
            fotosLoaded ? (
              <CamionFotosTab camion_id={camion.id} fotos={fotos} onRefresh={fetchFotos} />
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">Cargando fotos...</div>
            )
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
                <div className="py-8 text-center text-sm text-muted-foreground">Cargando historial...</div>
              ) : services.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Wrench size={40} className="mb-3 opacity-20" />
                  <p className="text-sm">No hay services registrados.</p>
                </div>
              ) : (
                <>
                  {services.map((s) => (
                    <div
                      key={s.id}
                      className="p-4 bg-card border border-border rounded-lg hover:border-[#CBD5E1] transition-all group"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="secondary"
                            className="bg-[#E0F2FE] text-[#0369A1] hover:bg-[#E0F2FE]"
                          >
                            {s.tipo.replace("_", " ")}
                          </Badge>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar size={11} />
                            {new Date(s.fecha).toLocaleDateString("es-AR")}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-foreground">
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
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-[#E1F5FE] text-primary"
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
                      <p className="text-sm text-foreground font-medium mb-2">{s.descripcion}</p>
                      <div className="flex items-center gap-4 pt-2 border-t border-[#F1F5F9]">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Truck size={11} />
                          {s.km_odometro.toLocaleString()} KM
                        </span>
                        {s.taller && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
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
                <div className="py-8 text-center text-sm text-muted-foreground">Cargando historial...</div>
              ) : gasoil.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Fuel size={40} className="mb-3 opacity-20" />
                  <p className="text-sm">No hay cargas registradas.</p>
                </div>
              ) : (
                <>
                  {gasoil.map((g) => (
                    <div
                      key={g.id}
                      className="p-4 bg-card border border-border rounded-lg hover:border-[#CBD5E1] transition-all group"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-foreground flex items-center gap-1">
                            <Fuel size={12} className="text-primary" />
                            {g.litros.toLocaleString()} Lts
                          </span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar size={11} />
                            {new Date(g.fecha).toLocaleDateString("es-AR")}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-foreground">
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
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-[#E1F5FE] text-primary"
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
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
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

          {activeTab === "gastos" && <CamionGastosTab camionId={camion.id} />}

          {activeTab === "docs" && docsLoaded && (
            <CamionDocumentosTab
              camion_id={camion.id}
              documentos={documentos}
              tipos={tipos}
              onRefresh={fetchDocs}
            />
          )}
          {activeTab === "docs" && !docsLoaded && (
            <div className="py-8 text-center text-sm text-muted-foreground">Cargando documentos...</div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border bg-card">
          <Button
            variant="outline"
            onClick={requestClose}
            disabled={loading}
          >
            Cerrar
          </Button>
          {activeTab === "info" && (
            <Button
              variant="brand"
              onClick={handleUpdate}
              disabled={loading || !isDirty || hasErrors}
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
