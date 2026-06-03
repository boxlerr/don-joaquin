"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { updateChoferInfoAction } from "./actions";
import type { ChoferDetail } from "./types";
import { Check, Pencil, X, AlertTriangle } from "lucide-react";
import { getLegajoEstado, MENSAJE_LEGAJO_INCOMPLETO } from "@/lib/chofer-validation";
import CamionAsignacion from "./CamionAsignacion";

interface Props {
  chofer: ChoferDetail;
  onSaved?: () => void;
}

export default function ChoferInfoTab({ chofer, onSaved }: Props) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [nombre, setNombre] = useState(chofer.nombre);
  const [apellido, setApellido] = useState(chofer.apellido);
  const [telefono, setTelefono] = useState(chofer.telefono ?? "");
  const [telefonoEmergencia, setTelefonoEmergencia] = useState(chofer.telefono_emergencia ?? "");
  const [domicilio, setDomicilio] = useState(chofer.domicilio ?? "");
  const [banco, setBanco] = useState(chofer.banco ?? "");
  // CVU y CBU unificados en un solo campo `cbu` (son equivalentes).
  const [cbu, setCbu] = useState(chofer.cbu ?? "");
  const [aliasCbu, setAliasCbu] = useState(chofer.alias_cbu ?? "");
  const [altaAfip, setAltaAfip] = useState(chofer.alta_afip ?? "");

  // Helpers de display
  const fmtFecha = (s: string | null | undefined) => {
    if (!s) return null;
    const parts = s.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return new Date(s).toLocaleDateString("es-AR");
  };

  // Edad calculada desde la fecha de nacimiento.
  const edad = (() => {
    if (!chofer.fecha_nacimiento) return null;
    const nac = new Date(chofer.fecha_nacimiento);
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
    setTelefono(chofer.telefono ?? "");
    setTelefonoEmergencia(chofer.telefono_emergencia ?? "");
    setDomicilio(chofer.domicilio ?? "");
    setBanco(chofer.banco ?? "");
    setCbu(chofer.cbu ?? "");
    setAliasCbu(chofer.alias_cbu ?? "");
    setAltaAfip(chofer.alta_afip ?? "");
    setError(null);
    setFieldErrors({});
    setEditing(false);
  };

  const validateEdicion = (): boolean => {
    const errs: Record<string, string> = {};
    if (!nombre.trim()) errs.nombre = "El nombre es requerido.";
    if (!apellido.trim()) errs.apellido = "El apellido es requerido.";
    const telDigits = telefono.replace(/\D/g, "");
    if (telDigits && telDigits.length < 10) errs.telefono = "El teléfono debe tener al menos 10 dígitos.";
    const telEmerDigits = telefonoEmergencia.replace(/\D/g, "");
    if (telEmerDigits && telEmerDigits.length < 10) errs.telefono_emergencia = "Debe tener al menos 10 dígitos.";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = () => {
    if (!validateEdicion()) return;
    setError(null);
    startTransition(async () => {
      const res = await updateChoferInfoAction(chofer.id, {
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        telefono: telefono.trim() || undefined,
        telefono_emergencia: telefonoEmergencia.trim() || undefined,
        domicilio: domicilio.trim() || undefined,
        banco: banco.trim() || undefined,
        cbu: cbu.trim() || undefined,
        alias_cbu: aliasCbu.trim() || undefined,
        alta_afip: altaAfip || undefined,
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
        <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-500/10 dark:border-red-500/40 p-4 flex items-start gap-3">
          <div className="flex items-center justify-center size-9 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-300 shrink-0">
            <AlertTriangle size={18} />
          </div>
          <div className="flex-1 space-y-1.5">
            <p className="text-sm font-semibold text-red-700 dark:text-red-300">
              Legajo incompleto
            </p>
            <p className="text-xs text-red-700/90 dark:text-red-200/90">
              Faltan los siguientes datos obligatorios:{" "}
              <span className="font-semibold">{legajoEstado.faltantes.join(", ")}</span>.
            </p>
            <p className="text-xs text-red-700/80 dark:text-red-200/80">
              {MENSAJE_LEGAJO_INCOMPLETO}
            </p>
          </div>
        </div>
      )}

      {/* Header con toggle de edición */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {editing ? "Editando — los cambios no se guardan hasta confirmar." : "Vista de solo lectura."}
        </span>
        {!editing ? (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setEditing(true)}
          >
            <Pencil size={12} className="mr-1.5 text-primary" />
            Editar datos
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={handleCancel}
            disabled={isPending}
          >
            <X size={12} className="mr-1" />
            Cancelar
          </Button>
        )}
      </div>

      {/* 3 columnas en paralelo: Personal/Laboral, Contacto, Bancarios */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
        {/* Datos personales y laborales (solo lectura) */}
        <section className="space-y-2.5">
          <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide border-b border-border pb-1.5">
            Personal y laboral
          </h4>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            <Field label="DNI"><Value v={chofer.dni} mono /></Field>
            <Field label="CUIL"><Value v={(chofer as { cuil?: string | null }).cuil ?? null} mono /></Field>
            <Field label="Estado">
              <Value v={chofer.estado === "baja" ? "egresado" : chofer.estado} />
            </Field>
            <Field label="Fecha nacimiento">
              <Value v={fmtFecha(chofer.fecha_nacimiento) ?? "—"} />
            </Field>
            <Field label="Edad">
              <Value v={edad != null ? `${edad} años` : "—"} />
            </Field>
            <Field label="Fecha ingreso">
              <Value v={fmtFecha(chofer.fecha_ingreso) ?? "Pendiente"} />
            </Field>
            {chofer.estado === "baja" && (
              <Field label="Fecha egreso">
                <Value v={fmtFecha(chofer.fecha_egreso) ?? "—"} />
              </Field>
            )}
            <Field label="Ciudad de nacimiento">
              <Value v={chofer.ciudad_nacimiento} />
            </Field>
            <Field label="Localidad (residencia)"><Value v={chofer.localidad} /></Field>
            <Field label="Provincia"><Value v={chofer.provincia} /></Field>
            <div className="col-span-2">
              <Field label="Camión actual">
                <CamionAsignacion
                  choferId={chofer.id}
                  camionActual={chofer.camion_actual}
                  historial={chofer.camiones_historial}
                />
              </Field>
            </div>
          </div>
        </section>

        {/* Datos de contacto */}
        <section className="space-y-2.5">
          <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide border-b border-border pb-1.5">
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
            <Field label="Tel. emergencia">
              {editing ? (
                <div className="space-y-0.5">
                  <Input value={telefonoEmergencia} onChange={(e) => setTelefonoEmergencia(e.target.value)} className={`h-8 text-sm ${fieldErrors.telefono_emergencia ? "border-red-400" : ""}`} placeholder="—" />
                  {fieldErrors.telefono_emergencia && <p className="text-red-500 text-[11px]">{fieldErrors.telefono_emergencia}</p>}
                </div>
              ) : <Value v={chofer.telefono_emergencia} />}
            </Field>
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
          <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide border-b border-border pb-1.5">
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
          <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide border-b border-border pb-1.5">
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
        <div className="p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-300 text-sm rounded-lg">
          {error}
        </div>
      )}

      {editing && (
        <div className="flex items-center justify-end pt-3 border-t border-border">
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

function Value({ v, mono }: { v?: string | null; mono?: boolean }) {
  return (
    <p className={`text-sm py-0.5 ${mono ? "font-mono" : ""} ${!v ? "text-muted-foreground/60" : "text-foreground"} truncate`} title={v ?? undefined}>
      {v ?? "—"}
    </p>
  );
}
