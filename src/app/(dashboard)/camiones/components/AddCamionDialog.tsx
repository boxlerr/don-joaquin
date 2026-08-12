"use client";

import { useMemo, useState } from "react";
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
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import {
  Truck,
  Hash,
  Tag,
  Sliders,
  Calendar,
  Weight,
  Layers,
  Building2,
  Gauge,
  Check,
  type LucideIcon,
} from "lucide-react";
import InlineFeedback from "@/components/ui/InlineFeedback";

const FIELD_COMBO_TRIGGER =
  "h-full border-0 rounded-none bg-transparent hover:bg-transparent focus-visible:ring-0";
import type { Database } from "@/types/database";
import { addCamionAction } from "../actions";
import { useBorrador } from "@/hooks/useBorrador";
import { objetoCon } from "@/lib/borrador-local";
import AvisoBorrador from "@/components/borradores/AvisoBorrador";

type CamionTipo = Database["public"]["Enums"]["camion_tipo"];
type CamionEstado = Database["public"]["Enums"]["camion_estado"];
type TercerizacionEstado = Database["public"]["Enums"]["tercerizacion_estado"];

/** La unidad en blanco, para completar contra ella un borrador viejo. */
const CAMION_VACIO = {
  patente: "",
  estado: "activo" as CamionEstado,
  marca: "",
  modelo: "",
  ano: "",
  capacidad: "",
  tipo: "otro" as CamionTipo,
  tercerizacion: "interno" as TercerizacionEstado,
  esTolva: false,
  kmActual: "",
};

const TERCERIZACIONES: { value: TercerizacionEstado; label: string }[] = [
  { value: "interno", label: "Interno" },
  { value: "en_transicion", label: "En transición" },
  { value: "tercerizado", label: "Tercerizado" },
];

// Mismas reglas que el server action — auto-sugerencia al elegir marca.
// El usuario puede sobrescribir manualmente.
function inferTercerizacion(marca: string): TercerizacionEstado {
  const m = marca.trim().toLowerCase();
  if (m === "scania") return "tercerizado";
  if (m === "iveco") return "en_transicion";
  return "interno";
}

const PATENTE_REGEX = /^[A-Z0-9\s-]{6,10}$/;
const CURRENT_YEAR = new Date().getFullYear();

const ESTADOS = [
  { value: "activo", label: "Activo" },
  { value: "en_mantenimiento", label: "En Mantenimiento" },
  { value: "inactivo", label: "Inactivo" },
  { value: "baja", label: "Baja" },
];

const TIPOS = [
  { value: "tractor", label: "Tractor" },
  { value: "chasis_rigido", label: "Chasis Rígido" },
  { value: "batea", label: "Batea" },
  { value: "otro", label: "Otro" },
];

type FieldErrors = {
  patente?: string;
  marca?: string;
  modelo?: string;
  ano?: string;
  capacidad?: string;
  km_actual?: string;
};

export default function AddCamionDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [patente, setPatente] = useState("");
  const [estado, setEstado] = useState<CamionEstado>("activo");
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [ano, setAno] = useState("");
  const [capacidad, setCapacidad] = useState("");
  const [tipo, setTipo] = useState<CamionTipo>("otro");
  const [tercerizacion, setTercerizacion] = useState<TercerizacionEstado>("interno");
  // True hasta que el usuario tipea explícitamente en el select — controla la auto-sugerencia.
  const [tercerizacionAutoSugerida, setTercerizacionAutoSugerida] = useState(true);
  const [esTolva, setEsTolva] = useState(false);
  const [kmActual, setKmActual] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  // ── Borrador: el alta de una unidad son doce campos y se perdía entera al
  // cerrar el diálogo sin querer.
  const valorBorrador = useMemo(
    () => ({ patente, estado, marca, modelo, ano, capacidad, tipo, tercerizacion, esTolva, kmActual }),
    [patente, estado, marca, modelo, ano, capacidad, tipo, tercerizacion, esTolva, kmActual],
  );

  const borrador = useBorrador({
    pantalla: "camiones-nuevo",
    valor: valorBorrador,
    normalizar: objetoCon(CAMION_VACIO),
    hayDatos: (v) => v.patente.trim() !== "" || v.marca.trim() !== "" || v.modelo.trim() !== "",
    activo: open,
  });

  const recuperarBorrador = () => {
    const b = borrador.recuperar();
    if (!b) return;
    setPatente(b.patente);
    setEstado(b.estado);
    setMarca(b.marca);
    setModelo(b.modelo);
    setAno(b.ano);
    setCapacidad(b.capacidad);
    setTipo(b.tipo);
    setTercerizacion(b.tercerizacion);
    // Lo recuperado es lo que la persona ya eligió: la sugerencia automática
    // de tercerización no tiene que volver a pisarlo.
    setTercerizacionAutoSugerida(false);
    setEsTolva(b.esTolva);
    setKmActual(b.kmActual);
  };

  const handleMarcaChange = (value: string) => {
    setMarca(value);
    // Solo auto-sugerir si el usuario no eligió manualmente todavía.
    if (tercerizacionAutoSugerida) {
      setTercerizacion(inferTercerizacion(value));
    }
  };

  const handleTercerizacionChange = (value: TercerizacionEstado) => {
    setTercerizacion(value);
    setTercerizacionAutoSugerida(false);
  };

  const validate = (): FieldErrors => {
    const e: FieldErrors = {};
    if (!patente.trim()) e.patente = "Patente requerida";
    else if (!PATENTE_REGEX.test(patente.trim())) e.patente = "Formato inválido (ej: AB123CD)";
    if (!marca.trim()) e.marca = "Marca requerida";
    if (!modelo.trim()) e.modelo = "Modelo requerido";
    const anoN = parseInt(ano);
    if (!Number.isFinite(anoN)) e.ano = "Año requerido";
    else if (anoN < 1900 || anoN > CURRENT_YEAR + 1) e.ano = `Año entre 1900 y ${CURRENT_YEAR + 1}`;
    const capN = parseFloat(capacidad);
    if (!Number.isFinite(capN) || capN <= 0) e.capacidad = "Capacidad mayor a 0";
    if (kmActual.trim() !== "") {
      const kmN = parseFloat(kmActual);
      if (!Number.isFinite(kmN) || kmN < 0) e.km_actual = "Km debe ser ≥ 0";
    }
    return e;
  };

  const reset = () => {
    setPatente("");
    setEstado("activo");
    setMarca("");
    setModelo("");
    setAno("");
    setCapacidad("");
    setTipo("otro");
    setTercerizacion("interno");
    setTercerizacionAutoSugerida(true);
    setEsTolva(false);
    setKmActual("");
    setErrors({});
    setError(null);
    setSuccess(null);
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
      const kmActualNum = kmActual.trim() === "" ? null : parseFloat(kmActual);
      const result = await addCamionAction({
        patente: patente.trim().toUpperCase(),
        marca: marca.trim(),
        modelo: modelo.trim(),
        ano: parseInt(ano),
        capacidad_tn: parseFloat(capacidad),
        tipo_camion: tipo,
        estado,
        tercerizacion_estado: tercerizacion,
        es_tolva: esTolva,
        km_actual: kmActualNum,
      });

      if (result.error) {
        setError(result.error);
      } else {
        setSuccess("Camión registrado");
        setTimeout(() => {
          setOpen(false);
          reset();
          // El camión ya entró: recién ahora el borrador sobra.
          borrador.limpiar();
        }, 900);
      }
    } catch {
      setError("Ocurrió un error inesperado.");
    } finally {
      setLoading(false);
    }
  };

  const getEstadoDotColor = (val: string) => {
    switch (val) {
      case "activo":
        return "bg-[#10B981]";
      case "en_mantenimiento":
        return "bg-[#F59E0B]";
      case "inactivo":
        return "bg-[#94A3B8]";
      case "baja":
        return "bg-[#EF4444]";
      default:
        return "bg-slate-400";
    }
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
      <DialogContent className="sm:max-w-[500px] p-4 sm:p-6 gap-0">
        {/* Header — los márgenes negativos tienen que seguir al padding del
            diálogo (16px en celular, 24 desde sm) o el borde queda descolocado. */}
        <DialogHeader className="border-b border-border pb-4 -mx-4 px-4 sm:-mx-6 sm:px-6 pt-1">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="flex items-center justify-center size-12 rounded-full bg-[#E1F5FE] text-primary shrink-0">
              <Truck size={22} />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-foreground text-lg font-bold">
                Agregar nuevo camión
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs font-medium mt-0.5">
                Ingresá los datos del vehículo para registrarlo en la flota.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-5">
          {borrador.pendiente && (
            <AvisoBorrador
              ts={borrador.pendiente.ts}
              onRecuperar={recuperarBorrador}
              onDescartar={borrador.descartar}
            />
          )}

          {error && <InlineFeedback variant="error" message={error} onDismiss={() => setError(null)} autoHideMs={0} />}
          {success && <InlineFeedback variant="success" message={success} onDismiss={() => setSuccess(null)} />}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Patente */}
            <InputFieldWithIcon
              label="Patente *"
              name="patente"
              placeholder="Ej: AB123CD"
              required
              value={patente}
              onChange={(e) => setPatente(e.target.value.toUpperCase())}
              onBlur={() => setErrors(validate())}
              icon={Hash}
              error={errors.patente}
            />

            {/* Estado */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">Estado *</Label>
              <div className="relative flex items-center h-10 w-full rounded-lg border border-border bg-card overflow-hidden focus-within:ring-2 focus-within:ring-[#0088D1]/20 focus-within:border-[#0088D1] transition-all">
                <div className="flex items-center justify-center w-10 h-full border-r border-border bg-muted/50 shrink-0">
                  <span className={`size-2.5 rounded-full ${getEstadoDotColor(estado)}`} />
                </div>
                <div className="relative flex-1 h-full">
                  <Combobox
                    name="estado"
                    value={estado}
                    onValueChange={(v) => setEstado(v as CamionEstado)}
                    options={ESTADOS.map((e) => ({ id: e.value, label: e.label }))}
                    searchable={false}
                    triggerClassName={`${FIELD_COMBO_TRIGGER} font-medium`}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Marca */}
            <InputFieldWithIcon
              label="Marca *"
              name="marca"
              placeholder="Ej: Mercedes Benz"
              required
              value={marca}
              onChange={(e) => handleMarcaChange(e.target.value)}
              onBlur={() => setErrors(validate())}
              icon={Tag}
              error={errors.marca}
            />

            {/* Modelo */}
            <InputFieldWithIcon
              label="Modelo *"
              name="modelo"
              placeholder="Ej: Actros 2548"
              required
              value={modelo}
              onChange={(e) => setModelo(e.target.value)}
              onBlur={() => setErrors(validate())}
              icon={Sliders}
              error={errors.modelo}
            />
          </div>

          {/* Año y capacidad son cortos y entran de a dos en celular; el tipo,
              que es un desplegable con etiquetas largas, se lleva la fila. */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            <InputFieldWithIcon
              label="Año *"
              name="ano"
              type="number"
              placeholder="Ej: 2022"
              required
              value={ano}
              onChange={(e) => setAno(e.target.value)}
              onBlur={() => setErrors(validate())}
              icon={Calendar}
              error={errors.ano}
            />

            {/* Capacidad */}
            <InputFieldWithIcon
              label="Capacidad (TN) *"
              name="capacidad"
              type="number"
              placeholder="Ej: 35.0"
              required
              value={capacidad}
              onChange={(e) => setCapacidad(e.target.value)}
              onBlur={() => setErrors(validate())}
              icon={Weight}
              error={errors.capacidad}
            />

            {/* Tipo */}
            <div className="col-span-2 sm:col-span-1">
              <SelectFieldWithIcon
                label="Tipo *"
                name="tipo"
                value={tipo}
                onValueChange={(v) => setTipo(v as CamionTipo)}
                options={TIPOS}
                required
                icon={Layers}
              />
            </div>
          </div>

          {/* Tercerización + Km actual */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SelectFieldWithIcon
              label="Tercerización *"
              name="tercerizacion_estado"
              value={tercerizacion}
              onValueChange={(v) => handleTercerizacionChange(v as TercerizacionEstado)}
              options={TERCERIZACIONES}
              required
              icon={Building2}
            />

            <InputFieldWithIcon
              label="Km actual"
              name="km_actual"
              type="number"
              placeholder="Opcional"
              value={kmActual}
              onChange={(e) => setKmActual(e.target.value)}
              onBlur={() => setErrors(validate())}
              icon={Gauge}
              error={errors.km_actual}
            />
          </div>

          {/* Es tolva */}
          <label
            className={`inline-flex items-center gap-2.5 h-10 px-3 rounded-lg border bg-card cursor-pointer transition-colors w-fit ${
              esTolva
                ? "border-[#0088D1] bg-[#E1F5FE]"
                : "border-border hover:border-[#CBD5E1]"
            }`}
          >
            <input
              type="checkbox"
              checked={esTolva}
              onChange={(e) => setEsTolva(e.target.checked)}
              className="size-4 accent-[#0088D1]"
            />
            <span className="text-sm font-medium text-foreground">
              Es tolva
            </span>
            <span className="text-xs text-muted-foreground">
              (acoplado especializado)
            </span>
          </label>

          {/* Footer */}
          <div className="flex flex-col-reverse gap-2 pt-4 mt-6 border-t border-border -mx-4 px-4 sm:-mx-6 sm:px-6 sm:flex-row sm:justify-end sm:gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="h-10 w-full sm:w-auto px-6 rounded-lg text-sm font-semibold border border-border text-muted-foreground hover:bg-muted/40 transition-colors"
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-[#0088D1] hover:bg-[#0277BD] text-white flex w-full sm:w-auto items-center justify-center gap-1.5 h-10 px-6 rounded-lg font-bold shadow-sm hover:shadow transition-all disabled:opacity-50"
            >
              {loading ? (
                "Guardando..."
              ) : (
                <>
                  <Check size={16} strokeWidth={2.5} /> Guardar camión
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Subcomponente Input con Icono incorporado
function InputFieldWithIcon({
  label,
  name,
  id,
  type = "text",
  placeholder,
  required,
  value,
  onChange,
  onBlur,
  error,
  icon: Icon,
}: {
  label: string;
  name: string;
  id?: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
  error?: string;
  icon: LucideIcon;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs font-semibold text-muted-foreground">{label}</Label>
      <div className={`relative flex items-center h-10 w-full rounded-lg border bg-card overflow-hidden focus-within:ring-2 transition-all ${
        error ? "border-red-300 focus-within:ring-red-100 focus-within:border-red-500" : "border-border focus-within:ring-[#0088D1]/20 focus-within:border-[#0088D1]"
      }`}>
        <div className="flex items-center justify-center w-10 h-full border-r border-border bg-muted/50 text-primary shrink-0">
          <Icon size={15} />
        </div>
        <input
          id={id}
          name={name}
          type={type}
          placeholder={placeholder}
          required={required}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          className="flex-1 h-full px-3 text-sm bg-transparent border-0 outline-none focus:outline-none focus:ring-0 text-foreground"
        />
      </div>
    </div>
  );
}

// Subcomponente Select con Icono y Chevron
function SelectFieldWithIcon({
  label,
  name,
  id,
  value,
  onValueChange,
  options,
  required,
  error,
  icon: Icon,
}: {
  label: string;
  name: string;
  id?: string;
  value: string;
  onValueChange: (v: string) => void;
  options: { value: string; label: string }[];
  required?: boolean;
  error?: string;
  icon: LucideIcon;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs font-semibold text-muted-foreground">{label}</Label>
      <div className={`relative flex items-center h-10 w-full rounded-lg border bg-card overflow-hidden focus-within:ring-2 transition-all ${
        error ? "border-red-300 focus-within:ring-red-100 focus-within:border-red-500" : "border-border focus-within:ring-[#0088D1]/20 focus-within:border-[#0088D1]"
      }`}>
        <div className="flex items-center justify-center w-10 h-full border-r border-border bg-muted/50 text-primary shrink-0">
          <Icon size={15} />
        </div>
        <Combobox
          id={id}
          name={name}
          value={value}
          required={required}
          onValueChange={onValueChange}
          options={options.map((o) => ({ id: o.value, label: o.label }))}
          searchable={false}
          triggerClassName={FIELD_COMBO_TRIGGER}
        />
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
