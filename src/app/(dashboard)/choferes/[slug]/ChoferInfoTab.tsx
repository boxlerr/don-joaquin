"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { updateChoferInfoAction } from "./actions";
import type { ChoferDetail } from "./types";
import { Check, Pencil, X, AlertTriangle } from "lucide-react";

// Áreas / roles posibles del legajo. Solo "chofer" usa camión de la flota.
const ROLES: { value: string; label: string }[] = [
  { value: "chofer", label: "Chofer" },
  { value: "administrativo", label: "Administración" },
  { value: "mantenimiento", label: "Mantenimiento" },
  { value: "fletero", label: "Fletero (tercerizado)" },
];
const rolLabel = (r: string | null | undefined) =>
  ROLES.find((o) => o.value === (r || "chofer"))?.label ?? "Chofer";
import {
  getLegajoEstado,
  MENSAJE_LEGAJO_INCOMPLETO,
  formatCuil,
  normalizarDni,
  validarCuil,
  validarDni,
  validarFechasLegajo,
} from "@/lib/chofer-validation";
import CamionAsignacion from "./CamionAsignacion";
import EmergencyContactsEditor, { EmergencyContactsView, parseContactos } from "./EmergencyContactsEditor";

interface Props {
  chofer: ChoferDetail;
  onSaved?: () => void;
  // Edición controlada (legajo, el botón vive en el header). Si no se pasan, el
  // tab maneja su propio estado y muestra el botón "Editar datos" (uso en la lista).
  editing?: boolean;
  onEditingChange?: (v: boolean) => void;
}

export default function ChoferInfoTab({ chofer, onSaved, editing: editingProp, onEditingChange }: Props) {
  const controlled = onEditingChange !== undefined;
  const [editingLocal, setEditingLocal] = useState(false);
  const editing = controlled ? editingProp ?? false : editingLocal;
  const setEditing = (v: boolean) => {
    if (controlled) onEditingChange?.(v);
    else setEditingLocal(v);
  };
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [nombre, setNombre] = useState(chofer.nombre);
  const [apellido, setApellido] = useState(chofer.apellido);
  const [dni, setDni] = useState(chofer.dni ?? "");
  const [cuil, setCuil] = useState((chofer as { cuil?: string | null }).cuil ?? "");
  const [fechaNacimiento, setFechaNacimiento] = useState(chofer.fecha_nacimiento ?? "");
  const [fechaIngreso, setFechaIngreso] = useState(chofer.fecha_ingreso ?? "");
  const [email, setEmail] = useState(chofer.email ?? "");
  const [telefono, setTelefono] = useState(chofer.telefono ?? "");
  const [telefonoEmergencia, setTelefonoEmergencia] = useState(chofer.telefono_emergencia ?? "");
  const [domicilio, setDomicilio] = useState(chofer.domicilio ?? "");
  const [ciudadNacimiento, setCiudadNacimiento] = useState(chofer.ciudad_nacimiento ?? "");
  const [localidad, setLocalidad] = useState(chofer.localidad ?? "");
  const [provincia, setProvincia] = useState(chofer.provincia ?? "");
  const [banco, setBanco] = useState(chofer.banco ?? "");
  // CVU y CBU unificados en un solo campo `cbu` (son equivalentes).
  const [cbu, setCbu] = useState(chofer.cbu ?? "");
  const [aliasCbu, setAliasCbu] = useState(chofer.alias_cbu ?? "");
  const [altaAfip, setAltaAfip] = useState(chofer.alta_afip ?? "");
  const [rol, setRol] = useState<string>((chofer as { rol?: string | null }).rol ?? "chofer");

  // Solo los choferes usan camión de la flota; admin/mantenimiento/fleteros no.
  const esChofer = (rol || "chofer") === "chofer";

  // Helpers de display
  const fmtFecha = (s: string | null | undefined) => {
    if (!s) return null;
    const parts = s.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return new Date(s).toLocaleDateString("es-AR");
  };

  // Edad calculada desde la fecha de nacimiento. Editando sigue a lo que se
  // está tipeando: si no, se corrige la fecha y la edad de al lado sigue con la
  // vieja hasta guardar.
  const edad = (() => {
    const desde = editing ? fechaNacimiento : chofer.fecha_nacimiento;
    if (!desde) return null;
    const nac = new Date(desde);
    if (Number.isNaN(nac.getTime())) return null;
    const hoy = new Date();
    let e = hoy.getFullYear() - nac.getFullYear();
    const m = hoy.getMonth() - nac.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) e -= 1;
    return e >= 0 && e < 120 ? e : null;
  })();

  const handleCancel = () => {
    setNombre(chofer.nombre);
    setApellido(chofer.apellido);
    setDni(chofer.dni ?? "");
    setCuil((chofer as { cuil?: string | null }).cuil ?? "");
    setFechaNacimiento(chofer.fecha_nacimiento ?? "");
    setFechaIngreso(chofer.fecha_ingreso ?? "");
    setEmail(chofer.email ?? "");
    setTelefono(chofer.telefono ?? "");
    setTelefonoEmergencia(chofer.telefono_emergencia ?? "");
    setDomicilio(chofer.domicilio ?? "");
    setCiudadNacimiento(chofer.ciudad_nacimiento ?? "");
    setLocalidad(chofer.localidad ?? "");
    setProvincia(chofer.provincia ?? "");
    setBanco(chofer.banco ?? "");
    setCbu(chofer.cbu ?? "");
    setAliasCbu(chofer.alias_cbu ?? "");
    setAltaAfip(chofer.alta_afip ?? "");
    setRol((chofer as { rol?: string | null }).rol ?? "chofer");
    setError(null);
    setFieldErrors({});
    setEditing(false);
  };

  const validateEdicion = (): boolean => {
    const errs: Record<string, string> = {};
    if (!nombre.trim()) errs.nombre = "El nombre es requerido.";
    if (!apellido.trim()) errs.apellido = "El apellido es requerido.";
    const errDni = validarDni(dni);
    if (errDni) errs.dni = errDni;
    const errCuil = validarCuil(cuil);
    if (errCuil) errs.cuil = errCuil;
    const errFecha = validarFechasLegajo({
      fecha_nacimiento: fechaNacimiento,
      fecha_ingreso: fechaIngreso,
      fecha_egreso: chofer.fecha_egreso,
    });
    if (errFecha) errs[errFecha.campo] = errFecha.mensaje;
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      errs.email = "El email no parece válido.";
    const telDigits = telefono.replace(/\D/g, "");
    if (telDigits && telDigits.length < 10) errs.telefono = "El teléfono debe tener al menos 10 dígitos.";
    // Validamos cada contacto de emergencia por separado: si tiene teléfono,
    // debe tener al menos 7 dígitos. Permitir cualquier cantidad de contactos.
    for (const c of parseContactos(telefonoEmergencia)) {
      const d = c.tel.replace(/\D/g, "");
      if (c.tel && d.length < 7) {
        errs.telefono_emergencia = "Cada teléfono de emergencia debe tener al menos 7 dígitos.";
        break;
      }
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = () => {
    if (!validateEdicion()) return;
    setError(null);
    startTransition(async () => {
      // Vacío va como null (no undefined): así borrar un dato mal cargado
      // realmente lo borra en vez de dejarlo como estaba.
      const res = await updateChoferInfoAction(chofer.id, {
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        dni: normalizarDni(dni) || null,
        cuil: cuil.trim() || null,
        fecha_nacimiento: fechaNacimiento || null,
        fecha_ingreso: fechaIngreso || null,
        email: email.trim() || null,
        telefono: telefono.trim() || null,
        telefono_emergencia: telefonoEmergencia.trim() || null,
        domicilio: domicilio.trim() || null,
        ciudad_nacimiento: ciudadNacimiento.trim() || null,
        localidad: localidad.trim() || null,
        provincia: provincia.trim() || null,
        banco: banco.trim() || null,
        cbu: cbu.trim() || null,
        alias_cbu: aliasCbu.trim() || null,
        alta_afip: altaAfip || null,
        rol: rol || "chofer",
      });
      if (res.error) {
        setError(res.error);
      } else {
        setEditing(false);
        onSaved?.();
      }
    });
  };

  const legajoEstado = getLegajoEstado({
    nombre: chofer.nombre,
    apellido: chofer.apellido,
    dni: chofer.dni,
    cuil: (chofer as { cuil?: string | null }).cuil ?? null,
    telefono: chofer.telefono,
    localidad: chofer.localidad,
    fecha_ingreso: chofer.fecha_ingreso,
  });

  return (
    <div className="space-y-4">
      {!legajoEstado.completo && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 flex items-start gap-3">
          <div className="flex items-center justify-center size-9 rounded-full bg-red-100 text-red-600 shrink-0">
            <AlertTriangle size={18} />
          </div>
          <div className="flex-1 space-y-1.5">
            <p className="text-sm font-semibold text-red-700">
              Legajo incompleto
            </p>
            <p className="text-xs text-red-700/90">
              Faltan los siguientes datos obligatorios:{" "}
              <span className="font-semibold">{legajoEstado.faltantes.join(", ")}</span>.
            </p>
            <p className="text-xs text-red-700/80">
              {MENSAJE_LEGAJO_INCOMPLETO}
            </p>
          </div>
        </div>
      )}

      {/* Estado de edición. En el legajo el botón "Editar" vive en el encabezado;
          en la lista (uso no-controlado) mostramos el botón acá. */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {editing ? "Editando — los cambios no se guardan hasta confirmar." : "Vista de solo lectura."}
        </span>
        {!controlled && !editing && (
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEditing(true)}>
            <Pencil size={12} className="mr-1.5 text-primary" /> Editar datos
          </Button>
        )}
      </div>

      {/* 3 columnas en paralelo: Personal/Laboral, Contacto, Bancarios */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
        {/* Datos personales y laborales (fechas y DNI/CUIL solo lectura) */}
        <section className="space-y-2.5">
          <h4 className="text-xs font-bold text-foreground uppercase tracking-wider border-b-2 border-primary/30 pb-2 flex items-center gap-2">
            Personal y laboral
          </h4>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            <Field label="DNI">
              {editing ? (
                <EditField error={fieldErrors.dni}>
                  <Input
                    value={dni}
                    onChange={(e) => setDni(normalizarDni(e.target.value))}
                    inputMode="numeric"
                    placeholder="—"
                    className={`font-mono h-8 text-sm ${fieldErrors.dni ? "border-red-400" : ""}`}
                  />
                </EditField>
              ) : <Value v={chofer.dni} mono />}
            </Field>
            <Field label="CUIL">
              {editing ? (
                <EditField error={fieldErrors.cuil}>
                  <Input
                    value={cuil}
                    onChange={(e) => setCuil(formatCuil(e.target.value))}
                    inputMode="numeric"
                    placeholder="20-12345678-9"
                    className={`font-mono h-8 text-sm ${fieldErrors.cuil ? "border-red-400" : ""}`}
                  />
                </EditField>
              ) : <Value v={(chofer as { cuil?: string | null }).cuil ?? null} mono />}
            </Field>
            <Field label="Estado">
              <Value v={chofer.estado === "baja" ? "egresado" : chofer.estado} />
              {/* El estado no se toca acá: egresar pide motivo y fecha, y se
                  hace desde el listado. Sin la aclaración parece un olvido. */}
              {editing && <Nota>Se cambia desde el listado (Egresar / Reactivar).</Nota>}
            </Field>
            <Field label="Fecha nacimiento">
              {editing ? (
                <EditField error={fieldErrors.fecha_nacimiento}>
                  <Input
                    type="date"
                    value={fechaNacimiento}
                    onChange={(e) => setFechaNacimiento(e.target.value)}
                    className={`h-8 text-sm ${fieldErrors.fecha_nacimiento ? "border-red-400" : ""}`}
                  />
                </EditField>
              ) : <Value v={fmtFecha(chofer.fecha_nacimiento) ?? "—"} />}
            </Field>
            <Field label="Edad">
              <Value v={edad != null ? `${edad} años` : "—"} />
              {editing && <Nota>Se calcula sola.</Nota>}
            </Field>
            <Field label="Fecha ingreso">
              {editing ? (
                <EditField error={fieldErrors.fecha_ingreso}>
                  <Input
                    type="date"
                    value={fechaIngreso}
                    onChange={(e) => setFechaIngreso(e.target.value)}
                    className={`h-8 text-sm ${fieldErrors.fecha_ingreso ? "border-red-400" : ""}`}
                  />
                </EditField>
              ) : <Value v={fmtFecha(chofer.fecha_ingreso) ?? "Pendiente"} />}
            </Field>
            {chofer.estado === "baja" && (
              <Field label="Fecha egreso">
                <Value v={fmtFecha(chofer.fecha_egreso) ?? "—"} />
                {editing && <Nota>Se edita en el panel de egreso, arriba.</Nota>}
              </Field>
            )}
            <Field label="Ciudad de nacimiento">
              {editing
                ? <Input value={ciudadNacimiento} onChange={(e) => setCiudadNacimiento(e.target.value)} className="h-8 text-sm" placeholder="—" />
                : <Value v={chofer.ciudad_nacimiento} />}
            </Field>
            <Field label="Localidad (residencia)">
              {editing
                ? <Input value={localidad} onChange={(e) => setLocalidad(e.target.value)} className="h-8 text-sm" placeholder="—" />
                : <Value v={chofer.localidad} />}
            </Field>
            <Field label="Provincia">
              {editing
                ? <Input value={provincia} onChange={(e) => setProvincia(e.target.value)} className="h-8 text-sm" placeholder="—" />
                : <Value v={chofer.provincia} />}
            </Field>
            <div className="col-span-2">
              <Field label="Área / Rol">
                {editing ? (
                  <Combobox
                    value={rol}
                    onValueChange={(v) => setRol(v || "chofer")}
                    options={ROLES.map((r) => ({ id: r.value, label: r.label }))}
                    searchable={false}
                    triggerClassName="h-8 text-sm"
                  />
                ) : (
                  <Value v={rolLabel((chofer as { rol?: string | null }).rol)} />
                )}
              </Field>
            </div>
            {/* El camión de la flota es solo para choferes. */}
            {esChofer && (
              <div className="col-span-2">
                <Field label="Camión actual">
                  <CamionAsignacion
                    choferId={chofer.id}
                    camionActual={chofer.camion_actual}
                    historial={chofer.camiones_historial}
                  />
                </Field>
              </div>
            )}
          </div>
        </section>

        {/* Datos de contacto */}
        <section className="space-y-2.5">
          <h4 className="text-xs font-bold text-foreground uppercase tracking-wider border-b-2 border-primary/30 pb-2 flex items-center gap-2">
            Contacto
          </h4>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            <Field label="Nombre *">
              {editing ? (
                <div className="space-y-0.5">
                  <Input value={nombre} onChange={(e) => setNombre(e.target.value)} className={`h-8 text-sm ${fieldErrors.nombre ? "border-red-400" : ""}`} />
                  {fieldErrors.nombre && <p className="text-red-500 text-[11px]">{fieldErrors.nombre}</p>}
                </div>
              ) : <Value v={chofer.nombre} />}
            </Field>
            <Field label="Apellido *">
              {editing ? (
                <div className="space-y-0.5">
                  <Input value={apellido} onChange={(e) => setApellido(e.target.value)} className={`h-8 text-sm ${fieldErrors.apellido ? "border-red-400" : ""}`} />
                  {fieldErrors.apellido && <p className="text-red-500 text-[11px]">{fieldErrors.apellido}</p>}
                </div>
              ) : <Value v={chofer.apellido} />}
            </Field>
            <Field label="Teléfono">
              {editing ? (
                <div className="space-y-0.5">
                  <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} className={`h-8 text-sm ${fieldErrors.telefono ? "border-red-400" : ""}`} placeholder="—" />
                  {fieldErrors.telefono && <p className="text-red-500 text-[11px]">{fieldErrors.telefono}</p>}
                </div>
              ) : <Value v={chofer.telefono} />}
            </Field>
            {/* El email estaba en el encabezado y en ningún lado se podía cargar. */}
            <Field label="Email">
              {editing ? (
                <EditField error={fieldErrors.email}>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`h-8 text-sm ${fieldErrors.email ? "border-red-400" : ""}`}
                    placeholder="—"
                  />
                </EditField>
              ) : <Value v={chofer.email} />}
            </Field>
            <div className="col-span-2">
              <Field label="Contactos de emergencia">
                {editing ? (
                  <div className="space-y-0.5">
                    <EmergencyContactsEditor
                      value={telefonoEmergencia}
                      onChange={setTelefonoEmergencia}
                      errorClass={fieldErrors.telefono_emergencia ? "border-red-400" : ""}
                    />
                    {fieldErrors.telefono_emergencia && <p className="text-red-500 text-[11px]">{fieldErrors.telefono_emergencia}</p>}
                  </div>
                ) : (
                  <EmergencyContactsView value={chofer.telefono_emergencia} />
                )}
              </Field>
            </div>
            <div className="col-span-2">
              <Field label="Domicilio">
                {editing
                  ? <Input value={domicilio} onChange={(e) => setDomicilio(e.target.value)} className="h-8 text-sm" placeholder="—" />
                  : <Value v={chofer.domicilio} />}
              </Field>
            </div>
          </div>
        </section>

        {/* Datos bancarios */}
        <section className="space-y-2.5 md:col-span-2 lg:col-span-1">
          <h4 className="text-xs font-bold text-foreground uppercase tracking-wider border-b-2 border-primary/30 pb-2 flex items-center gap-2">
            Bancarios
          </h4>
          <div className="space-y-2">
            <Field label="Banco">
              {editing
                ? <Input value={banco} onChange={(e) => setBanco(e.target.value)} className="h-8 text-sm" placeholder="—" />
                : <Value v={chofer.banco} />}
            </Field>
            <Field label="CVU/CBU">
              {editing
                ? <Input value={cbu} onChange={(e) => setCbu(e.target.value)} className="font-mono h-8 text-sm" placeholder="—" maxLength={22} />
                : <Value v={chofer.cbu} mono />}
            </Field>
            <Field label="Alias CBU">
              {editing
                ? <Input value={aliasCbu} onChange={(e) => setAliasCbu(e.target.value)} className="h-8 text-sm" placeholder="—" />
                : <Value v={chofer.alias_cbu} />}
            </Field>
          </div>
          {!editing && (
            <p className="text-[11px] text-muted-foreground bg-muted/40 rounded-md px-2.5 py-1.5 border border-border">
              Se usan para liquidaciones y transferencias.
            </p>
          )}
        </section>

        {/* AFIP + Período de prueba */}
        <section className="space-y-2.5 md:col-span-2 lg:col-span-3">
          <h4 className="text-xs font-bold text-foreground uppercase tracking-wider border-b-2 border-primary/30 pb-2 flex items-center gap-2">
            AFIP / Período de prueba
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2">
            <Field label="Alta AFIP">
              {editing
                ? <Input type="date" value={altaAfip} onChange={(e) => setAltaAfip(e.target.value)} className="h-8 text-sm" />
                : <Value v={altaAfip ? fmtFecha(altaAfip) : null} />}
            </Field>
            <PeriodoPruebaField
              fechaIngreso={chofer.fecha_ingreso}
              periodoPruebaFin={(chofer as { periodo_prueba_fin?: string | null }).periodo_prueba_fin ?? null}
              editing={editing}
              onActivar={() => {
                const fin = chofer.fecha_ingreso
                  ? addMonthsStr(chofer.fecha_ingreso, 6)
                  : addMonthsStr(new Date().toISOString().split("T")[0], 6);
                updateChoferInfoAction(chofer.id, { periodo_prueba_fin: fin }).then((res) => {
                  if (!res.error) onSaved?.();
                });
              }}
            />
          </div>
        </section>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
          {error}
        </div>
      )}

      {editing && (
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
          <Button variant="outline" size="sm" onClick={handleCancel} disabled={isPending}>
            <X size={13} className="mr-1.5" />Cancelar
          </Button>
          <Button variant="brand" size="sm" onClick={handleSave} disabled={isPending}>
            {isPending ? "Guardando..." : (
              <><Check size={13} className="mr-1.5" />Guardar cambios</>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

function addMonthsStr(dateStr: string, months: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split("T")[0];
}

function PeriodoPruebaField({
  fechaIngreso,
  periodoPruebaFin,
  editing,
  onActivar,
}: {
  fechaIngreso: string | null | undefined;
  periodoPruebaFin: string | null;
  editing: boolean;
  onActivar: () => void;
}) {
  const fmtFecha = (s: string) => {
    const [y, m, d] = s.split("-");
    return `${d}/${m}/${y}`;
  };

  if (!periodoPruebaFin) {
    return (
      <div className="col-span-2 flex items-center gap-3">
        <div className="space-y-0.5">
          <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Período de prueba</Label>
          <p className="text-sm py-0.5 text-muted-foreground/60">No iniciado</p>
        </div>
        {editing && (
          <button
            type="button"
            onClick={onActivar}
            className="mt-4 text-xs font-semibold text-[#0088D1] hover:underline"
          >
            + Iniciar
          </button>
        )}
      </div>
    );
  }

  const hoy = new Date();
  const fin = new Date(periodoPruebaFin + "T00:00:00");
  const diasRestantes = Math.ceil((fin.getTime() - hoy.getTime()) / 86_400_000);
  const vencido = diasRestantes < 0;
  const porVencer = !vencido && diasRestantes <= 30;

  return (
    <>
      <div className="space-y-0.5">
        <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Período de prueba — inicio</Label>
        <p className="text-sm py-0.5 text-foreground">{fechaIngreso ? fmtFecha(fechaIngreso) : "—"}</p>
      </div>
      <div className="space-y-0.5">
        <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Período de prueba — fin</Label>
        <p className={`text-sm py-0.5 font-semibold ${vencido ? "text-red-500" : porVencer ? "text-amber-500" : "text-[#0088D1]"}`}>
          {fmtFecha(periodoPruebaFin)}
          <span className="ml-1.5 font-normal text-muted-foreground text-xs">
            {vencido ? `(venció hace ${Math.abs(diasRestantes)}d)` : `(${diasRestantes}d restantes)`}
          </span>
        </p>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</Label>
      {children}
    </div>
  );
}

/** Campo en edición: el input y, debajo, el error de validación si lo hay. */
function EditField({ error, children }: { error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      {children}
      {error && <p className="text-red-500 text-[11px]">{error}</p>}
    </div>
  );
}

/** Aclaración de por qué un dato no se edita acá (o sale solo). */
function Nota({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-muted-foreground/80">{children}</p>;
}

function Value({ v, mono }: { v?: string | null; mono?: boolean }) {
  return (
    <p className={`text-sm py-0.5 ${mono ? "font-mono" : ""} ${!v ? "text-muted-foreground/60" : "text-foreground"} break-words`} title={v ?? undefined}>
      {v ?? "—"}
    </p>
  );
}
