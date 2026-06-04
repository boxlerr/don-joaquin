"use client";

import { useState, useRef, useEffect } from "react";
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
import { Combobox } from "@/components/ui/combobox";
import {
  User,
  Fingerprint,
  Phone,
  MapPin,
  Calendar,
  Check,
  Hash,
  Briefcase,
  Mail,
  ClipboardCheck,
} from "lucide-react";
import { addChoferAction } from "../actions";

const FIELD_COMBO_TRIGGER =
  "h-full border-0 rounded-none bg-transparent hover:bg-transparent focus-visible:ring-0 dark:bg-transparent dark:hover:bg-transparent";
import { getLegajoEstado } from "@/lib/chofer-validation";

// ---------------------------------------------------------------------------
// Localidades
// ---------------------------------------------------------------------------
const LOCALIDADES_AR = [
  "Arrecifes", "Azul", "Bahía Blanca", "Balcarce", "Baradero",
  "Brandsen", "Buenos Aires (CABA)", "Cañuelas", "Carmen de Areco",
  "Chivilcoy", "Chacabuco", "Chascomús", "Daireaux", "Dolores",
  "Ensenada", "Escobar", "Exaltación de la Cruz", "Florencio Varela",
  "General Alvear", "General Las Heras", "General Pueyrredón (Mar del Plata)",
  "General Rodríguez", "General San Martín", "González Catán",
  "Junín", "La Matanza", "La Plata", "Lanús", "Las Flores",
  "Leandro N. Alem", "Lincoln", "Lobos", "Lomas de Zamora",
  "Luján", "Magdalena", "Marcos Paz", "Mercedes", "Merlo",
  "Monte Hermoso", "Moreno", "Morón", "Navarro", "Necochea",
  "Nueve de Julio", "Olavarría", "Partido de La Costa", "Pehuajó",
  "Pergamino", "Pilar", "Quilmes", "Ramallo", "Ranchos", "Rauch",
  "Rivadavia", "Rojas", "Salto", "San Andrés de Giles", "San Antonio de Areco",
  "San Cayetano", "San Fernando", "San Isidro", "San Miguel",
  "San Nicolás de los Arroyos", "San Pedro", "Saladillo", "Suipacha",
  "Tandil", "Tigre", "Trenque Lauquen", "Tres Arroyos", "Veinticinco de Mayo",
  "Vicente López", "Zárate",
  // Otras provincias (ciudades grandes)
  "Córdoba", "Rosario", "Santa Fe", "Mendoza", "Tucumán",
  "Salta", "Resistencia", "Corrientes", "Paraná", "Posadas",
  "Neuquén", "Río Cuarto", "Mar del Plata", "San Juan", "San Luis",
  "Santiago del Estero", "La Rioja", "Catamarca", "Jujuy",
  "Formosa", "Santa Rosa (La Pampa)", "Viedma", "Rawson",
  "Ushuaia", "Río Gallegos", "Comodoro Rivadavia", "Bariloche",
];

const ESTADOS = [
  { value: "activo", label: "Activo" },
  { value: "inactivo", label: "Inactivo" },
];

const ROLES = [
  { value: "chofer", label: "Chofer" },
  { value: "administrativo", label: "Administrativo" },
  { value: "mantenimiento", label: "Mantenimiento" },
];

// ---------------------------------------------------------------------------
// Validaciones
// ---------------------------------------------------------------------------
const CUIL_PREFIXES = ["20", "23", "24", "27", "30", "33", "34"];

function formatCuil(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 10) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
}

function validateCuil(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "El CUIL es requerido.";
  if (digits.length !== 11) return "El CUIL debe tener 11 dígitos.";
  if (!CUIL_PREFIXES.includes(digits.slice(0, 2))) return "Prefijo de CUIL inválido.";
  return null;
}

function validateTelefono(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "El teléfono es requerido.";
  if (digits.length < 10) return "El teléfono debe tener al menos 10 dígitos.";
  return null;
}

function validateLocalidad(value: string): string | null {
  if (!value.trim()) return "La localidad es requerida.";
  return null;
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split("T")[0];
}

function fmtDate(iso: string): string {
  const [y, m, day] = iso.split("-");
  return `${day}/${m}/${y}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function AddChoferDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [dni, setDni] = useState("");
  const [cuil, setCuil] = useState("");
  const [estado, setEstado] = useState<"activo" | "inactivo">("activo");
  const [rol, setRol] = useState<"chofer" | "administrativo" | "mantenimiento">("chofer");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [localidad, setLocalidad] = useState("");
  const [fechaIngreso, setFechaIngreso] = useState(new Date().toISOString().split("T")[0]);
  const [altaAfip, setAltaAfip] = useState(new Date().toISOString().split("T")[0]);
  const [iniciaPeriodoPrueba, setIniciaPeriodoPrueba] = useState(true);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const reset = () => {
    setNombre(""); setApellido(""); setDni(""); setCuil("");
    const hoy = new Date().toISOString().split("T")[0];
    setEstado("activo"); setRol("chofer"); setTelefono(""); setEmail(""); setLocalidad("");
    setFechaIngreso(hoy); setAltaAfip(hoy); setIniciaPeriodoPrueba(true);
    setServerError(null); setFieldErrors({});
  };

  // Solo bloquean campos sin los que no se puede identificar al chofer ni
  // los datos con formato inválido. Lo demás se guarda igual y queda como
  // "legajo incompleto" (banner + bloqueo en selectores de otros módulos).
  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!nombre.trim()) errors.nombre = "El nombre es requerido.";
    if (!apellido.trim()) errors.apellido = "El apellido es requerido.";
    // CUIL/teléfono: solo se validan si el usuario ingresó algo (formato).
    if (cuil.replace(/\D/g, "").length > 0) {
      const cuilErr = validateCuil(cuil);
      if (cuilErr) errors.cuil = cuilErr;
    }
    if (telefono.replace(/\D/g, "").length > 0) {
      const telErr = validateTelefono(telefono);
      if (telErr) errors.telefono = telErr;
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const legajoEstado = getLegajoEstado({
    nombre, apellido, dni, cuil, telefono, localidad, fecha_ingreso: fechaIngreso,
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setServerError(null);
    try {
      const result = await addChoferAction({
        nombre,
        apellido,
        dni: dni.trim() || undefined,
        cuil: cuil.trim() || undefined,
        estado,
        rol,
        telefono: telefono.trim() || undefined,
        email: email.trim() || undefined,
        localidad: localidad.trim() || undefined,
        fecha_ingreso: fechaIngreso || undefined,
        alta_afip: altaAfip || undefined,
        periodo_prueba_fin: iniciaPeriodoPrueba && fechaIngreso ? addMonths(fechaIngreso, 6) : undefined,
      });
      if (result.error) {
        setServerError(result.error);
      } else {
        setOpen(false);
        reset();
      }
    } catch {
      setServerError("Ocurrió un error inesperado.");
    } finally {
      setLoading(false);
    }
  };

  const getEstadoDotColor = (val: string) =>
    val === "activo" ? "bg-[#10B981]" : "bg-[#94A3B8]";

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger render={children as React.ReactElement} />
      <DialogContent className="sm:max-w-[520px] p-6 gap-0">
        <DialogHeader className="border-b border-border pb-4 -mx-6 px-6 pt-1">
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center size-12 rounded-full bg-[#E1F5FE] text-primary shrink-0">
              <User size={22} />
            </div>
            <div>
              <DialogTitle className="text-foreground text-lg font-bold">
                Agregar nuevo chofer
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs font-medium mt-0.5">
                Ingresá los datos personales y de contacto del chofer.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-5">
          {serverError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg font-medium">
              {serverError}
            </div>
          )}

          {!legajoEstado.completo && (nombre.trim() || apellido.trim()) && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg space-y-1">
              <p className="font-semibold">Vas a guardar el legajo incompleto.</p>
              <p>
                Faltan: <span className="font-medium">{legajoEstado.faltantes.join(", ")}</span>.
                El chofer queda en el listado pero no podrá ser asignado a viajes ni siniestros hasta completar los datos.
              </p>
            </div>
          )}

          {/* Nombre + Apellido */}
          <div className="grid grid-cols-2 gap-4">
            <InputFieldWithIcon
              label="Nombre *"
              name="nombre"
              placeholder="Ej: Juan"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              icon={User}
              error={fieldErrors.nombre}
            />
            <InputFieldWithIcon
              label="Apellido *"
              name="apellido"
              placeholder="Ej: Pérez"
              value={apellido}
              onChange={(e) => setApellido(e.target.value)}
              icon={User}
              error={fieldErrors.apellido}
            />
          </div>

          {/* DNI + CUIL */}
          <div className="grid grid-cols-2 gap-4">
            <InputFieldWithIcon
              label="DNI *"
              name="dni"
              placeholder="Ej: 12345678"
              value={dni}
              onChange={(e) => setDni(e.target.value)}
              icon={Fingerprint}
              error={fieldErrors.dni}
            />
            <InputFieldWithIcon
              label="CUIL *"
              name="cuil"
              placeholder="Ej: 20-12345678-9"
              value={cuil}
              onChange={(e) => setCuil(formatCuil(e.target.value))}
              icon={Hash}
              error={fieldErrors.cuil}
            />
          </div>

          {/* Teléfono + Estado */}
          <div className="grid grid-cols-2 gap-4">
            <InputFieldWithIcon
              label="Teléfono *"
              name="telefono"
              placeholder="Ej: +54 9 341 000 0000"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              icon={Phone}
              error={fieldErrors.telefono}
            />
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
                    onValueChange={(v) => setEstado(v as "activo" | "inactivo")}
                    options={ESTADOS.map((e) => ({ id: e.value, label: e.label }))}
                    searchable={false}
                    triggerClassName={`${FIELD_COMBO_TRIGGER} font-medium`}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Email */}
          <InputFieldWithIcon
            label="Email"
            name="email"
            type="email"
            placeholder="Ej: juan@mail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            icon={Mail}
          />

          {/* Localidad */}
          <LocalidadCombobox
            value={localidad}
            onChange={setLocalidad}
            error={fieldErrors.localidad}
          />

          {/* Fecha de ingreso + Rol */}
          <div className="grid grid-cols-2 gap-4">
            <InputFieldWithIcon
              label="Fecha de ingreso *"
              name="fecha_ingreso"
              type="date"
              value={fechaIngreso}
              onChange={(e) => setFechaIngreso(e.target.value)}
              icon={Calendar}
              error={fieldErrors.fecha_ingreso}
            />
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">Rol</Label>
              <div className="relative flex items-center h-10 w-full rounded-lg border border-border bg-card overflow-hidden focus-within:ring-2 focus-within:ring-[#0088D1]/20 focus-within:border-[#0088D1] transition-all">
                <div className="flex items-center justify-center w-10 h-full border-r border-border bg-muted/50 text-primary shrink-0">
                  <Briefcase size={15} />
                </div>
                <div className="relative flex-1 h-full">
                  <Combobox
                    name="rol"
                    value={rol}
                    onValueChange={(v) => setRol(v as "chofer" | "administrativo" | "mantenimiento")}
                    options={ROLES.map((r) => ({ id: r.value, label: r.label }))}
                    searchable={false}
                    triggerClassName={`${FIELD_COMBO_TRIGGER} font-medium`}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Alta AFIP */}
          <InputFieldWithIcon
            label="Alta AFIP"
            name="alta_afip"
            type="date"
            value={altaAfip}
            onChange={(e) => setAltaAfip(e.target.value)}
            icon={Calendar}
          />

          {/* Período de prueba */}
          <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 space-y-2">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={iniciaPeriodoPrueba}
                onChange={(e) => setIniciaPeriodoPrueba(e.target.checked)}
                className="size-4 rounded accent-[#0088D1] cursor-pointer"
              />
              <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <ClipboardCheck size={15} className="text-primary" />
                Iniciar período de prueba
              </span>
            </label>
            {iniciaPeriodoPrueba && (
              <div className="flex items-center gap-4 pl-6 text-xs text-muted-foreground">
                <span>Inicio: <span className="font-mono text-foreground">{fmtDate(fechaIngreso)}</span></span>
                <span className="text-border">→</span>
                <span>Fin: <span className="font-mono font-semibold text-[#0088D1]">{fmtDate(addMonths(fechaIngreso, 6))}</span></span>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 mt-6 border-t border-border -mx-6 px-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="h-10 px-6 rounded-lg text-sm font-semibold border border-border text-muted-foreground hover:bg-muted/40 transition-colors"
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-[#0088D1] hover:bg-[#0277BD] text-white flex items-center justify-center gap-1.5 h-10 px-6 rounded-lg font-bold shadow-sm hover:shadow transition-all disabled:opacity-50"
            >
              {loading
                ? "Guardando..."
                : legajoEstado.completo
                  ? (<><Check size={16} strokeWidth={2.5} /> Guardar chofer</>)
                  : (<><Check size={16} strokeWidth={2.5} /> Guardar incompleto</>)}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// LocalidadCombobox
// ---------------------------------------------------------------------------
function LocalidadCombobox({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = query.trim()
    ? LOCALIDADES_AR.filter((l) =>
        l.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "")
          .includes(
            query.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "")
          )
      ).slice(0, 8)
    : [];

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    onChange(e.target.value);
    setOpen(true);
  };

  const handleSelect = (loc: string) => {
    setQuery(loc);
    onChange(loc);
    setOpen(false);
  };

  return (
    <div className="space-y-1" ref={containerRef}>
      <Label className="text-xs font-semibold text-muted-foreground">Localidad *</Label>
      <div className={`relative flex items-center h-10 w-full rounded-lg border bg-card overflow-visible focus-within:ring-2 transition-all ${
        error ? "border-red-300 focus-within:ring-red-100 focus-within:border-red-500" : "border-border focus-within:ring-[#0088D1]/20 focus-within:border-[#0088D1]"
      }`}>
        <div className="flex items-center justify-center w-10 h-full border-r border-border bg-muted/50 text-primary shrink-0 rounded-l-lg">
          <MapPin size={15} />
        </div>
        <input
          type="text"
          placeholder="Ej: Arrecifes"
          value={query}
          onChange={handleInput}
          onFocus={() => setOpen(true)}
          className="flex-1 h-full px-3 text-sm bg-transparent border-0 outline-none focus:outline-none focus:ring-0 text-foreground"
          autoComplete="off"
        />
        {open && filtered.length > 0 && (
          <ul className="absolute top-full left-0 right-0 mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
            {filtered.map((loc) => (
              <li
                key={loc}
                onMouseDown={(e) => { e.preventDefault(); handleSelect(loc); }}
                className="px-3 py-2 text-sm cursor-pointer hover:bg-muted/60 text-foreground"
              >
                {loc}
              </li>
            ))}
          </ul>
        )}
      </div>
      {error && <p className="text-red-500 text-xs mt-0.5">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// InputFieldWithIcon
// ---------------------------------------------------------------------------
function InputFieldWithIcon({
  label,
  name,
  id,
  type = "text",
  placeholder,
  value,
  onChange,
  error,
  icon: Icon,
}: {
  label: string;
  name: string;
  id?: string;
  type?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  icon: React.ComponentType<{ size?: number }>;
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
          value={value}
          onChange={onChange}
          className="flex-1 h-full px-3 text-sm bg-transparent border-0 outline-none focus:outline-none focus:ring-0 text-foreground"
        />
      </div>
      {error && <p className="text-red-500 text-xs mt-0.5">{error}</p>}
    </div>
  );
}
