"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RotateCcw } from "lucide-react";
import { guardarUmbralConfigAction } from "./actions";
import {
  MESES_LARGO,
  UMBRAL_DEFAULT,
  umbralBase,
  umbralDeMes,
  type UmbralConfig,
} from "./umbral";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  config: UmbralConfig;
  choferesActivos: number;
  onSuccess: () => void;
}

/**
 * Editor del máximo de ausentes por semana. La base puede ser un % de la flota
 * o un número fijo, y cada mes puede tener el suyo: en diciembre y enero se
 * toman muchos juntos y marcar eso en rojo es ruido.
 */
export default function UmbralDialog({ open, onOpenChange, config, choferesActivos, onSuccess }: Props) {
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
    else {
      onSuccess();
      onOpenChange(false);
    }
  };

  const restablecer = () => {
    setModo(UMBRAL_DEFAULT.modo);
    setPorcentaje(String(UMBRAL_DEFAULT.porcentaje));
    setMinimo(String(UMBRAL_DEFAULT.minimo));
    setFijo(String(UMBRAL_DEFAULT.fijo));
    setPorMes({});
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="text-foreground text-xl">Máximo de ausentes por semana</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            A partir de cuánta gente de vacaciones a la vez el cronograma marca la semana en rojo.
            También es el tope que respeta el plan sugerido.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">{error}</div>
          )}

          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">Base</Label>
            <div className="inline-flex rounded-lg border border-border overflow-hidden">
              <button
                type="button"
                onClick={() => setModo("auto")}
                className={`px-3 h-9 text-xs whitespace-nowrap ${modo === "auto" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}
              >
                % de la flota
              </button>
              <button
                type="button"
                onClick={() => setModo("fijo")}
                className={`px-3 h-9 text-xs whitespace-nowrap ${modo === "fijo" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}
              >
                Número fijo
              </button>
            </div>

            {modo === "auto" ? (
              <div className="flex flex-wrap items-end gap-3 pt-1">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground">% de la flota activa</Label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={porcentaje}
                    onChange={(e) => setPorcentaje(e.target.value)}
                    className="w-24 sm:w-28"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground">Mínimo</Label>
                  <Input
                    type="number"
                    min={0}
                    value={minimo}
                    onChange={(e) => setMinimo(e.target.value)}
                    className="w-24 sm:w-28"
                  />
                </div>
                <p className="text-xs text-muted-foreground pb-2.5">
                  {choferesActivos} choferes activos →{" "}
                  <span className="font-mono font-semibold text-foreground">{base}</span> ausentes
                </p>
              </div>
            ) : (
              <div className="flex flex-wrap items-end gap-3 pt-1">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground">Ausentes por semana</Label>
                  <Input
                    type="number"
                    min={0}
                    value={fijo}
                    onChange={(e) => setFijo(e.target.value)}
                    className="w-24 sm:w-28"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2 pt-1 border-t border-border">
            <div className="pt-3">
              <Label className="text-sm font-medium text-foreground">Meses con umbral propio</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Dejalo vacío para que el mes use la base ({base}). Sirve para diciembre y enero, donde
                se toman muchos juntos y no es una anomalía.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-2">
              {MESES_LARGO.map((nombre, i) => {
                const mes = i + 1;
                const v = porMes[mes] ?? "";
                const efectivo = umbralDeMes(actual, mes, choferesActivos);
                return (
                  // Envuelve: con el mes (64px) + el campo (56px) + el "= N" de
                  // los meses con valor propio, la celda pasaba los ~150px que
                  // deja la mitad del diálogo en el celular y el resultado
                  // quedaba cortado contra el borde.
                  <div key={mes} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <label htmlFor={`umbral-mes-${mes}`} className="w-16 sm:w-20 shrink-0 truncate text-xs text-muted-foreground">
                      {nombre}
                    </label>
                    <Input
                      id={`umbral-mes-${mes}`}
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
                      className="h-9 sm:h-8 w-14 sm:w-16 text-right font-mono text-sm"
                    />
                    {v.trim() !== "" && (
                      <span className="text-[10px] font-mono text-muted-foreground/70">= {efectivo}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="pt-3 border-t border-[#F1F5F9] gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={restablecer}
            disabled={loading}
            className="mr-auto text-muted-foreground border-border"
          >
            <RotateCcw size={13} className="mr-1.5" /> Valores por defecto
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="text-muted-foreground border-border"
          >
            Cancelar
          </Button>
          <Button type="button" variant="brand" onClick={guardar} disabled={loading}>
            {loading ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
