"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { updateChoferInfoAction } from "./actions";
import type { ChoferDetail } from "./types";
import { Check, Pencil, X } from "lucide-react";

interface Props {
  chofer: ChoferDetail;
  onSaved?: () => void;
}

export default function ChoferInfoTab({ chofer, onSaved }: Props) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [nombre, setNombre] = useState(chofer.nombre);
  const [apellido, setApellido] = useState(chofer.apellido);
  const [email, setEmail] = useState(chofer.email ?? "");
  const [telefono, setTelefono] = useState(chofer.telefono ?? "");
  const [telefonoEmergencia, setTelefonoEmergencia] = useState(chofer.telefono_emergencia ?? "");
  const [domicilio, setDomicilio] = useState(chofer.domicilio ?? "");
  const [banco, setBanco] = useState(chofer.banco ?? "");
  const [cbu, setCbu] = useState(chofer.cbu ?? "");
  const [aliasCbu, setAliasCbu] = useState(chofer.alias_cbu ?? "");

  // Helpers de display
  const fmtFecha = (s: string | null | undefined) =>
    s ? new Date(s).toLocaleDateString("es-AR") : null;

  const handleCancel = () => {
    setNombre(chofer.nombre);
    setApellido(chofer.apellido);
    setEmail(chofer.email ?? "");
    setTelefono(chofer.telefono ?? "");
    setTelefonoEmergencia(chofer.telefono_emergencia ?? "");
    setDomicilio(chofer.domicilio ?? "");
    setBanco(chofer.banco ?? "");
    setCbu(chofer.cbu ?? "");
    setAliasCbu(chofer.alias_cbu ?? "");
    setError(null);
    setEditing(false);
  };

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      const res = await updateChoferInfoAction(chofer.id, {
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        email: email.trim() || undefined,
        telefono: telefono.trim() || undefined,
        telefono_emergencia: telefonoEmergencia.trim() || undefined,
        domicilio: domicilio.trim() || undefined,
        banco: banco.trim() || undefined,
        cbu: cbu.trim() || undefined,
        alias_cbu: aliasCbu.trim() || undefined,
      });
      if (res.error) {
        setError(res.error);
      } else {
        setEditing(false);
        onSaved?.();
      }
    });
  };

  return (
    <div className="space-y-4">
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
            <Field label="Fecha ingreso">
              <Value v={fmtFecha(chofer.fecha_ingreso) ?? "Pendiente"} />
            </Field>
            {chofer.estado === "baja" && (
              <Field label="Fecha egreso">
                <Value v={fmtFecha(chofer.fecha_egreso) ?? "—"} />
              </Field>
            )}
            <Field label="Localidad"><Value v={chofer.localidad} /></Field>
            <Field label="Provincia"><Value v={chofer.provincia} /></Field>
          </div>
        </section>

        {/* Datos de contacto */}
        <section className="space-y-2.5">
          <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide border-b border-border pb-1.5">
            Contacto
          </h4>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            <Field label="Nombre">
              {editing
                ? <Input value={nombre} onChange={(e) => setNombre(e.target.value)} className="h-8 text-sm" />
                : <Value v={chofer.nombre} />}
            </Field>
            <Field label="Apellido">
              {editing
                ? <Input value={apellido} onChange={(e) => setApellido(e.target.value)} className="h-8 text-sm" />
                : <Value v={chofer.apellido} />}
            </Field>
            <Field label="Teléfono">
              {editing
                ? <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} className="h-8 text-sm" placeholder="—" />
                : <Value v={chofer.telefono} />}
            </Field>
            <Field label="Tel. emergencia">
              {editing
                ? <Input value={telefonoEmergencia} onChange={(e) => setTelefonoEmergencia(e.target.value)} className="h-8 text-sm" placeholder="—" />
                : <Value v={chofer.telefono_emergencia} />}
            </Field>
            <div className="col-span-2">
              <Field label="Email">
                {editing
                  ? <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-8 text-sm" placeholder="—" />
                  : <Value v={chofer.email} />}
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
          <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide border-b border-border pb-1.5">
            Bancarios
          </h4>
          <div className="space-y-2">
            <Field label="Banco">
              {editing
                ? <Input value={banco} onChange={(e) => setBanco(e.target.value)} className="h-8 text-sm" placeholder="—" />
                : <Value v={chofer.banco} />}
            </Field>
            <Field label="CBU">
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
