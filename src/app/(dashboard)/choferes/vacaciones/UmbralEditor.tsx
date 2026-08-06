"use client";

// Editor del tope de gente de vacaciones por semana.
//
// No trae diálogo propio: se dibuja DENTRO del de "Cargar vacaciones", que es el
// único lugar donde el número se usa (ahí se ve cuánta gente ya está de
// vacaciones esa semana, y las semanas sugeridas son las que quedan por debajo).
// Antes vivía en un botón del encabezado, lejos de eso.
//
// Al entrar acá el formulario de carga no se desmonta, sólo se esconde: se
// vuelve con el empleado y las fechas como estaban.
//
// La base puede ser un % de la flota o un número fijo, y cada mes puede tener el
// suyo: en diciembre y enero se toman muchos juntos y tratarlo como un problema
// es ruido (pedido de Bárbara).

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { guardarUmbralConfigAction } from "./actions";
import {
  MESES_LARGO,
  UMBRAL_DEFAULT,
  umbralBase,
  umbralDeMes,
  type UmbralConfig,
} from "./umbral";

interface Props {
  config: UmbralConfig;
  choferesActivos: number;
  onVolver: () => void;
  onGuardado: () => void;
}

export default function UmbralEditor({ config, choferesActivos, onVolver, onGuardado }: Props) {
  const [modo, setModo] = useState<UmbralConfig["modo"]>(config.modo);
  const [porcentaje, setPorcentaje] = useState(String(config.porcentaje));
  const [minimo, setMinimo] = useState(String(config.minimo));
  const [fijo, setFijo] = useState(String(config.fijo));
  const [porMes, setPorMes] = useState<Record<number, string>>(
    Object.fromEntries(Object.entries(config.porMes).map(([m, v]) => [Number(m), String(v)])),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const actual: UmbralConfig = {
    modo,
    porcentaje: Number(porcentaje) || 0,
    minimo: Number(minimo) || 0,
    fijo: Number(fijo) || 0,
    porMes: Object.fromEntries(
      Object.entries(porMes)
        .filter(([, v]) => v.trim() !== "")
        .map(([m, v]) => [Number(m), Number(v) || 0]),
    ),
  };
  const base = umbralBase(actual, choferesActivos);

  const guardar = async () => {
    setLoading(true);
    setError(null);
    const res = await guardarUmbralConfigAction(actual);
    setLoading(false);
    if (res?.error) setError(res.error);
    else onGuardado();
  };

  const restablecer = () => {
    setModo(UMBRAL_DEFAULT.modo);
    setPorcentaje(String(UMBRAL_DEFAULT.porcentaje));
    setMinimo(String(UMBRAL_DEFAULT.minimo));
    setFijo(String(UMBRAL_DEFAULT.fijo));
    setPorMes({});
  };

  return (
    <div className="space-y-4">
      <div>
        <button
          type="button"
          onClick={onVolver}
          className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={13} /> Volver a cargar vacaciones
        </button>
        <p className="pr-8 text-base font-medium text-foreground">
          Cuánta gente puede irse de vacaciones a la vez
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Es el tope por semana. Se avisa si la semana elegida ya lo alcanzó, y las semanas que se
          proponen son las que quedan por debajo.
        </p>
      </div>

      {error && (
        <div className="rounded-[6px] border-l-2 border-[#B91C1C] py-1.5 pl-3 text-sm text-[#B91C1C]">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground">Cómo sale el tope</Label>
        <div className="inline-flex overflow-hidden rounded-lg border border-border">
          <button
            type="button"
            onClick={() => setModo("auto")}
            className={`h-9 whitespace-nowrap px-3 text-xs ${
              modo === "auto"
                ? "bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground"
            }`}
          >
            % de la flota
          </button>
          <button
            type="button"
            onClick={() => setModo("fijo")}
            className={`h-9 whitespace-nowrap px-3 text-xs ${
              modo === "fijo"
                ? "bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground"
            }`}
          >
            Número fijo
          </button>
        </div>

        {modo === "auto" ? (
          <div className="flex flex-wrap items-end gap-3 pt-1">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">
                % de la flota activa
              </Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={porcentaje}
                onChange={(e) => setPorcentaje(e.target.value)}
                className="w-24"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">Nunca menos de</Label>
              <Input
                type="number"
                min={0}
                value={minimo}
                onChange={(e) => setMinimo(e.target.value)}
                className="w-24"
              />
            </div>
            <p className="pb-2.5 text-xs text-muted-foreground">
              Con {choferesActivos} activos son{" "}
              <span className="font-semibold text-foreground">{base}</span> por semana
            </p>
          </div>
        ) : (
          <div className="space-y-1 pt-1">
            <Label className="text-xs font-medium text-muted-foreground">Personas por semana</Label>
            <Input
              type="number"
              min={0}
              value={fijo}
              onChange={(e) => setFijo(e.target.value)}
              className="w-24"
            />
          </div>
        )}
      </div>

      <div className="space-y-2 border-t border-border pt-3">
        <div>
          <Label className="text-sm font-medium text-foreground">Meses con tope propio</Label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Dejalo vacío para que el mes use el tope de arriba ({base}). Sirve para diciembre y
            enero, donde se toman muchos juntos y no es una anomalía.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          {MESES_LARGO.map((nombre, i) => {
            const mes = i + 1;
            const v = porMes[mes] ?? "";
            const efectivo = umbralDeMes(actual, mes, choferesActivos);
            return (
              // Envuelve: con el mes + el campo + el "= N" de los meses con valor
              // propio, la celda pasaba los ~150px que deja la mitad del diálogo
              // en el celular y el resultado quedaba cortado contra el borde.
              <div key={mes} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <label
                  htmlFor={`tope-mes-${mes}`}
                  className="w-16 shrink-0 truncate text-xs text-muted-foreground sm:w-20"
                >
                  {nombre}
                </label>
                <Input
                  id={`tope-mes-${mes}`}
                  type="number"
                  min={0}
                  value={v}
                  placeholder={String(base)}
                  onChange={(e) =>
                    setPorMes((p) => {
                      const next = { ...p };
                      if (e.target.value === "") delete next[mes];
                      else next[mes] = e.target.value;
                      return next;
                    })
                  }
                  className="h-9 w-14 text-right font-mono text-sm sm:h-8 sm:w-16"
                />
                {v.trim() !== "" && (
                  <span className="font-mono text-[10px] text-muted-foreground/70">
                    = {efectivo}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="-mx-4 -mb-4 mt-2 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 px-4 py-3 sm:-mx-6 sm:-mb-6 sm:flex-row sm:justify-end sm:px-6 sm:py-4 max-sm:*:w-full">
        <Button
          type="button"
          variant="outline"
          onClick={restablecer}
          disabled={loading}
          className="border-border text-muted-foreground sm:mr-auto"
        >
          <RotateCcw size={13} className="mr-1.5" /> Valores por defecto
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onVolver}
          disabled={loading}
          className="border-border text-muted-foreground"
        >
          Cancelar
        </Button>
        <Button type="button" variant="brand" onClick={guardar} disabled={loading}>
          {loading ? "Guardando…" : "Guardar tope"}
        </Button>
      </div>
    </div>
  );
}
