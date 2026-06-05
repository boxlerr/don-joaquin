"use client";

import { useState, useTransition } from "react";
import {
  X,
  Route,
  MapPin,
  Flag,
  Navigation,
  Hash,
  MessageSquare,
  Check,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  crearCircuito,
  actualizarCircuito,
  type CircuitoConRelaciones,
  type PuntoRutaOption,
} from "./actions";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  puntos: PuntoRutaOption[];
  circuito?: CircuitoConRelaciones | null;
};

export default function ModalNuevoCircuito({
  open,
  onClose,
  onSaved,
  puntos,
  circuito,
}: Props) {
  const editando = !!circuito;

  const [origen, setOrigen] = useState(circuito?.origen_nombre ?? "");
  const [destino, setDestino] = useState(circuito?.destino_nombre ?? "");
  const [kmCarga, setKmCarga] = useState(
    circuito ? String(circuito.km_oficiales) : "0",
  );
  const [kmVacios, setKmVacios] = useState(
    circuito ? String(circuito.km_vacios) : "0",
  );
  const [codigo, setCodigo] = useState(circuito?.codigo_interno ?? "");
  const [descripcion, setDescripcion] = useState(circuito?.descripcion ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!open) return null;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const fd = new FormData();
    fd.set("origen_nombre", origen);
    fd.set("destino_nombre", destino);
    fd.set("km_oficiales", kmCarga);
    fd.set("km_vacios", kmVacios);
    fd.set("codigo_interno", codigo);
    fd.set("descripcion", descripcion);

    startTransition(async () => {
      const result = editando
        ? await actualizarCircuito(circuito!.id, fd)
        : await crearCircuito(fd);
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
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[min(680px,calc(100vw-2rem))] max-h-[95vh] flex flex-col bg-card rounded-[16px] shadow-2xl border border-border">
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-border">
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center size-12 rounded-full bg-[#E1F5FE] text-primary shrink-0">
              <Route size={22} />
            </div>
            <div>
              <h2 className="text-foreground text-lg font-bold">
                {editando ? "Editar circuito" : "Nuevo circuito"}
              </h2>
              <p className="text-muted-foreground text-xs font-medium mt-0.5">
                Definí origen, destino y los km cargados y vacíos típicos. Al cargar
                un viaje con este circuito se autocompletan.
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

          <datalist id="circuito-puntos-list">
            {puntos.map((p) => (
              <option key={p.id} value={p.label} />
            ))}
          </datalist>

          {/* Origen / Destino */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <CampoInput
              label="Origen *"
              icon={MapPin}
              value={origen}
              onChange={setOrigen}
              placeholder="Escribí ciudad o lugar…"
              list="circuito-puntos-list"
              disabled={isPending}
              required
            />
            <CampoInput
              label="Destino *"
              icon={Flag}
              value={destino}
              onChange={setDestino}
              placeholder="Escribí ciudad o lugar…"
              list="circuito-puntos-list"
              disabled={isPending}
              required
            />
          </div>

          {/* Km con carga / Km vacíos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <CampoInput
                label="Km con carga *"
                icon={Navigation}
                type="number"
                value={kmCarga}
                onChange={setKmCarga}
                disabled={isPending}
                min="0"
                required
              />
              <span className="text-[10px] text-muted-foreground/70 block px-1 font-medium">
                Distancia cargada del tramo
              </span>
            </div>
            <div className="space-y-1">
              <CampoInput
                label="Km vacíos *"
                icon={Navigation}
                type="number"
                value={kmVacios}
                onChange={setKmVacios}
                disabled={isPending}
                min="0"
                required
              />
              <span className="text-[10px] text-muted-foreground/70 block px-1 font-medium">
                Retorno vacío típico del circuito
              </span>
            </div>
          </div>

          {/* Código interno */}
          <CampoInput
            label="Código interno"
            icon={Hash}
            value={codigo}
            onChange={setCodigo}
            placeholder="Opcional (ej. 110)"
            maxLength={30}
            disabled={isPending}
          />

          {/* Descripción */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-muted-foreground">
              Descripción
            </Label>
            <div className="relative flex items-start w-full rounded-lg border border-border bg-card overflow-hidden focus-within:ring-2 focus-within:ring-[#0088D1]/20 focus-within:border-[#0088D1] transition-all">
              <div className="flex items-center justify-center w-10 h-10 border-r border-border bg-muted/50 text-primary shrink-0">
                <MessageSquare size={15} />
              </div>
              <textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                disabled={isPending}
                maxLength={200}
                placeholder="Opcional, máx. 200 caracteres"
                className="flex-1 min-h-[64px] p-2.5 text-sm bg-transparent border-0 outline-none focus:outline-none focus:ring-0 text-foreground resize-none"
              />
            </div>
          </div>

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
                  {editando ? "Guardar cambios" : "Crear circuito"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

function CampoInput({
  label,
  icon: Icon,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
  disabled,
  min,
  maxLength,
  list,
}: {
  label: string;
  icon: React.ComponentType<{ size?: number | string }>;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  min?: string;
  maxLength?: number;
  list?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-semibold text-muted-foreground">{label}</Label>
      <div className="relative flex items-center h-10 w-full rounded-lg border border-border bg-card overflow-hidden focus-within:ring-2 focus-within:ring-[#0088D1]/20 focus-within:border-[#0088D1] transition-all">
        <div className="flex items-center justify-center w-10 h-full border-r border-border bg-muted/50 text-primary shrink-0">
          <Icon size={15} />
        </div>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          min={min}
          maxLength={maxLength}
          list={list}
          className="flex-1 h-full px-3 text-sm bg-transparent border-0 outline-none focus:outline-none focus:ring-0 text-foreground"
        />
      </div>
    </div>
  );
}
