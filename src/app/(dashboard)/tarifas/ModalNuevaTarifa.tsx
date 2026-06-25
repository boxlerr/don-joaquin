"use client";

import { useMemo, useState, useTransition } from "react";
import {
  X,
  Coins,
  Building2,
  Sliders,
  Navigation,
  DollarSign,
  Calendar,
  MessageSquare,
  Check,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";

const FIELD_COMBO_TRIGGER =
  "h-full border-0 rounded-none bg-transparent font-medium hover:bg-transparent focus-visible:ring-0";
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

  const reset = () => {
    setClienteId(tarifa?.cliente_id ?? "");
    setRutaId(tarifa?.ruta_id ?? "_sin_ruta");
    setModalidad((tarifa?.modalidad as TarifaModalidad) ?? "fija");
    setValor(tarifa ? String(tarifa.valor) : "");
    setMoneda(tarifa?.moneda ?? "ARS");
    setVigDesde(tarifa?.vigencia_desde ?? hoyISO());
    setVigHasta(tarifa?.vigencia_hasta ?? "");
    setObservaciones(tarifa?.observaciones ?? "");
    setError(null);
  };

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
        className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm transition-opacity"
        onClick={() => !isPending && onClose()}
      />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[min(760px,calc(100vw-2rem))] max-h-[95vh] flex flex-col bg-card rounded-[16px] shadow-2xl border border-border">
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-border">
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center size-12 rounded-full bg-[#E1F5FE] text-primary shrink-0">
              <Coins size={22} />
            </div>
            <div>
              <h2 className="text-foreground text-lg font-bold">
                {editando ? "Editar tarifa" : "Nueva tarifa"}
              </h2>
              <p className="text-muted-foreground text-xs font-medium mt-0.5">
                Ingresá los parámetros de facturación y vigencia para esta tarifa.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="size-8 rounded-full text-muted-foreground hover:bg-muted inline-flex items-center justify-center transition-colors"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={onSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {error && (
            <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-3 py-2 text-xs text-[#7F1D1D] font-medium">
              {error}
            </div>
          )}

          {/* Fila 1: Cliente + Modalidad + Ruta */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Cliente */}
            <SelectFieldWithIcon
              label="Cliente *"
              name="cliente_id"
              value={clienteId}
              onValueChange={setClienteId}
              required
              disabled={isPending}
              icon={Building2}
              options={clientes.map((c) => ({ value: c.id, label: c.nombre }))}
              placeholder="Seleccionar cliente…"
            />

            {/* Modalidad */}
            <div className="space-y-1">
              <SelectFieldWithIcon
                label="Modalidad *"
                name="modalidad"
                value={modalidad}
                onValueChange={(v) => setModalidad(v as TarifaModalidad)}
                required
                disabled={isPending}
                icon={Sliders}
                options={MODALIDADES.map((m) => ({ value: m.value, label: m.label }))}
              />
              <span className="text-[10px] text-muted-foreground/70 block px-1 truncate font-medium">
                {modalidadMeta.pista}
              </span>
            </div>

            {/* Ruta */}
            <div className="space-y-1">
              <SelectFieldWithIcon
                label={rutaObligatoria ? "Ruta *" : "Ruta"}
                name="ruta_id"
                value={rutaId}
                onValueChange={setRutaId}
                required={rutaObligatoria}
                disabled={isPending}
                icon={Navigation}
                options={[
                  ...(!rutaObligatoria ? [{ value: "_sin_ruta", label: "Sin ruta específica" }] : []),
                  ...rutas.map((r) => ({
                    value: r.id,
                    label: `${r.origen} → ${r.destino} (${r.km_oficiales} km)`,
                  })),
                ]}
                placeholder={rutaObligatoria ? "Seleccionar ruta…" : undefined}
              />
              <span className="text-[10px] text-muted-foreground/70 block px-1 truncate font-medium">
                {rutaObligatoria
                  ? "Obligatoria para esta modalidad"
                  : "Opcional (tarifa por defecto)"}
              </span>
            </div>
          </div>

          {/* Fila 2: Valor + Moneda + Vigencia Desde + Vigencia Hasta */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {/* Valor */}
            <InputFieldWithIcon
              label={`Valor (${modalidadMeta.unidad}) *`}
              name="valor"
              type="number"
              step="0.01"
              min="0"
              required
              disabled={isPending}
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              icon={DollarSign}
            />

            {/* Moneda */}
            <InputFieldWithIcon
              label="Moneda *"
              name="moneda"
              type="text"
              maxLength={3}
              required
              disabled={isPending}
              value={moneda}
              onChange={(e) => setMoneda(e.target.value.toUpperCase())}
              icon={Coins}
              className="uppercase"
            />

            {/* Vigencia Desde */}
            <InputFieldWithIcon
              label="Vigencia desde *"
              name="vigencia_desde"
              type="date"
              required
              disabled={isPending}
              value={vigDesde}
              onChange={(e) => setVigDesde(e.target.value)}
              icon={Calendar}
            />

            {/* Vigencia Hasta */}
            <InputFieldWithIcon
              label="Vigencia hasta"
              name="vigencia_hasta"
              type="date"
              disabled={isPending}
              value={vigHasta}
              onChange={(e) => setVigHasta(e.target.value)}
              icon={Calendar}
              placeholder="Opcional"
            />
          </div>

          {/* Fila 3: Observaciones */}
          <TextareaFieldWithIcon
            label="Observaciones"
            name="observaciones"
            placeholder="Opcional, máx. 500 caracteres"
            maxLength={500}
            disabled={isPending}
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            icon={MessageSquare}
          />

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-3.5 border-t border-border mt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="h-10 px-6 rounded-lg text-sm font-semibold border border-border text-muted-foreground hover:bg-muted/40 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="bg-[#0088D1] hover:bg-[#0277BD] text-white flex items-center justify-center gap-1.5 h-10 px-6 rounded-lg text-sm font-bold shadow-sm hover:shadow transition-all disabled:opacity-50"
            >
              {isPending ? (
                "Guardando…"
              ) : (
                <>
                  <Check size={16} strokeWidth={2.5} />{" "}
                  {editando ? "Guardar cambios" : "Crear tarifa"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

// Subcomponente Input con Icono incorporado
function InputFieldWithIcon({
  label,
  name,
  type = "text",
  placeholder,
  required,
  value,
  onChange,
  disabled,
  icon: Icon,
  step,
  min,
  maxLength,
  className = "",
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  icon: LucideIcon;
  step?: string;
  min?: string;
  maxLength?: number;
  className?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-semibold text-muted-foreground">{label}</Label>
      <div className="relative flex items-center h-10 w-full rounded-lg border border-border bg-card overflow-hidden focus-within:ring-2 focus-within:ring-[#0088D1]/20 focus-within:border-[#0088D1] transition-all">
        <div className="flex items-center justify-center w-10 h-full border-r border-border bg-muted/50 text-primary shrink-0">
          <Icon size={15} />
        </div>
        <input
          name={name}
          type={type}
          placeholder={placeholder}
          required={required}
          value={value}
          onChange={onChange}
          disabled={disabled}
          step={step}
          min={min}
          maxLength={maxLength}
          className={`flex-1 h-full px-3 text-sm bg-transparent border-0 outline-none focus:outline-none focus:ring-0 text-foreground ${className}`}
        />
      </div>
    </div>
  );
}

// Subcomponente Select con Icono y Chevron
function SelectFieldWithIcon({
  label,
  name,
  value,
  onValueChange,
  options,
  required,
  disabled,
  icon: Icon,
  placeholder,
}: {
  label: string;
  name: string;
  value: string;
  onValueChange: (v: string) => void;
  options: { value: string; label: string }[];
  required?: boolean;
  disabled?: boolean;
  icon: LucideIcon;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-semibold text-muted-foreground">{label}</Label>
      <div className="relative flex items-center h-10 w-full rounded-lg border border-border bg-card overflow-hidden focus-within:ring-2 focus-within:ring-[#0088D1]/20 focus-within:border-[#0088D1] transition-all">
        <div className="flex items-center justify-center w-10 h-full border-r border-border bg-muted/50 text-primary shrink-0">
          <Icon size={15} />
        </div>
        <Combobox
          name={name}
          required={required}
          value={value}
          disabled={disabled}
          onValueChange={onValueChange}
          options={options.map((o) => ({ id: o.value, label: o.label }))}
          placeholder={placeholder}
          triggerClassName={FIELD_COMBO_TRIGGER}
        />
      </div>
    </div>
  );
}

// Subcomponente Textarea con Icono
function TextareaFieldWithIcon({
  label,
  name,
  placeholder,
  required,
  value,
  onChange,
  disabled,
  maxLength,
  icon: Icon,
}: {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  disabled?: boolean;
  maxLength?: number;
  icon: LucideIcon;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-semibold text-muted-foreground">{label}</Label>
      <div className="relative flex items-start w-full rounded-lg border border-border bg-card overflow-hidden focus-within:ring-2 focus-within:ring-[#0088D1]/20 focus-within:border-[#0088D1] transition-all">
        <div className="flex items-center justify-center w-10 h-10 border-r border-border bg-muted/50 text-primary shrink-0">
          <Icon size={15} />
        </div>
        <textarea
          name={name}
          placeholder={placeholder}
          required={required}
          value={value}
          onChange={onChange}
          disabled={disabled}
          maxLength={maxLength}
          className="flex-1 min-h-[70px] p-2.5 text-sm bg-transparent border-0 outline-none focus:outline-none focus:ring-0 text-foreground resize-none"
        />
      </div>
    </div>
  );
}
