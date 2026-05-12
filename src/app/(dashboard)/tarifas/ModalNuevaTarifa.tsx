"use client";

import { useMemo, useState, useTransition } from "react";
import { Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  actualizarTarifa,
  crearTarifa,
  type ClienteOption,
  type RutaOption,
  type TarifaConRelaciones,
} from "./actions";
import { MODALIDADES, rutaEsObligatoria, type TarifaModalidad } from "./validaciones";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  clientes: ClienteOption[];
  rutas: RutaOption[];
  tarifa?: TarifaConRelaciones | null;
};

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ModalNuevaTarifa({
  open,
  onClose,
  onSaved,
  clientes,
  rutas,
  tarifa,
}: Props) {
  const editando = !!tarifa;

  const [clienteId, setClienteId] = useState(tarifa?.cliente_id ?? "");
  const [rutaId, setRutaId] = useState<string>(tarifa?.ruta_id ?? "_sin_ruta");
  const [modalidad, setModalidad] = useState<TarifaModalidad>(
    (tarifa?.modalidad as TarifaModalidad) ?? "fija",
  );
  const [valor, setValor] = useState<string>(
    tarifa ? String(tarifa.valor) : "",
  );
  const [moneda, setMoneda] = useState(tarifa?.moneda ?? "ARS");
  const [vigDesde, setVigDesde] = useState(tarifa?.vigencia_desde ?? hoyISO());
  const [vigHasta, setVigHasta] = useState(tarifa?.vigencia_hasta ?? "");
  const [observaciones, setObservaciones] = useState(tarifa?.observaciones ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const rutaObligatoria = rutaEsObligatoria(modalidad);
  const modalidadMeta = useMemo(
    () => MODALIDADES.find((m) => m.value === modalidad)!,
    [modalidad],
  );

  if (!open) return null;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const fd = new FormData();
    fd.set("cliente_id", clienteId);
    fd.set("ruta_id", rutaId);
    fd.set("modalidad", modalidad);
    fd.set("valor", valor);
    fd.set("moneda", moneda);
    fd.set("vigencia_desde", vigDesde);
    fd.set("vigencia_hasta", vigHasta);
    fd.set("observaciones", observaciones);

    startTransition(async () => {
      const result = editando
        ? await actualizarTarifa(tarifa!.id, fd)
        : await crearTarifa(fd);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      onSaved();
    });
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={() => !isPending && onClose()}
      />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg bg-white rounded-[8px] shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
          <h2 className="text-[#0F172A] text-base font-semibold">
            {editando ? "Editar tarifa" : "Nueva tarifa"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="p-1 rounded-lg hover:bg-[#F1F5F9] text-[#475569]"
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-3 py-2 text-sm text-[#7F1D1D]">
              {error}
            </div>
          )}

          <FieldRow label="Cliente" required>
            <select
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              required
              disabled={isPending}
              className="h-10 w-full text-sm rounded-lg border border-[#E2E8F0] bg-white px-3 outline-none focus-visible:border-[#0088D1] focus-visible:ring-3 focus-visible:ring-[#0088D1]/30"
            >
              <option value="">Seleccionar cliente…</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </FieldRow>

          <FieldRow label="Modalidad" required>
            <select
              value={modalidad}
              onChange={(e) => setModalidad(e.target.value as TarifaModalidad)}
              required
              disabled={isPending}
              className="h-10 w-full text-sm rounded-lg border border-[#E2E8F0] bg-white px-3 outline-none focus-visible:border-[#0088D1] focus-visible:ring-3 focus-visible:ring-[#0088D1]/30"
            >
              {MODALIDADES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <span className="text-[10px] text-[#94A3B8]">{modalidadMeta.pista}</span>
          </FieldRow>

          <FieldRow
            label="Ruta"
            required={rutaObligatoria}
            hint={
              rutaObligatoria
                ? "Obligatoria para esta modalidad"
                : "Opcional — sin ruta = tarifa por defecto del cliente"
            }
          >
            <select
              value={rutaId}
              onChange={(e) => setRutaId(e.target.value)}
              disabled={isPending}
              className="h-10 w-full text-sm rounded-lg border border-[#E2E8F0] bg-white px-3 outline-none focus-visible:border-[#0088D1] focus-visible:ring-3 focus-visible:ring-[#0088D1]/30"
            >
              {!rutaObligatoria && (
                <option value="_sin_ruta">Sin ruta específica</option>
              )}
              {rutaObligatoria && <option value="">Seleccionar ruta…</option>}
              {rutas.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.origen} → {r.destino} ({r.km_oficiales} km)
                </option>
              ))}
            </select>
          </FieldRow>

          <div className="grid grid-cols-[1fr_100px] gap-3">
            <FieldRow label={`Valor (${modalidadMeta.unidad})`} required>
              <Input
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                required
                disabled={isPending}
                className="h-10 text-sm"
              />
            </FieldRow>
            <FieldRow label="Moneda">
              <Input
                type="text"
                maxLength={3}
                value={moneda}
                onChange={(e) => setMoneda(e.target.value.toUpperCase())}
                disabled={isPending}
                className="h-10 text-sm uppercase"
              />
            </FieldRow>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Vigencia desde" required>
              <Input
                type="date"
                value={vigDesde}
                onChange={(e) => setVigDesde(e.target.value)}
                required
                disabled={isPending}
                className="h-10 text-sm"
              />
            </FieldRow>
            <FieldRow label="Vigencia hasta" hint="Opcional">
              <Input
                type="date"
                value={vigHasta}
                onChange={(e) => setVigHasta(e.target.value)}
                disabled={isPending}
                className="h-10 text-sm"
              />
            </FieldRow>
          </div>

          <FieldRow label="Observaciones" hint="Opcional, máx. 500 caracteres">
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              disabled={isPending}
              maxLength={500}
              rows={3}
              className="w-full text-sm rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 outline-none focus-visible:border-[#0088D1] focus-visible:ring-3 focus-visible:ring-[#0088D1]/30 resize-none"
            />
          </FieldRow>
        </form>

        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-[#E2E8F0] bg-[#F8FAFC] rounded-b-[8px]">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="brand"
            size="sm"
            disabled={isPending}
            onClick={(e) => onSubmit(e as unknown as React.FormEvent)}
          >
            <Save size={13} />
            {isPending ? "Guardando…" : editando ? "Guardar cambios" : "Crear tarifa"}
          </Button>
        </div>
      </div>
    </>
  );
}

function FieldRow({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] font-semibold uppercase tracking-widest text-[#475569]">
        {label}
        {required && <span className="text-[#EF4444] ml-1">*</span>}
      </Label>
      {children}
      {hint && <p className="text-[10px] text-[#94A3B8]">{hint}</p>}
    </div>
  );
}
