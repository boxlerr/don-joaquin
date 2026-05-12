"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { actualizarParametrosBulk } from "./actions";
import { getValidacion } from "./validaciones";
import type { Database } from "@/types/database";

type Parametro = Database["public"]["Tables"]["parametros_sistema"]["Row"];

type FieldError = { clave: string; error: string };

function formatValor(valor: string, tipo: string): string {
  if (valor === "") return "—";
  if (tipo === "boolean") return valor === "true" ? "Activado" : "Desactivado";
  return valor;
}

export default function BulkEditForm({
  params,
  onCancel,
  onSaved,
}: {
  params: Parametro[];
  onCancel: () => void;
  onSaved: (guardados: number) => void;
}) {
  const editables = params.filter((p) => p.editable);
  const readOnly = params.filter((p) => !p.editable);

  const [values, setValues] = useState<Record<string, string>>(
    () => Object.fromEntries(editables.map((p) => [p.id, p.valor])),
  );
  const [fieldErrors, setFieldErrors] = useState<FieldError[]>([]);
  const [isPending, startTransition] = useTransition();

  const changedIds = editables
    .filter((p) => values[p.id] !== p.valor)
    .map((p) => p.id);

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
    <div className="border border-[#E2E8F0] rounded-[8px] bg-white shadow-sm">
      {generalError && (
        <div className="px-5 py-3 bg-[#FEF2F2] border-b border-[#FECACA] text-sm text-[#7F1D1D] rounded-t-[8px]">
          {generalError}
        </div>
      )}

      <div className="divide-y divide-[#E2E8F0]">
        {editables.map((p) => {
          const validacion = getValidacion(p.clave, p.tipo_dato);
          const fieldError = getFieldError(p.clave);
          const changed = values[p.id] !== p.valor;

          return (
            <div
              key={p.id}
              className={`flex items-start gap-4 px-5 py-3.5 transition-colors ${
                changed ? "bg-[#F0F9FF]" : ""
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[#0F172A] text-sm font-medium">
                    {p.descripcion ?? p.clave}
                  </p>
                  {changed && (
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#0088D1]" />
                  )}
                </div>
                <p className="text-[#94A3B8] text-xs mt-0.5 font-mono">{p.clave}</p>
                {fieldError && (
                  <p className="text-[#EF4444] text-xs mt-1">{fieldError}</p>
                )}
              </div>

              <div className="shrink-0 flex flex-col items-end gap-1">
                {p.tipo_dato === "boolean" ? (
                  <BooleanToggleBulk
                    value={values[p.id] === "true"}
                    disabled={isPending}
                    onChange={(v) =>
                      setValues((prev) => ({ ...prev, [p.id]: v ? "true" : "false" }))
                    }
                  />
                ) : validacion.opciones ? (
                  <select
                    value={values[p.id]}
                    onChange={(e) =>
                      setValues((prev) => ({ ...prev, [p.id]: e.target.value }))
                    }
                    disabled={isPending}
                    className="h-8 w-52 text-sm rounded-lg border border-[#E2E8F0] bg-white px-2.5 outline-none focus-visible:border-[#0088D1]"
                  >
                    {validacion.opciones.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    type={p.tipo_dato === "number" ? "number" : "text"}
                    step={
                      p.tipo_dato === "number"
                        ? (validacion.step ?? 0.01).toString()
                        : undefined
                    }
                    min={
                      p.tipo_dato === "number" && validacion.min !== undefined
                        ? validacion.min
                        : undefined
                    }
                    max={
                      p.tipo_dato === "number" && validacion.max !== undefined
                        ? validacion.max
                        : undefined
                    }
                    value={values[p.id]}
                    onChange={(e) =>
                      setValues((prev) => ({ ...prev, [p.id]: e.target.value }))
                    }
                    disabled={isPending}
                    className="h-8 w-52 text-sm"
                  />
                )}
                {validacion.pista && (
                  <span className="text-[10px] text-[#94A3B8]">{validacion.pista}</span>
                )}
              </div>
            </div>
          );
        })}

        {readOnly.map((p) => (
          <div key={p.id} className="flex items-start gap-4 px-5 py-3.5 opacity-60">
            <div className="flex-1 min-w-0">
              <p className="text-[#0F172A] text-sm font-medium">
                {p.descripcion ?? p.clave}
              </p>
              <p className="text-[#94A3B8] text-xs mt-0.5 font-mono">{p.clave}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[#0F172A] text-sm font-semibold">
                {formatValor(p.valor, p.tipo_dato)}
              </p>
              <span className="text-[10px] text-[#94A3B8] uppercase tracking-wide">
                Solo lectura
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between px-5 py-3.5 border-t border-[#E2E8F0] bg-[#F8FAFC] rounded-b-[8px]">
        <span className="text-sm text-[#475569]">
          {cambiosCount === 0
            ? "Sin cambios"
            : cambiosCount === 1
              ? "1 cambio pendiente"
              : `${cambiosCount} cambios pendientes`}
        </span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isPending}
          >
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
              : `Guardar ${cambiosCount > 0 ? cambiosCount : ""} ${cambiosCount === 1 ? "cambio" : cambiosCount > 1 ? "cambios" : ""}`}
          </Button>
        </div>
      </div>
    </div>
  );
}

function BooleanToggleBulk({
  value,
  disabled,
  onChange,
}: {
  value: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={value}
        disabled={disabled}
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          value ? "bg-[#0088D1]" : "bg-[#CBD5E1]"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            value ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </button>
      <span className="text-[#0F172A] text-sm font-semibold w-20">
        {value ? "Activado" : "Desactivado"}
      </span>
    </div>
  );
}
