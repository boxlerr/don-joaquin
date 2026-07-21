"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Lock, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { actualizarParametrosBulk } from "./actions";
import { getValidacion, type ValidacionParametro } from "./validaciones";
import { displayValorParam, esAvanzado, etiquetaParam, moduloDeParam, type Parametro } from "./meta";

type FieldError = { clave: string; error: string };

export default function BulkEditForm({
  params,
  onCancel,
  onSaved,
}: {
  params: Parametro[];
  onCancel: () => void;
  onSaved: (guardados: number) => void;
}) {
  const editables = params.filter((p) => p.editable && !esAvanzado(p));
  const avanzados = params.filter((p) => p.editable && esAvanzado(p));
  const readOnly = params.filter((p) => !p.editable);

  const [values, setValues] = useState<Record<string, string>>(
    () => Object.fromEntries(editables.map((p) => [p.id, p.valor])),
  );
  const [fieldErrors, setFieldErrors] = useState<FieldError[]>([]);
  const [isPending, startTransition] = useTransition();

  const changedIds = editables.filter((p) => values[p.id] !== p.valor).map((p) => p.id);
  const cambiosCount = changedIds.length;

  function onSave() {
    setFieldErrors([]);
    const cambios = changedIds.map((id) => ({ id, valor: values[id]! }));

    startTransition(async () => {
      const result = await actualizarParametrosBulk(cambios);
      if ("error" in result) {
        setFieldErrors([{ clave: "_general", error: result.error }]);
        return;
      }
      if (result.errores.length > 0) {
        setFieldErrors(result.errores);
        return;
      }
      onSaved(result.guardados);
    });
  }

  function getFieldError(clave: string): string | null {
    return fieldErrors.find((e) => e.clave === clave)?.error ?? null;
  }

  const generalError = getFieldError("_general");

  return (
    <div className="border border-[#BAE6FD] rounded-[10px] bg-[#F8FCFF] shadow-sm overflow-hidden">
      <div className="px-4 py-2.5 bg-[#E0F2FE] border-b border-[#BAE6FD] flex items-center gap-2">
        <PencilBadge />
        <span className="text-xs font-semibold text-[#075985]">
          Editando la categoría — los cambios se guardan todos juntos
        </span>
      </div>

      {generalError && (
        <div
          role="alert"
          className="px-4 py-3 bg-[#FEF2F2] border-b border-[#FECACA] text-sm text-[#991B1B]"
        >
          {generalError}
        </div>
      )}

      <div className="divide-y divide-border bg-card">
        {editables.map((p) => {
          const validacion = getValidacion(p.clave, p.tipo_dato);
          const fieldError = getFieldError(p.clave);
          const changed = values[p.id] !== p.valor;

          return (
            <div
              key={p.id}
              className={`flex items-start gap-4 px-4 py-3.5 transition-colors ${
                changed ? "bg-[#F0F9FF]" : ""
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-foreground text-sm font-medium">{etiquetaParam(p)}</p>
                  {changed && <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#0088D1]" />}
                </div>
                {fieldError && <p className="text-[#DC2626] text-xs mt-1">{fieldError}</p>}
              </div>

              <div className="shrink-0 flex flex-col items-end gap-1">
                {p.tipo_dato === "boolean" ? (
                  <BooleanToggleBulk
                    value={values[p.id] === "true"}
                    disabled={isPending}
                    nombre={etiquetaParam(p)}
                    onChange={(v) =>
                      setValues((prev) => ({ ...prev, [p.id]: v ? "true" : "false" }))
                    }
                  />
                ) : validacion.opciones ? (
                  <Combobox
                    value={values[p.id]}
                    onValueChange={(v) => setValues((prev) => ({ ...prev, [p.id]: v }))}
                    disabled={isPending}
                    options={validacion.opciones.map((opt) => ({
                      id: opt,
                      label: validacion.opcionesLabels?.[opt] ?? opt,
                    }))}
                    triggerClassName="h-8 w-52 text-sm"
                  />
                ) : validacion.inputTipo === "time" ? (
                  <Input
                    type="time"
                    value={values[p.id]}
                    onChange={(e) => setValues((prev) => ({ ...prev, [p.id]: e.target.value }))}
                    disabled={isPending}
                    className="h-8 w-36 text-sm"
                  />
                ) : (
                  <MoneyOrTextInput
                    tipo={p.tipo_dato}
                    validacion={validacion}
                    value={values[p.id]!}
                    onChange={(v) => setValues((prev) => ({ ...prev, [p.id]: v }))}
                    disabled={isPending}
                  />
                )}
                {validacion.pista && (
                  <span className="text-[10px] text-muted-foreground/70 text-right max-w-[220px]">
                    {validacion.pista}
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {avanzados.map((p) => {
          const modulo = moduloDeParam(p);
          return (
            <div key={p.id} className="flex items-start gap-4 px-4 py-3.5 bg-muted/20">
              <div className="flex-1 min-w-0">
                <p className="text-foreground text-sm font-medium">{etiquetaParam(p)}</p>
              </div>
              <div className="shrink-0">
                {modulo ? (
                  <Link
                    href={modulo.href}
                    className={buttonVariants({ variant: "outline", size: "xs" })}
                  >
                    {modulo.label}
                    <ArrowUpRight size={12} />
                  </Link>
                ) : (
                  <span className="text-[11px] text-muted-foreground">Configuración avanzada</span>
                )}
              </div>
            </div>
          );
        })}

        {readOnly.map((p) => (
          <div key={p.id} className="flex items-start gap-4 px-4 py-3.5 opacity-70">
            <div className="flex-1 min-w-0">
              <p className="text-foreground text-sm font-medium">{etiquetaParam(p)}</p>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <span
                className="text-foreground text-sm font-semibold max-w-[240px] truncate"
                title={displayValorParam(p)}
              >
                {displayValorParam(p)}
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/80 bg-muted border border-border px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                <Lock size={9} />
                Solo lectura
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/40">
        <span className="text-sm text-muted-foreground">
          {cambiosCount === 0
            ? "Sin cambios"
            : cambiosCount === 1
              ? "1 cambio pendiente"
              : `${cambiosCount} cambios pendientes`}
        </span>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isPending}>
            <X size={13} />
            Cancelar
          </Button>
          <Button
            type="button"
            variant="brand"
            size="sm"
            onClick={onSave}
            disabled={isPending || cambiosCount === 0}
          >
            <Check size={13} />
            {isPending
              ? "Guardando…"
              : cambiosCount > 0
                ? `Guardar ${cambiosCount} ${cambiosCount === 1 ? "cambio" : "cambios"}`
                : "Guardar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function MoneyOrTextInput({
  tipo,
  validacion,
  value,
  onChange,
  disabled,
}: {
  tipo: string;
  validacion: ValidacionParametro;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  const isNumber = tipo === "number";
  const hasPrefix = validacion.prefijo && isNumber;

  return (
    <div className="relative">
      {hasPrefix && (
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
          {validacion.prefijo}
        </span>
      )}
      <Input
        type={isNumber ? "number" : "text"}
        step={isNumber ? (validacion.step ?? 0.01).toString() : undefined}
        min={isNumber && validacion.min !== undefined ? validacion.min : undefined}
        max={isNumber && validacion.max !== undefined ? validacion.max : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`h-8 w-52 text-sm ${hasPrefix ? "pl-6" : ""}`}
      />
    </div>
  );
}

function PencilBadge() {
  return (
    <span className="flex items-center justify-center w-5 h-5 rounded-md bg-[#0088D1] text-white shrink-0">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    </span>
  );
}

function BooleanToggleBulk({
  value,
  disabled,
  onChange,
  nombre,
}: {
  value: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
  nombre: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={nombre}
        disabled={disabled}
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          value ? "bg-[#0088D1]" : "bg-[#CBD5E1]"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-card shadow transition-transform ${
            value ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </button>
      <span className="text-foreground text-sm font-semibold w-20">
        {value ? "Activado" : "Desactivado"}
      </span>
    </div>
  );
}
