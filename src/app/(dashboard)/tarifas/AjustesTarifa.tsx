"use client";

import { useTransition, useState } from "react";
import { Settings, Save, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { guardarAjustes, type TarifaParams } from "./actions";

export default function AjustesTarifa({
  params,
  canWrite = false,
}: {
  params: TarifaParams;
  canWrite?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [tarifaBase, setTarifaBase] = useState(String(params.tarifa_base));
  const [precioPorKg, setPrecioPorKg] = useState(String(params.precio_por_kg));
  const [precioPorKm, setPrecioPorKm] = useState(String(params.precio_por_km));

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaved(false);
    const fd = new FormData();
    fd.set("tarifa_base", tarifaBase);
    fd.set("precio_por_kg", precioPorKg);
    fd.set("precio_por_km", precioPorKm);
    startTransition(async () => {
      await guardarAjustes(fd);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    });
  }

  return (
    <div className="bg-card rounded-[8px] border border-border shadow-sm">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
        <Settings size={16} className="text-primary" />
        <div>
          <h2 className="text-foreground text-sm font-semibold">Ajustes de tarifa</h2>
          <p className="text-muted-foreground/70 text-xs">Valores base para el cálculo</p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="p-5 space-y-4">
        <div className="space-y-2">
          <Label
            htmlFor="tarifa_base"
            className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"
          >
            Tarifa base ($)
          </Label>
          <Input
            id="tarifa_base"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={tarifaBase}
            onChange={(e) => setTarifaBase(e.target.value)}
            required
            disabled={!canWrite}
            readOnly={!canWrite}
            className="h-10 text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="precio_por_kg"
            className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"
          >
            Precio por kg ($)
          </Label>
          <Input
            id="precio_por_kg"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={precioPorKg}
            onChange={(e) => setPrecioPorKg(e.target.value)}
            required
            disabled={!canWrite}
            readOnly={!canWrite}
            className="h-10 text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="precio_por_km"
            className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"
          >
            Precio por km ($)
          </Label>
          <Input
            id="precio_por_km"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={precioPorKm}
            onChange={(e) => setPrecioPorKm(e.target.value)}
            required
            disabled={!canWrite}
            readOnly={!canWrite}
            className="h-10 text-sm"
          />
        </div>

        {canWrite ? (
          <Button
            type="submit"
            variant="brand"
            size="lg"
            disabled={isPending}
            className="w-full"
          >
            {saved ? (
              <>
                <Check size={14} />
                Guardado
              </>
            ) : (
              <>
                <Save size={14} />
                {isPending ? "Guardando..." : "Guardar ajustes"}
              </>
            )}
          </Button>
        ) : (
          <p className="text-[11px] text-muted-foreground/70 text-center">
            Solo lectura — pedile a un administrador permisos de edición sobre Comercial.
          </p>
        )}
      </form>
    </div>
  );
}
