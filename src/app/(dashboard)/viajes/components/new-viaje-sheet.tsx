"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/combobox";
import {
  Plus,
  X,
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
  Check,
  FileText,
  Hash,
  Route,
  CalendarOff,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";

/** Formatea "YYYY-MM-DD" como "DD/MM". */
function fmtDia(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}
import {
  createViajeAction,
  getKmHistoricoAction,
  type CreateViajeState,
  type ViajeFormData,
} from "../actions";

export default function NewViajeSheet({ data }: { data: ViajeFormData }) {
  const [open, setOpen] = useState(false);
  const [tipoCarga, setTipoCarga] = useState("");
  // Auto-camión: al elegir chofer, se pre-selecciona su camión asignado
  // (pero el usuario puede cambiarlo: los choferes rotan unidades).
  const [selectedChoferId, setSelectedChoferId] = useState("");
  const [selectedCamionId, setSelectedCamionId] = useState("");
  // Circuito: al elegirlo se autocompletan origen/destino y km (editables).
  const [selectedCircuitoId, setSelectedCircuitoId] = useState("");
  const [origen, setOrigen] = useState("");
  const [destino, setDestino] = useState("");
  const [kmConCarga, setKmConCarga] = useState("0");
  const [kmVacios, setKmVacios] = useState("0");
  // Aviso cuando los km se precargan desde el historial del par origen→destino.
  const [kmHistHint, setKmHistHint] = useState<string | null>(null);
  // Viaje de vuelta (opcional): se carga junto con la ida en el mismo submit.
  // El modo distingue si el camión vuelve vacío (sin flete) o cargado (puede
  // traer un material distinto).
  const [cargarVuelta, setCargarVuelta] = useState(false);
  const [vueltaModo, setVueltaModo] = useState<"vacio" | "cargado">("vacio");
  const [vOrigen, setVOrigen] = useState("");
  const [vDestino, setVDestino] = useState("");
  const [vKmConCarga, setVKmConCarga] = useState("0");
  const [vKmVacios, setVKmVacios] = useState("0");
  const [vTonelaje, setVTonelaje] = useState("0");
  const [vMonto, setVMonto] = useState("0");
  const [vMaterial, setVMaterial] = useState("");
  const [vNroYpf, setVNroYpf] = useState("");
  const router = useRouter();

  // Camión "habitual" del chofer seleccionado (puede no haber).
  const camionHabitualId =
    data.choferes.find((c) => c.id === selectedChoferId)?.camionId ?? null;
  const usandoCamionHabitual =
    !!camionHabitualId && selectedCamionId === camionHabitualId;
  const cambioDeCamion =
    !!selectedChoferId && !!selectedCamionId && !!camionHabitualId && !usandoCamionHabitual;

  // Aviso si el chofer elegido está (o estará pronto) de vacaciones/ausente.
  const choferAusencia =
    data.choferes.find((c) => c.id === selectedChoferId)?.ausencia ?? null;

  const [state, formAction] = useActionState<CreateViajeState, FormData>(
    createViajeAction,
    null,
  );

  const resetCampos = () => {
    setTipoCarga("");
    setSelectedChoferId("");
    setSelectedCamionId("");
    setSelectedCircuitoId("");
    setOrigen("");
    setDestino("");
    setKmConCarga("0");
    setKmVacios("0");
    setKmHistHint(null);
    setCargarVuelta(false);
    setVueltaModo("vacio");
    setVOrigen("");
    setVDestino("");
    setVKmConCarga("0");
    setVKmVacios("0");
    setVTonelaje("0");
    setVMonto("0");
    setVMaterial("");
    setVNroYpf("");
  };

  useEffect(() => {
    if (state?.ok) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronización intencional al cambiar props/abrir (carga o reset de estado)
      setOpen(false);
      resetCampos();
      window.dispatchEvent(new Event("viaje-created"));
      router.refresh();
    }
  }, [state, router]);

  // Autocompletar km desde el historial cuando hay origen + destino y todavía no
  // se cargaron km (ni a mano ni por circuito). Debounce para no pegarle al
  // server en cada tecla.
  useEffect(() => {
    const o = origen.trim();
    const d = destino.trim();
    if (!o || !d || o === "—" || d === "—") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- limpiar el aviso cuando el par queda incompleto
      setKmHistHint(null);
      return;
    }
    // No pisar km cargados a mano ni traídos por un circuito.
    if (kmConCarga !== "0" || kmVacios !== "0") return;
    let cancelado = false;
    const t = setTimeout(async () => {
      const res = await getKmHistoricoAction(o, d);
      if (cancelado || !res) return;
      setKmConCarga(String(res.km_con_carga));
      if (res.km_vacios) setKmVacios(String(res.km_vacios));
      setKmHistHint(`Km precargados del historial (${o} → ${d}). Editá si esta vez fue distinto.`);
    }, 450);
    return () => {
      cancelado = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo dispara al cambiar origen/destino
  }, [origen, destino]);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) resetCampos();
  };

  // Al elegir un circuito: autocompletar origen, destino y km (quedan editables).
  const handleCircuitoChange = (circuitoId: string) => {
    setSelectedCircuitoId(circuitoId);
    const c = data.circuitos.find((x) => x.id === circuitoId);
    if (c) {
      setOrigen(c.origen === "—" ? "" : c.origen);
      setDestino(c.destino === "—" ? "" : c.destino);
      setKmConCarga(String(c.km_con_carga));
      setKmVacios(String(c.km_vacios));
    }
  };

  const handleChoferChange = (choferId: string) => {
    setSelectedChoferId(choferId);
    // Pre-llenar con el camión habitual del chofer (es solo un default —
    // los choferes rotan unidades cuando hay enfermos o roturas).
    const chofer = data.choferes.find((c) => c.id === choferId);
    if (chofer?.camionId) {
      setSelectedCamionId(chofer.camionId);
    }
  };

  // Al activar la vuelta: prellenar origen/destino invertidos respecto de la ida
  // y, por defecto (vuelve vacío), llevar la distancia de la ida a "km vacíos".
  const handleToggleVuelta = (on: boolean) => {
    setCargarVuelta(on);
    if (on) {
      setVOrigen(destino);
      setVDestino(origen);
      setVueltaModo("vacio");
      setVKmConCarga("0");
      setVKmVacios(kmConCarga !== "0" ? kmConCarga : kmVacios);
      setVTonelaje("0");
      setVMonto("0");
      setVMaterial("");
      setVNroYpf("");
    }
  };

  // Al cambiar de modo movemos la distancia entre "km con carga" y "km vacíos"
  // para que no haya que recargarla a mano.
  const handleVueltaModo = (modo: "vacio" | "cargado") => {
    setVueltaModo(modo);
    if (modo === "cargado") {
      const dist = vKmVacios !== "0" ? vKmVacios : kmConCarga;
      setVKmConCarga(dist);
      setVKmVacios("0");
    } else {
      const dist = vKmConCarga !== "0" ? vKmConCarga : kmConCarga;
      setVKmVacios(dist);
      setVKmConCarga("0");
      setVTonelaje("0");
      setVMonto("0");
      setVMaterial("");
    }
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Button variant="brand" size="sm" onClick={() => setOpen(true)} className="bg-[#0088D1] hover:bg-[#0277BD] text-white">
        <Plus size={14} />
        Nuevo viaje
      </Button>

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup
          className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[min(640px,calc(100vw-2rem))] max-h-[95vh] flex flex-col bg-card rounded-[16px] shadow-2xl border border-border transition duration-150 ease-out data-ending-style:opacity-0 data-ending-style:scale-95 data-starting-style:opacity-0 data-starting-style:scale-95"
        >
          {/* Header */}
          <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-border">
            <div className="flex items-start gap-4">
              <div className="flex items-center justify-center size-12 rounded-full bg-[#E1F5FE] text-primary shrink-0">
                <Truck size={22} />
              </div>
              <div>
                <Dialog.Title className="text-foreground text-lg font-bold">
                  Nuevo viaje
                </Dialog.Title>
                <Dialog.Description className="text-muted-foreground text-xs font-medium mt-0.5">
                  Asociá chofer, camión, cliente y ruta. El código se genera automáticamente.
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close
              render={
                <button
                  type="button"
                  className="size-8 rounded-full text-muted-foreground hover:bg-muted inline-flex items-center justify-center transition-colors"
                  aria-label="Cerrar"
                />
              }
            >
              <X size={18} />
            </Dialog.Close>
          </div>

          {/* Form */}
          <form
            action={formAction}
            key={open ? "open" : "closed"}
            className="flex-1 overflow-y-auto px-6 py-5 space-y-4"
          >
            <input type="hidden" name="estado" value="pendiente" />

            <InputFieldWithIcon
              label="Fecha del viaje *"
              name="fecha_viaje"
              type="date"
              defaultValue={today}
              required
              icon={Calendar}
              error={state?.fieldErrors?.fecha_viaje}
            />

            {/* Cliente */}
            <SelectField
              label="Cliente *"
              name="cliente_id"
              options={data.clientes}
              required
              icon={User}
              error={state?.fieldErrors?.cliente_id}
              searchPlaceholder="Buscar cliente..."
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Chofer */}
              <SelectField
                label="Chofer *"
                name="chofer_id"
                options={data.choferes}
                required
                icon={LifeBuoy}
                error={state?.fieldErrors?.chofer_id}
                onValueChange={handleChoferChange}
                searchPlaceholder="Buscar chofer..."
              />
              {/* Camion — controlado para recibir auto-completado.
                  El chofer-camión es flexible: rotan unidades. */}
              <div>
                <SelectField
                  label="Camión *"
                  name="camion_id"
                  options={data.camiones}
                  required
                  icon={Truck}
                  error={state?.fieldErrors?.camion_id}
                  value={selectedCamionId}
                  onValueChange={setSelectedCamionId}
                  searchPlaceholder="Buscar patente..."
                />
                {usandoCamionHabitual && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Es el camión habitual de este chofer. Cambialo si esta vez manejó otro.
                  </p>
                )}
                {cambioDeCamion && (
                  <p className="mt-1 text-[11px] text-amber-700 font-medium">
                    Aviso: distinto al camión habitual de este chofer.
                  </p>
                )}
              </div>
            </div>

            {/* Aviso de vacaciones / ausencia del chofer elegido */}
            {choferAusencia && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 animate-in fade-in slide-in-from-top-1 duration-200">
                <CalendarOff size={15} className="mt-0.5 shrink-0" />
                <span>
                  {choferAusencia.enCurso ? (
                    <>
                      Este chofer está de <strong>{choferAusencia.tipo}</strong> (hasta el{" "}
                      <strong>{fmtDia(choferAusencia.hasta)}</strong>). Revisá antes de asignarle el viaje.
                    </>
                  ) : (
                    <>
                      Ojo: este chofer tiene <strong>{choferAusencia.tipo}</strong> del{" "}
                      <strong>{fmtDia(choferAusencia.desde)}</strong> al{" "}
                      <strong>{fmtDia(choferAusencia.hasta)}</strong>.
                    </>
                  )}
                </span>
              </div>
            )}

            {/* Tipo de Carga */}
            <SelectField
              label="Tipo de carga *"
              name="tipo_carga_id"
              options={data.tipos_carga}
              required
              icon={Package}
              error={state?.fieldErrors?.tipo_carga_id}
              onValueChange={setTipoCarga}
            />

            {/* Descripcion si es otros */}
            {tipoCarga === "otros" && (
              <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                <InputFieldWithIcon
                  label="Descripción de la carga *"
                  name="descripcion_otros"
                  placeholder="Especificá el tipo de carga..."
                  required
                  icon={FileText}
                />
              </div>
            )}

            <datalist id="puntos-ruta-list">
              {data.puntos_ruta.map((p) => (
                <option key={p.id} value={p.label} />
              ))}
            </datalist>

            {/* Circuito predefinido (opcional): autocompleta origen, destino y km */}
            {data.circuitos.length > 0 && (
              <SelectField
                label="Circuito (opcional)"
                name="ruta_id"
                options={data.circuitos.map((c) => ({ id: c.id, label: c.label }))}
                icon={Route}
                value={selectedCircuitoId}
                onValueChange={handleCircuitoChange}
                clearable
                searchPlaceholder="Buscar circuito..."
                hint="Elegí un circuito para autocompletar origen, destino y kilómetros."
              />
            )}

            {/* Ruta Origen / Destino */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputFieldWithIcon
                label="Origen"
                name="origen_nombre"
                placeholder="Escribí ciudad o lugar..."
                icon={MapPin}
                list="puntos-ruta-list"
                value={origen}
                onChange={setOrigen}
                error={state?.fieldErrors?.origen_nombre}
              />
              <InputFieldWithIcon
                label="Destino"
                name="destino_nombre"
                placeholder="Escribí ciudad o lugar..."
                icon={Flag}
                list="puntos-ruta-list"
                value={destino}
                onChange={setDestino}
                error={state?.fieldErrors?.destino_nombre}
              />
            </div>

            {/* Kms / Tonelaje */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <InputFieldWithIcon
                label="Km con carga"
                name="km_con_carga"
                type="number"
                value={kmConCarga}
                onChange={setKmConCarga}
                icon={Navigation}
                error={state?.fieldErrors?.km_con_carga}
              />
              <InputFieldWithIcon
                label="Km vacíos"
                name="km_vacios"
                type="number"
                value={kmVacios}
                onChange={setKmVacios}
                icon={Navigation}
                error={state?.fieldErrors?.km_vacios}
              />
              <InputFieldWithIcon
                label="Tonelaje (tn)"
                name="tonelaje_real"
                type="number"
                defaultValue="0"
                icon={Scale}
                error={state?.fieldErrors?.tonelaje_real}
              />
            </div>

            {kmHistHint && (
              <p className="-mt-2 flex items-center gap-1.5 text-[11px] text-[#0277BD] font-medium animate-in fade-in duration-200">
                <Navigation size={12} className="shrink-0" />
                {kmHistHint}
              </p>
            )}

            {/* Monto de Flete */}
            <InputFieldWithIcon
              label="Monto de flete (ARS)"
              name="monto_flete"
              type="number"
              defaultValue="0"
              icon={DollarSign}
              error={state?.fieldErrors?.monto_flete}
            />

            {/* Material (opcional) */}
            <InputFieldWithIcon
              label="Material"
              name="material"
              placeholder="Ej: Cemento, Clinker, Arena (opcional)"
              icon={Package}
              error={state?.fieldErrors?.material}
            />

            {/* Nº Viaje YPF (opcional) */}
            <InputFieldWithIcon
              label="Nº viaje YPF"
              name="nro_viaje_ypf"
              placeholder="Ej: 123456 (opcional)"
              icon={Hash}
              error={state?.fieldErrors?.nro_viaje_ypf}
            />

            {/* Viaje de vuelta (opcional): carga ida + vuelta en un solo submit */}
            <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={cargarVuelta}
                  onChange={(e) => handleToggleVuelta(e.target.checked)}
                  className="size-4 rounded accent-[#0088D1]"
                />
                <span className="text-sm font-semibold text-foreground inline-flex items-center gap-1.5">
                  <RotateCcw size={15} className="text-primary" />
                  Cargar viaje de vuelta
                </span>
              </label>

              <input type="hidden" name="cargar_vuelta" value={cargarVuelta ? "1" : "0"} />

              {cargarVuelta && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                  <input type="hidden" name="vuelta_modo" value={vueltaModo} />

                  {/* Modo: vuelve vacío / vuelve cargado */}
                  <div className="inline-flex rounded-lg border border-border overflow-hidden">
                    {([
                      { v: "vacio", label: "Vuelve vacío" },
                      { v: "cargado", label: "Vuelve cargado" },
                    ] as const).map((opt) => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => handleVueltaModo(opt.v)}
                        className={`px-4 h-9 text-xs font-semibold transition-colors ${
                          vueltaModo === opt.v
                            ? "bg-[#0088D1] text-white"
                            : "bg-card text-muted-foreground hover:bg-muted/40"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {/* Origen / destino de la vuelta (prellenados invertidos) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InputFieldWithIcon
                      label="Origen (vuelta)"
                      name="vuelta_origen_nombre"
                      placeholder="Escribí ciudad o lugar..."
                      icon={MapPin}
                      list="puntos-ruta-list"
                      value={vOrigen}
                      onChange={setVOrigen}
                      error={state?.fieldErrors?.vuelta_origen_nombre}
                    />
                    <InputFieldWithIcon
                      label="Destino (vuelta)"
                      name="vuelta_destino_nombre"
                      placeholder="Escribí ciudad o lugar..."
                      icon={Flag}
                      list="puntos-ruta-list"
                      value={vDestino}
                      onChange={setVDestino}
                      error={state?.fieldErrors?.vuelta_destino_nombre}
                    />
                  </div>

                  {vueltaModo === "cargado" ? (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <InputFieldWithIcon
                          label="Km con carga"
                          name="vuelta_km_con_carga"
                          type="number"
                          value={vKmConCarga}
                          onChange={setVKmConCarga}
                          icon={Navigation}
                          error={state?.fieldErrors?.vuelta_km_con_carga}
                        />
                        <InputFieldWithIcon
                          label="Km vacíos"
                          name="vuelta_km_vacios"
                          type="number"
                          value={vKmVacios}
                          onChange={setVKmVacios}
                          icon={Navigation}
                          error={state?.fieldErrors?.vuelta_km_vacios}
                        />
                        <InputFieldWithIcon
                          label="Tonelaje (tn)"
                          name="vuelta_tonelaje_real"
                          type="number"
                          value={vTonelaje}
                          onChange={setVTonelaje}
                          icon={Scale}
                          error={state?.fieldErrors?.vuelta_tonelaje_real}
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <InputFieldWithIcon
                          label="Material (vuelta)"
                          name="vuelta_material"
                          placeholder="Ej: Arena (opcional)"
                          value={vMaterial}
                          onChange={setVMaterial}
                          icon={Package}
                          error={state?.fieldErrors?.vuelta_material}
                        />
                        <InputFieldWithIcon
                          label="Monto de flete (ARS)"
                          name="vuelta_monto_flete"
                          type="number"
                          value={vMonto}
                          onChange={setVMonto}
                          icon={DollarSign}
                          error={state?.fieldErrors?.vuelta_monto_flete}
                        />
                        <InputFieldWithIcon
                          label="Nº viaje YPF"
                          name="vuelta_nro_viaje_ypf"
                          placeholder="Opcional"
                          value={vNroYpf}
                          onChange={setVNroYpf}
                          icon={Hash}
                          error={state?.fieldErrors?.vuelta_nro_viaje_ypf}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Vuelve vacío: sin flete, tonelaje ni material */}
                      <input type="hidden" name="vuelta_km_con_carga" value="0" />
                      <input type="hidden" name="vuelta_tonelaje_real" value="0" />
                      <input type="hidden" name="vuelta_monto_flete" value="0" />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <InputFieldWithIcon
                          label="Km recorridos (vacío)"
                          name="vuelta_km_vacios"
                          type="number"
                          value={vKmVacios}
                          onChange={setVKmVacios}
                          icon={Navigation}
                          error={state?.fieldErrors?.vuelta_km_vacios}
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        La vuelta vacía no factura ni suma tonelaje.
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>

            {state?.error && (
              <div className="bg-[#FEF2F2] border border-[#FECACA] text-[#7F1D1D] text-xs rounded-lg px-3 py-2 font-medium">
                {state.error}
              </div>
            )}

            {/* Footer */}
            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-10 px-6 rounded-lg text-sm font-semibold border border-border text-muted-foreground hover:bg-muted/40 transition-colors"
              >
                Cancelar
              </button>
              <SubmitButton />
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// Subcomponente Input con Icono incorporado
function InputFieldWithIcon({
  label,
  name,
  type = "text",
  placeholder,
  required,
  defaultValue,
  value,
  onChange,
  error,
  icon: Icon,
  list,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
  value?: string;
  onChange?: (v: string) => void;
  error?: string;
  icon: LucideIcon;
  list?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-muted-foreground">{label}</label>
      <div className={`relative flex items-center h-10 w-full rounded-lg border bg-card overflow-hidden focus-within:ring-2 transition-all ${
        error ? "border-red-300 focus-within:ring-red-100 focus-within:border-red-500" : "border-border focus-within:ring-[#0088D1]/20 focus-within:border-[#0088D1]"
      }`}>
        <div className="flex items-center justify-center w-10 h-full border-r border-border bg-muted/50 text-primary shrink-0">
          <Icon size={15} />
        </div>
        <input
          name={name}
          type={type}
          placeholder={placeholder}
          required={required}
          {...(value !== undefined
            ? { value, onChange: (e) => onChange?.(e.target.value) }
            : { defaultValue })}
          list={list}
          className="flex-1 h-full px-3 text-sm bg-transparent border-0 outline-none focus:outline-none focus:ring-0 text-foreground"
        />
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

// Boton de submit estilizado
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-[#0088D1] hover:bg-[#0277BD] text-white flex items-center justify-center gap-1.5 h-10 px-6 rounded-lg text-sm font-bold shadow-sm hover:shadow transition-all disabled:opacity-50"
    >
      {pending ? (
        "Guardando..."
      ) : (
        <>
          <Check size={16} strokeWidth={2.5} /> Guardar viaje
        </>
      )}
    </button>
  );
}
