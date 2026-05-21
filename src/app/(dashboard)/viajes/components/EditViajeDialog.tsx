"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Pencil,
  Calendar,
  User,
  LifeBuoy,
  Truck,
  Package,
  MapPin,
  Flag,
  Navigation,
  Scale,
  DollarSign,
  ChevronDown,
  Check,
  AlertTriangle,
  Loader2,
  FileText,
} from "lucide-react";
import InlineFeedback from "@/components/ui/InlineFeedback";
import {
  getViajeParaEditarAction,
  getViajeFormData,
  updateViajeAction,
  type ViajeParaEditar,
  type ViajeFormData,
} from "../actions";
import type { ViajeBasico } from "../types";

interface Props {
  viaje: ViajeBasico;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: (patch: Partial<ViajeBasico>) => void;
}

const ESTADOS = [
  { value: "pendiente", label: "Pendiente" },
  { value: "en_curso", label: "En curso" },
  { value: "cerrado", label: "Cerrado" },
];

export default function EditViajeDialog({ viaje, open, onOpenChange, onSuccess }: Props) {
  const [loadingData, setLoadingData] = useState(false);
  const [viajeData, setViajeData] = useState<ViajeParaEditar | null>(null);
  const [formOptions, setFormOptions] = useState<ViajeFormData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [fechaViaje, setFechaViaje] = useState("");
  const [estado, setEstado] = useState("pendiente");
  const [clienteId, setClienteId] = useState("");
  const [choferId, setChoferId] = useState("");
  const [camionId, setCamionId] = useState("");
  const [tipoCargaId, setTipoCargaId] = useState("");
  const [descripcionOtros, setDescripcionOtros] = useState("");
  const [origenNombre, setOrigenNombre] = useState("");
  const [destinoNombre, setDestinoNombre] = useState("");
  const [kmConCarga, setKmConCarga] = useState("0");
  const [kmVacios, setKmVacios] = useState("0");
  const [tonelaje, setTonelaje] = useState("0");
  const [montoFlete, setMontoFlete] = useState("0");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setLoadingData(true);
    setLoadError(null);
    setError(null);
    setFieldErrors({});

    Promise.all([
      getViajeParaEditarAction(viaje.id),
      getViajeFormData(),
    ]).then(([vd, fd]) => {
      if ("error" in vd) { setLoadError(vd.error); return; }
      if ("error" in fd) { setLoadError(fd.error); return; }

      setViajeData(vd);
      setFormOptions(fd);
      setFechaViaje(vd.fecha_viaje);
      setEstado(vd.estado);
      setClienteId(vd.cliente_id);
      setChoferId(vd.chofer_id);
      setCamionId(vd.camion_id);
      setTipoCargaId(vd.tipo_carga_id);
      setDescripcionOtros(vd.descripcion_otros ?? "");
      setOrigenNombre(vd.origen_nombre ?? "");
      setDestinoNombre(vd.destino_nombre ?? "");
      setKmConCarga(String(vd.km_con_carga));
      setKmVacios(String(vd.km_vacios));
      setTonelaje(String(vd.tonelaje_real));
      setMontoFlete(String(vd.monto_flete));
    }).finally(() => setLoadingData(false));
  }, [open, viaje.id]);

  const isFacturado = viaje.estado === "cerrado" && viaje.facturado;

  const isOtros =
    tipoCargaId === "otros" ||
    formOptions?.tipos_carga.find((t) => t.id === tipoCargaId)?.label.toLowerCase() === "otros";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});

    const result = await updateViajeAction(viaje.id, {
      fecha_viaje: fechaViaje,
      estado,
      cliente_id: clienteId,
      chofer_id: choferId,
      camion_id: camionId,
      tipo_carga_id: tipoCargaId,
      descripcion_otros: descripcionOtros.trim() || null,
      origen_nombre: origenNombre.trim() || null,
      destino_nombre: destinoNombre.trim() || null,
      km_con_carga: Number(kmConCarga) || 0,
      km_vacios: Number(kmVacios) || 0,
      tonelaje_real: Number(tonelaje) || 0,
      monto_flete: Number(montoFlete) || 0,
    });

    setSubmitting(false);

    if (!result?.ok) {
      if (result?.fieldErrors) setFieldErrors(result.fieldErrors);
      setError(result?.error ?? "Error al guardar los cambios.");
      return;
    }

    const clienteLabel = formOptions?.clientes.find((c) => c.id === clienteId)?.label;
    const choferLabel = formOptions?.choferes.find((c) => c.id === choferId)?.label;

    onSuccess({
      fecha_viaje: fechaViaje,
      estado,
      cliente: clienteLabel ?? viaje.cliente,
      chofer: choferLabel ?? viaje.chofer,
      origen: origenNombre.trim() || null,
      destino: destinoNombre.trim() || null,
      km_con_carga: Number(kmConCarga) || 0,
      km_vacios: Number(kmVacios) || 0,
      km_totales: (Number(kmConCarga) || 0) + (Number(kmVacios) || 0),
      toneladas: Number(tonelaje) || 0,
      monto_flete: Number(montoFlete) || null,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[95vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-[#E2E8F0]">
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center size-12 rounded-full bg-slate-100 text-slate-600 shrink-0">
              <Pencil size={20} />
            </div>
            <div>
              <DialogTitle className="text-[#0F172A] text-lg font-bold">
                Editar viaje {viaje.codigo}
              </DialogTitle>
              <DialogDescription className="text-[#64748B] text-xs font-medium mt-0.5">
                {viaje.cliente}
                {viaje.origen && viaje.destino ? ` · ${viaje.origen} → ${viaje.destino}` : ""}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loadingData ? (
          <div className="flex items-center justify-center py-16 gap-2 text-slate-500 text-sm">
            <Loader2 size={18} className="animate-spin" />
            Cargando datos del viaje...
          </div>
        ) : loadError ? (
          <div className="px-6 py-10 text-center text-red-600 text-sm font-medium">{loadError}</div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            {/* Alerta viaje facturado */}
            {isFacturado && (
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-300 rounded-lg px-4 py-3">
                <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-amber-800">
                    Viaje facturado — ya impactó en la caja
                  </p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Si cambiás el monto de flete, el movimiento en caja <strong>no se actualiza automáticamente</strong>. Ajustalo manualmente desde la sección Caja.
                  </p>
                </div>
              </div>
            )}

            {error && (
              <InlineFeedback
                variant="error"
                message={error}
                onDismiss={() => setError(null)}
                autoHideMs={0}
              />
            )}

            {/* Fecha y Estado */}
            <div className="grid grid-cols-2 gap-4">
              <CField
                label="Fecha del viaje *"
                icon={Calendar}
                error={fieldErrors.fecha_viaje}
              >
                <input
                  type="date"
                  value={fechaViaje}
                  onChange={(e) => setFechaViaje(e.target.value)}
                  required
                  className="flex-1 h-full px-3 text-sm bg-transparent border-0 outline-none text-[#0F172A]"
                />
              </CField>

              <CField label="Estado *" icon={ChevronDown} error={fieldErrors.estado}>
                <select
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                  className="flex-1 h-full px-3 pr-8 text-sm bg-transparent border-0 outline-none text-[#0F172A] appearance-none cursor-pointer"
                >
                  {ESTADOS.map((e) => (
                    <option key={e.value} value={e.value}>{e.label}</option>
                  ))}
                </select>
              </CField>
            </div>

            {/* Cliente */}
            <CField label="Cliente *" icon={User} error={fieldErrors.cliente_id}>
              <select
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value)}
                required
                className="flex-1 h-full px-3 pr-8 text-sm bg-transparent border-0 outline-none text-[#0F172A] appearance-none cursor-pointer"
              >
                <option value="" disabled>Seleccioná un cliente...</option>
                {formOptions?.clientes.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </CField>

            {/* Chofer y Camión */}
            <div className="grid grid-cols-2 gap-4">
              <CField label="Chofer *" icon={LifeBuoy} error={fieldErrors.chofer_id}>
                <select
                  value={choferId}
                  onChange={(e) => setChoferId(e.target.value)}
                  required
                  className="flex-1 h-full px-3 pr-8 text-sm bg-transparent border-0 outline-none text-[#0F172A] appearance-none cursor-pointer"
                >
                  <option value="" disabled>Seleccioná...</option>
                  {formOptions?.choferes.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </CField>

              <CField label="Camión *" icon={Truck} error={fieldErrors.camion_id}>
                <select
                  value={camionId}
                  onChange={(e) => setCamionId(e.target.value)}
                  required
                  className="flex-1 h-full px-3 pr-8 text-sm bg-transparent border-0 outline-none text-[#0F172A] appearance-none cursor-pointer"
                >
                  <option value="" disabled>Seleccioná...</option>
                  {formOptions?.camiones.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </CField>
            </div>

            {/* Tipo de carga */}
            <CField label="Tipo de carga *" icon={Package} error={fieldErrors.tipo_carga_id}>
              <select
                value={tipoCargaId}
                onChange={(e) => setTipoCargaId(e.target.value)}
                required
                className="flex-1 h-full px-3 pr-8 text-sm bg-transparent border-0 outline-none text-[#0F172A] appearance-none cursor-pointer"
              >
                <option value="" disabled>Seleccioná...</option>
                {formOptions?.tipos_carga.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </CField>

            {isOtros && (
              <CField label="Descripción de la carga *" icon={FileText}>
                <input
                  type="text"
                  value={descripcionOtros}
                  onChange={(e) => setDescripcionOtros(e.target.value)}
                  placeholder="Especificá el tipo de carga..."
                  required
                  className="flex-1 h-full px-3 text-sm bg-transparent border-0 outline-none text-[#0F172A]"
                />
              </CField>
            )}

            {/* Datalist puntos de ruta */}
            <datalist id="edit-puntos-ruta">
              {formOptions?.puntos_ruta.map((p) => (
                <option key={p.id} value={p.label} />
              ))}
            </datalist>

            {/* Origen y Destino */}
            <div className="grid grid-cols-2 gap-4">
              <CField label="Origen" icon={MapPin} error={fieldErrors.origen_nombre}>
                <input
                  type="text"
                  value={origenNombre}
                  onChange={(e) => setOrigenNombre(e.target.value)}
                  placeholder="Ciudad o lugar..."
                  list="edit-puntos-ruta"
                  className="flex-1 h-full px-3 text-sm bg-transparent border-0 outline-none text-[#0F172A]"
                />
              </CField>
              <CField label="Destino" icon={Flag} error={fieldErrors.destino_nombre}>
                <input
                  type="text"
                  value={destinoNombre}
                  onChange={(e) => setDestinoNombre(e.target.value)}
                  placeholder="Ciudad o lugar..."
                  list="edit-puntos-ruta"
                  className="flex-1 h-full px-3 text-sm bg-transparent border-0 outline-none text-[#0F172A]"
                />
              </CField>
            </div>

            {/* KM y Tonelaje */}
            <div className="grid grid-cols-3 gap-4">
              <CField label="Km con carga" icon={Navigation} error={fieldErrors.km_con_carga}>
                <input
                  type="number"
                  value={kmConCarga}
                  onChange={(e) => setKmConCarga(e.target.value)}
                  min="0"
                  className="flex-1 h-full px-3 text-sm bg-transparent border-0 outline-none text-[#0F172A]"
                />
              </CField>
              <CField label="Km vacíos" icon={Navigation} error={fieldErrors.km_vacios}>
                <input
                  type="number"
                  value={kmVacios}
                  onChange={(e) => setKmVacios(e.target.value)}
                  min="0"
                  className="flex-1 h-full px-3 text-sm bg-transparent border-0 outline-none text-[#0F172A]"
                />
              </CField>
              <CField label="Tonelaje (tn)" icon={Scale} error={fieldErrors.tonelaje_real}>
                <input
                  type="number"
                  value={tonelaje}
                  onChange={(e) => setTonelaje(e.target.value)}
                  min="0"
                  step="0.01"
                  className="flex-1 h-full px-3 text-sm bg-transparent border-0 outline-none text-[#0F172A]"
                />
              </CField>
            </div>

            {/* Monto de flete */}
            <CField label="Monto de flete (ARS)" icon={DollarSign} error={fieldErrors.monto_flete}>
              <input
                type="number"
                value={montoFlete}
                onChange={(e) => setMontoFlete(e.target.value)}
                min="0"
                className="flex-1 h-full px-3 text-sm bg-transparent border-0 outline-none text-[#0F172A]"
              />
            </CField>

            {/* Footer */}
            <div className="flex justify-end gap-3 pt-4 border-t border-border -mx-6 px-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
                className="h-10 px-6 rounded-lg text-sm font-semibold border border-[#E2E8F0] text-[#475569] hover:bg-[#F8FAFC]"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submitting || loadingData}
                className="bg-[#0F172A] hover:bg-[#1E293B] text-white flex items-center gap-1.5 h-10 px-6 rounded-lg font-bold shadow-sm"
              >
                {submitting ? (
                  <><Loader2 size={14} className="animate-spin" /> Guardando...</>
                ) : (
                  <><Check size={15} /> Guardar cambios</>
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CField({
  label,
  icon: Icon,
  error,
  children,
}: {
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-[#475569]">{label}</label>
      <div
        className={`relative flex items-center h-10 w-full rounded-lg border bg-white overflow-hidden focus-within:ring-2 transition-all ${
          error
            ? "border-red-300 focus-within:ring-red-100 focus-within:border-red-500"
            : "border-[#E2E8F0] focus-within:ring-[#0088D1]/20 focus-within:border-[#0088D1]"
        }`}
      >
        <div className="flex items-center justify-center w-10 h-full border-r border-[#E2E8F0] bg-slate-50/50 text-[#0088D1] shrink-0">
          <Icon size={15} />
        </div>
        {children}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
