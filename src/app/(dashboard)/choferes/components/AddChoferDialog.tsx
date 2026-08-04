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
  Home,
  Landmark,
  CreditCard,
  AtSign,
  FileText,
  LifeBuoy,
  KeyRound,
  Save,
  Cake,
  Map,
} from "lucide-react";
import { addChoferAction } from "../actions";
import { coincideBusqueda } from "@/lib/texto";

const FIELD_COMBO_TRIGGER =
  "h-full border-0 rounded-none bg-transparent hover:bg-transparent focus-visible:ring-0";
import {
  getLegajoEstado,
  formatCuil,
  normalizarDni,
  validarCuil,
  validarDni,
  validarFechasLegajo,
} from "@/lib/chofer-validation";

// ---------------------------------------------------------------------------
// Localidades / provincias
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

const PROVINCIAS_AR = [
  "Buenos Aires", "CABA", "Catamarca", "Chaco", "Chubut", "Córdoba",
  "Corrientes", "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja",
  "Mendoza", "Misiones", "Neuquén", "Río Negro", "Salta", "San Juan",
  "San Luis", "Santa Cruz", "Santa Fe", "Santiago del Estero",
  "Tierra del Fuego", "Tucumán",
];

const ESTADOS = [
  { value: "activo", label: "Activo" },
  { value: "inactivo", label: "Inactivo" },
];

const ROLES = [
  { value: "chofer", label: "Chofer" },
  { value: "administrativo", label: "Administrativo" },
  { value: "mantenimiento", label: "Mantenimiento" },
  { value: "fletero", label: "Fletero (tercerizado)" },
];

// ---------------------------------------------------------------------------
// Formulario
// El alta pide lo mismo que muestra el legajo: cargar a alguien y después tener
// que entrar a editarlo para completar domicilio, banco y AFIP era hacer dos
// veces el mismo trabajo.
// ---------------------------------------------------------------------------
type Rol = "chofer" | "administrativo" | "mantenimiento" | "fletero";

type FormLegajo = {
  rol: Rol;
  nombre: string;
  apellido: string;
  dni: string;
  cuil: string;
  fechaNacimiento: string;
  ciudadNacimiento: string;
  telefono: string;
  telefonoEmergencia: string;
  email: string;
  domicilio: string;
  localidad: string;
  provincia: string;
  estado: "activo" | "inactivo";
  fechaIngreso: string;
  altaAfip: string;
  iniciaPeriodoPrueba: boolean;
  nroTramiteDni: string;
  claveFiscal: string;
  banco: string;
  cbu: string;
  aliasCbu: string;
  observaciones: string;
};

const hoyIso = () => new Date().toISOString().split("T")[0];

const formVacio = (): FormLegajo => ({
  rol: "chofer",
  nombre: "",
  apellido: "",
  dni: "",
  cuil: "",
  fechaNacimiento: "",
  ciudadNacimiento: "",
  telefono: "",
  telefonoEmergencia: "",
  email: "",
  domicilio: "",
  localidad: "",
  provincia: "",
  estado: "activo",
  fechaIngreso: hoyIso(),
  altaAfip: hoyIso(),
  iniciaPeriodoPrueba: true,
  nroTramiteDni: "",
  claveFiscal: "",
  banco: "",
  cbu: "",
  aliasCbu: "",
  observaciones: "",
});

/** Campos escritos a mano: son los que deciden si hay algo que valga la pena guardar como borrador. */
const CAMPOS_CARGABLES: (keyof FormLegajo)[] = [
  "nombre", "apellido", "dni", "cuil", "fechaNacimiento", "ciudadNacimiento",
  "telefono", "telefonoEmergencia", "email", "domicilio", "localidad", "provincia",
  "nroTramiteDni", "claveFiscal", "banco", "cbu", "aliasCbu", "observaciones",
];

const tieneDatos = (f: FormLegajo): boolean =>
  CAMPOS_CARGABLES.some((k) => String(f[k] ?? "").trim() !== "");

// Borrador: si se cierra el modal sin querer, se corta la luz o el guardado
// falla, lo cargado sigue estando al volver. Se limpia recién cuando el legajo
// entró de verdad.
const DRAFT_KEY = "dj:legajo-nuevo:borrador";

type Borrador = { form: FormLegajo; ts: number };

function leerBorrador(): Borrador | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Borrador>;
    if (!parsed?.form || typeof parsed.form !== "object") return null;
    // Merge contra el vacío: un borrador viejo (guardado antes de agregar
    // campos) no tiene que romper el formulario.
    return { form: { ...formVacio(), ...parsed.form }, ts: Number(parsed.ts) || 0 };
  } catch {
    return null;
  }
}

function fmtGuardado(ts: number): string {
  if (!ts) return "";
  return new Date(ts).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Validaciones
// El formato de DNI/CUIL vive en @/lib/chofer-validation: lo comparten el alta,
// la edición del legajo y el server action.
// ---------------------------------------------------------------------------
function validateTelefono(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "El teléfono es requerido.";
  if (digits.length < 10) return "El teléfono debe tener al menos 10 dígitos.";
  return null;
}

/**
 * Fin del período de prueba, o null si la fecha todavía no es una fecha.
 *
 * Mientras se cambia la fecha de ingreso, el input date pasa por "" (y por
 * fechas a medio escribir): con eso, `toISOString()` tiraba "Invalid time
 * value" en pleno render y se caía la pantalla entera — el "This page couldn't
 * load" que reportaba la oficina al corregir la fecha de ingreso.
 */
function addMonths(dateStr: string, months: number): string | null {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split("T")[0];
}

function fmtDate(iso: string): string {
  const [y, m, day] = iso.split("-");
  if (!y || !m || !day) return "—";
  return `${day}/${m}/${y}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function AddChoferDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const [form, setForm] = useState<FormLegajo>(formVacio);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Estado del borrador (cuándo se guardó y si lo retomamos al abrir).
  const [draftTs, setDraftTs] = useState<number | null>(null);
  const [draftRetomado, setDraftRetomado] = useState(false);
  // Se activa al abrir el modal y ya no se apaga: el autoguardado tiene que
  // seguir vivo después de cerrar (si no, el último tecleo antes de cerrar se
  // perdía) pero sin pisar el borrador guardado antes de que nadie lo abriera.
  const [modalUsado, setModalUsado] = useState(false);

  const set = <K extends keyof FormLegajo>(key: K, value: FormLegajo[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // Al abrir: si quedó algo a medio cargar, se retoma tal cual estaba.
  const handleOpenChange = (v: boolean) => {
    if (v) {
      setModalUsado(true);
      const guardado = leerBorrador();
      if (guardado && tieneDatos(guardado.form) && !tieneDatos(form)) {
        setForm(guardado.form);
        setDraftTs(guardado.ts);
        setDraftRetomado(true);
      }
    }
    setOpen(v);
  };

  // Autoguardado. Se guarda el formulario entero, no un campo a la vez: es lo
  // que hace que después de un corte se recupere el legajo tal cual estaba.
  useEffect(() => {
    if (!modalUsado) return;
    const t = setTimeout(() => {
      try {
        if (!tieneDatos(form)) {
          localStorage.removeItem(DRAFT_KEY);
          setDraftTs(null);
          return;
        }
        const ts = Date.now();
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ form, ts } satisfies Borrador));
        setDraftTs(ts);
      } catch {
        // localStorage lleno o bloqueado: el alta sigue funcionando igual.
      }
    }, 400);
    return () => clearTimeout(t);
  }, [form, modalUsado]);

  const descartarBorrador = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* nada que hacer */
    }
    setForm(formVacio());
    setFieldErrors({});
    setServerError(null);
    setDraftTs(null);
    setDraftRetomado(false);
  };

  // Solo bloquean campos sin los que no se puede identificar al chofer ni
  // los datos con formato inválido. Lo demás se guarda igual y queda como
  // "legajo incompleto" (banner + bloqueo en selectores de otros módulos).
  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.nombre.trim()) errors.nombre = "El nombre es requerido.";
    if (!form.apellido.trim()) errors.apellido = "El apellido es requerido.";
    // DNI/CUIL/teléfono: solo se validan si el usuario ingresó algo (formato).
    const dniErr = validarDni(form.dni);
    if (dniErr) errors.dni = dniErr;
    const cuilErr = validarCuil(form.cuil);
    if (cuilErr) errors.cuil = cuilErr;
    if (form.telefono.replace(/\D/g, "").length > 0) {
      const telErr = validateTelefono(form.telefono);
      if (telErr) errors.telefono = telErr;
    }
    const fechasErr = validarFechasLegajo({
      fecha_nacimiento: form.fechaNacimiento || null,
      fecha_ingreso: form.fechaIngreso || null,
    });
    if (fechasErr) {
      errors[fechasErr.campo === "fecha_nacimiento" ? "fechaNacimiento" : "fechaIngreso"] =
        fechasErr.mensaje;
    }
    const cbuDigitos = form.cbu.replace(/\D/g, "");
    if (cbuDigitos.length > 0 && cbuDigitos.length !== 22) {
      errors.cbu = "El CBU/CVU tiene 22 dígitos.";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Se calcula una vez: lo muestra el resumen y se manda al guardar.
  const finPeriodoPrueba = form.iniciaPeriodoPrueba ? addMonths(form.fechaIngreso, 6) : null;

  const legajoEstado = getLegajoEstado({
    nombre: form.nombre,
    apellido: form.apellido,
    dni: form.dni,
    cuil: form.cuil,
    telefono: form.telefono,
    localidad: form.localidad,
    fecha_ingreso: form.fechaIngreso,
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setServerError(null);
    try {
      const result = await addChoferAction({
        nombre: form.nombre,
        apellido: form.apellido,
        dni: form.dni.trim() || undefined,
        cuil: form.cuil.trim() || undefined,
        estado: form.estado,
        rol: form.rol,
        telefono: form.telefono.trim() || undefined,
        email: form.email.trim() || undefined,
        localidad: form.localidad.trim() || undefined,
        fecha_ingreso: form.fechaIngreso || undefined,
        alta_afip: form.altaAfip || undefined,
        periodo_prueba_fin: finPeriodoPrueba ?? undefined,
        fecha_nacimiento: form.fechaNacimiento || undefined,
        ciudad_nacimiento: form.ciudadNacimiento.trim() || undefined,
        domicilio: form.domicilio.trim() || undefined,
        provincia: form.provincia.trim() || undefined,
        telefono_emergencia: form.telefonoEmergencia.trim() || undefined,
        banco: form.banco.trim() || undefined,
        cbu: form.cbu.trim() || undefined,
        alias_cbu: form.aliasCbu.trim() || undefined,
        nro_tramite_dni: form.nroTramiteDni.trim() || undefined,
        clave_fiscal: form.claveFiscal.trim() || undefined,
        observaciones: form.observaciones.trim() || undefined,
      });
      if (result.error) {
        // El borrador queda: el error se resuelve y se reintenta con todo cargado.
        setServerError(result.error);
      } else {
        descartarBorrador();
        setOpen(false);
      }
    } catch {
      setServerError(
        "No se pudo guardar. Revisá la conexión y probá de nuevo — lo que cargaste queda guardado acá.",
      );
    } finally {
      setLoading(false);
    }
  };

  const getEstadoDotColor = (val: string) =>
    val === "activo" ? "bg-[#10B981]" : "bg-[#94A3B8]";

  return (
    // Cerrar NO borra lo cargado: queda de borrador y se retoma al volver a abrir.
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={children as React.ReactElement} />
      <DialogContent className="sm:max-w-[1060px] p-0 gap-0 grid-rows-[auto_1fr] overflow-hidden">
        <DialogHeader className="border-b border-border px-4 py-3 sm:px-6 sm:py-4">
          {/* `pr-10`: el botón de cerrar crece a 36px en touch (28 en desktop)
              y con `pr-8` el título le quedaba abajo. */}
          <div className="flex items-start gap-3 sm:gap-4 pr-10">
            {/* El círculo baja a 40px en celular: 48 + el texto no entraban. */}
            <div className="flex items-center justify-center size-10 sm:size-12 rounded-full bg-[#E1F5FE] text-primary shrink-0">
              <User size={22} />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-foreground text-lg font-bold">
                Agregar nuevo legajo
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs font-medium mt-0.5">
                Elegí el área / rol y cargá los datos del personal. Podés guardar aunque falten datos.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 space-y-4">
            {serverError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg font-medium">
                {serverError}
              </div>
            )}

            {draftRetomado && (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <Save size={13} className="text-primary" />
                <span>
                  Retomamos el borrador que había quedado
                  {draftTs ? <span className="font-medium text-foreground"> ({fmtGuardado(draftTs)})</span> : null}.
                </span>
                <button
                  type="button"
                  onClick={descartarBorrador}
                  className="font-medium text-foreground underline underline-offset-2 hover:text-primary"
                >
                  Empezar de cero
                </button>
              </div>
            )}

            {!legajoEstado.completo && (form.nombre.trim() || form.apellido.trim()) && (
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg space-y-1">
                <p className="font-semibold">Vas a guardar el legajo incompleto.</p>
                <p>
                  Faltan: <span className="font-medium">{legajoEstado.faltantes.join(", ")}</span>.
                  El chofer queda en el listado pero no podrá ser asignado a viajes ni siniestros hasta completar los datos.
                </p>
              </div>
            )}

            {/* Tres columnas: el legajo entero se ve de una, sin scrollear un formulario en fila india. */}
            <div className="grid items-start gap-x-6 gap-y-5 md:grid-cols-2 xl:grid-cols-3">
              <Seccion titulo="Datos personales" icon={User}>
                {/* Área / Rol — define en qué área entra este legajo (lo primero que se elige) */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-muted-foreground">Área / Rol *</Label>
                  <div className="relative flex items-center h-10 w-full rounded-lg border border-border bg-card overflow-hidden focus-within:ring-2 focus-within:ring-[#0088D1]/20 focus-within:border-[#0088D1] transition-all">
                    <div className="flex items-center justify-center w-10 h-full border-r border-border bg-muted/50 text-primary shrink-0">
                      <Briefcase size={15} />
                    </div>
                    <div className="relative flex-1 h-full">
                      <Combobox
                        name="rol"
                        value={form.rol}
                        onValueChange={(v) => set("rol", v as Rol)}
                        options={ROLES.map((r) => ({ id: r.value, label: r.label }))}
                        searchable={false}
                        triggerClassName={`${FIELD_COMBO_TRIGGER} font-medium`}
                      />
                    </div>
                  </div>
                </div>

                <InputFieldWithIcon
                  label="Nombre *"
                  name="nombre"
                  placeholder="Ej: Juan"
                  value={form.nombre}
                  onChange={(e) => set("nombre", e.target.value)}
                  icon={User}
                  error={fieldErrors.nombre}
                />
                <InputFieldWithIcon
                  label="Apellido *"
                  name="apellido"
                  placeholder="Ej: Pérez"
                  value={form.apellido}
                  onChange={(e) => set("apellido", e.target.value)}
                  icon={User}
                  error={fieldErrors.apellido}
                />
                <InputFieldWithIcon
                  label="DNI *"
                  name="dni"
                  placeholder="Ej: 12345678"
                  value={form.dni}
                  onChange={(e) => set("dni", normalizarDni(e.target.value))}
                  icon={Fingerprint}
                  error={fieldErrors.dni}
                />
                <InputFieldWithIcon
                  label="CUIL *"
                  name="cuil"
                  placeholder="Ej: 20-12345678-9"
                  value={form.cuil}
                  onChange={(e) => set("cuil", formatCuil(e.target.value))}
                  icon={Hash}
                  error={fieldErrors.cuil}
                />
                <InputFieldWithIcon
                  label="Fecha de nacimiento"
                  name="fecha_nacimiento"
                  type="date"
                  value={form.fechaNacimiento}
                  onChange={(e) => set("fechaNacimiento", e.target.value)}
                  icon={Cake}
                  error={fieldErrors.fechaNacimiento}
                />
                <InputFieldWithIcon
                  label="Ciudad de nacimiento"
                  name="ciudad_nacimiento"
                  placeholder="Ej: Azul"
                  value={form.ciudadNacimiento}
                  onChange={(e) => set("ciudadNacimiento", e.target.value)}
                  icon={MapPin}
                />
              </Seccion>

              <Seccion titulo="Contacto y domicilio" icon={Phone}>
                <InputFieldWithIcon
                  label="Teléfono *"
                  name="telefono"
                  placeholder="Ej: +54 9 341 000 0000"
                  value={form.telefono}
                  onChange={(e) => set("telefono", e.target.value)}
                  icon={Phone}
                  error={fieldErrors.telefono}
                />
                <InputFieldWithIcon
                  label="Teléfono de emergencia"
                  name="telefono_emergencia"
                  placeholder="A quién avisar"
                  value={form.telefonoEmergencia}
                  onChange={(e) => set("telefonoEmergencia", e.target.value)}
                  icon={LifeBuoy}
                />
                <InputFieldWithIcon
                  label="Email"
                  name="email"
                  type="email"
                  placeholder="Ej: juan@mail.com"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  icon={Mail}
                />
                <InputFieldWithIcon
                  label="Domicilio"
                  name="domicilio"
                  placeholder="Calle y número"
                  value={form.domicilio}
                  onChange={(e) => set("domicilio", e.target.value)}
                  icon={Home}
                />
                <ComboboxTextoLibre
                  label="Localidad *"
                  placeholder="Ej: Arrecifes"
                  value={form.localidad}
                  onChange={(v) => set("localidad", v)}
                  opciones={LOCALIDADES_AR}
                  icon={MapPin}
                  error={fieldErrors.localidad}
                />
                <ComboboxTextoLibre
                  label="Provincia"
                  placeholder="Ej: Buenos Aires"
                  value={form.provincia}
                  onChange={(v) => set("provincia", v)}
                  opciones={PROVINCIAS_AR}
                  icon={Map}
                />
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-muted-foreground">Estado *</Label>
                  <div className="relative flex items-center h-10 w-full rounded-lg border border-border bg-card overflow-hidden focus-within:ring-2 focus-within:ring-[#0088D1]/20 focus-within:border-[#0088D1] transition-all">
                    <div className="flex items-center justify-center w-10 h-full border-r border-border bg-muted/50 shrink-0">
                      <span className={`size-2.5 rounded-full ${getEstadoDotColor(form.estado)}`} />
                    </div>
                    <div className="relative flex-1 h-full">
                      <Combobox
                        name="estado"
                        value={form.estado}
                        onValueChange={(v) => set("estado", v as "activo" | "inactivo")}
                        options={ESTADOS.map((e) => ({ id: e.value, label: e.label }))}
                        searchable={false}
                        triggerClassName={`${FIELD_COMBO_TRIGGER} font-medium`}
                      />
                    </div>
                  </div>
                </div>
              </Seccion>

              <div className="space-y-5">
                <Seccion titulo="Laboral y AFIP" icon={Briefcase}>
                  <InputFieldWithIcon
                    label="Fecha de ingreso *"
                    name="fecha_ingreso"
                    type="date"
                    value={form.fechaIngreso}
                    onChange={(e) => set("fechaIngreso", e.target.value)}
                    icon={Calendar}
                    error={fieldErrors.fechaIngreso}
                  />
                  <InputFieldWithIcon
                    label="Alta AFIP"
                    name="alta_afip"
                    type="date"
                    value={form.altaAfip}
                    onChange={(e) => set("altaAfip", e.target.value)}
                    icon={Calendar}
                  />
                  <InputFieldWithIcon
                    label="Nº de trámite del DNI"
                    name="nro_tramite_dni"
                    placeholder="Ej: 00123456789"
                    value={form.nroTramiteDni}
                    onChange={(e) => set("nroTramiteDni", e.target.value)}
                    icon={Fingerprint}
                  />
                  <InputFieldWithIcon
                    label="Clave fiscal"
                    name="clave_fiscal"
                    placeholder="—"
                    value={form.claveFiscal}
                    onChange={(e) => set("claveFiscal", e.target.value)}
                    icon={KeyRound}
                  />

                  {/* Período de prueba */}
                  <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 space-y-2">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.iniciaPeriodoPrueba}
                        onChange={(e) => set("iniciaPeriodoPrueba", e.target.checked)}
                        className="size-4 rounded accent-[#0088D1] cursor-pointer"
                      />
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                        <ClipboardCheck size={15} className="text-primary" />
                        Iniciar período de prueba
                      </span>
                    </label>
                    {form.iniciaPeriodoPrueba && (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-6 text-xs text-muted-foreground">
                        {finPeriodoPrueba ? (
                          <>
                            <span>Inicio: <span className="font-mono text-foreground">{fmtDate(form.fechaIngreso)}</span></span>
                            <span className="text-border">→</span>
                            <span>Fin: <span className="font-mono font-semibold text-[#0088D1]">{fmtDate(finPeriodoPrueba)}</span></span>
                          </>
                        ) : (
                          <span>Se calcula cuando completes la fecha de ingreso.</span>
                        )}
                      </div>
                    )}
                  </div>
                </Seccion>

                <Seccion titulo="Datos bancarios" icon={Landmark}>
                  <InputFieldWithIcon
                    label="Banco"
                    name="banco"
                    placeholder="Ej: Nación"
                    value={form.banco}
                    onChange={(e) => set("banco", e.target.value)}
                    icon={Landmark}
                  />
                  <InputFieldWithIcon
                    label="CBU / CVU"
                    name="cbu"
                    placeholder="22 dígitos"
                    value={form.cbu}
                    onChange={(e) => set("cbu", e.target.value.replace(/\D/g, "").slice(0, 22))}
                    icon={CreditCard}
                    error={fieldErrors.cbu}
                  />
                  <InputFieldWithIcon
                    label="Alias CBU"
                    name="alias_cbu"
                    placeholder="Ej: juan.perez.mp"
                    value={form.aliasCbu}
                    onChange={(e) => set("aliasCbu", e.target.value)}
                    icon={AtSign}
                  />
                </Seccion>
              </div>
            </div>

            <div className="space-y-1 pt-1">
              <Label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <FileText size={13} className="text-primary" />
                Observaciones
              </Label>
              <textarea
                name="observaciones"
                rows={2}
                value={form.observaciones}
                onChange={(e) => set("observaciones", e.target.value)}
                placeholder="Lo que haya que dejar anotado del legajo…"
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none transition-all focus:border-[#0088D1] focus:ring-2 focus:ring-[#0088D1]/20"
              />
            </div>
          </div>

          {/* En celular el pie se apila: el aviso del borrador arriba y los
              botones a ancho completo abajo (lado a lado no entraban en 343px). */}
          <div className="flex flex-col gap-2 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-6">
            <div className="min-w-0 text-xs text-muted-foreground">
              {draftTs ? (
                <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="inline-flex items-center gap-1.5">
                    <Save size={13} className="text-primary" />
                    Borrador guardado {fmtGuardado(draftTs)}
                  </span>
                  <button
                    type="button"
                    onClick={descartarBorrador}
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    Descartar
                  </button>
                </span>
              ) : (
                <span>Se guarda solo mientras cargás: si cerrás o se corta, no se pierde.</span>
              )}
            </div>

            <div className="flex flex-shrink-0 flex-col-reverse gap-2 sm:flex-row sm:items-center sm:gap-3">
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
                {loading
                  ? "Guardando..."
                  : legajoEstado.completo
                    ? (<><Check size={16} strokeWidth={2.5} /> Guardar legajo</>)
                    : (<><Check size={16} strokeWidth={2.5} /> Guardar incompleto</>)}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Sección del formulario
// ---------------------------------------------------------------------------
function Seccion({
  titulo,
  icon: Icon,
  children,
}: {
  titulo: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-1.5 border-b border-border pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon size={13} className="text-primary" />
        {titulo}
      </h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// ComboboxTextoLibre — sugiere de una lista pero deja escribir cualquier cosa
// (las listas de localidades/provincias nunca están completas).
// ---------------------------------------------------------------------------
function ComboboxTextoLibre({
  label,
  placeholder,
  value,
  onChange,
  opciones,
  icon: Icon,
  error,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  opciones: string[];
  icon: React.ComponentType<{ size?: number }>;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = query.trim()
    ? opciones.filter((l) => coincideBusqueda(l, query)).slice(0, 8)
    : [];

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronización intencional al cambiar props/abrir (carga o reset de estado)
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

  const handleSelect = (opcion: string) => {
    setQuery(opcion);
    onChange(opcion);
    setOpen(false);
  };

  return (
    <div className="space-y-1" ref={containerRef}>
      <Label className="text-xs font-semibold text-muted-foreground">{label}</Label>
      <div className={`relative flex items-center h-10 w-full rounded-lg border bg-card overflow-visible focus-within:ring-2 transition-all ${
        error ? "border-red-300 focus-within:ring-red-100 focus-within:border-red-500" : "border-border focus-within:ring-[#0088D1]/20 focus-within:border-[#0088D1]"
      }`}>
        <div className="flex items-center justify-center w-10 h-full border-r border-border bg-muted/50 text-primary shrink-0 rounded-l-lg">
          <Icon size={15} />
        </div>
        <input
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={handleInput}
          onFocus={() => setOpen(true)}
          className="flex-1 h-full px-3 text-sm bg-transparent border-0 outline-none focus:outline-none focus:ring-0 text-foreground"
          autoComplete="off"
        />
        {open && filtered.length > 0 && (
          <ul className="absolute top-full left-0 right-0 mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
            {filtered.map((opcion) => (
              <li
                key={opcion}
                onMouseDown={(e) => { e.preventDefault(); handleSelect(opcion); }}
                className="px-3 py-2 text-sm cursor-pointer hover:bg-muted/60 text-foreground"
              >
                {opcion}
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
