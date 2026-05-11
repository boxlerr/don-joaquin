"use client";

import { useTransition, useState } from "react";
import { Settings, Save, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { guardarAjustes, type TarifaParams } from "./actions";

export default function AjustesTarifa({ params }: { params: TarifaParams }) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function onSubmit(formData: FormData) {
    setSaved(false);
    startTransition(async () => {
      await guardarAjustes(formData);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    });
  }

  return (
    <div className="bg-white rounded-[8px] border border-[#E2E8F0] shadow-sm">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-[#E2E8F0]">
        <Settings size={16} className="text-[#0088D1]" />
        <div>
          <h2 className="text-[#0F172A] text-sm font-semibold">Ajustes de tarifa</h2>
          <p className="text-[#94A3B8] text-xs">Valores base para el cálculo</p>
        </div>
      </div>

      <form action={onSubmit} className="p-5 space-y-4">
        <div className="space-y-2">
          <Label
            htmlFor="tarifa_base"
            className="text-[10px] font-semibold uppercase tracking-widest text-[#475569]"
          >
            Tarifa base ($)
          </Label>
          <Input
            id="tarifa_base"
            name="tarifa_base"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            defaultValue={params.tarifa_base}
            required
            className="h-10 text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="precio_por_kg"
            className="text-[10px] font-semibold uppercase tracking-widest text-[#475569]"
          >
            Precio por kg ($)
          </Label>
          <Input
            id="precio_por_kg"
            name="precio_por_kg"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            defaultValue={params.precio_por_kg}
            required
            className="h-10 text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="precio_por_km"
            className="text-[10px] font-semibold uppercase tracking-widest text-[#475569]"
          >
            Precio por km ($)
          </Label>
          <Input
            id="precio_por_km"
            name="precio_por_km"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            defaultValue={params.precio_por_km}
            required
            className="h-10 text-sm"
          />
        </div>

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
      </form>
    </div>
  );
}
