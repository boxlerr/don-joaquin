"use client";

import { useState } from "react";
import { Calculator, DollarSign, Weight, Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TarifaParams } from "./actions";

function formatARS(n: number): string {
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function CalculadoraFlete({ params }: { params: TarifaParams }) {
  const [peso, setPeso] = useState("");
  const [distancia, setDistancia] = useState("");
  const [precio, setPrecio] = useState<number | null>(null);

  function calcular() {
    const p = Number(peso);
    const d = Number(distancia);
    if (!Number.isFinite(p) || !Number.isFinite(d) || p < 0 || d < 0) {
      setPrecio(null);
      return;
    }
    setPrecio(params.tarifa_base + p * params.precio_por_kg + d * params.precio_por_km);
  }

  return (
    <div className="bg-white rounded-[8px] border border-[#E2E8F0] shadow-sm">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-[#E2E8F0]">
        <Calculator size={16} className="text-[#0088D1]" />
        <h2 className="text-[10px] font-semibold uppercase tracking-widest text-[#475569]">
          Calculadora de flete
        </h2>
      </div>

      <div className="p-5 space-y-5">
        <div className="space-y-2">
          <Label
            htmlFor="peso"
            className="text-[10px] font-semibold uppercase tracking-widest text-[#475569]"
          >
            Peso carga
          </Label>
          <div className="relative">
            <Weight size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <Input
              id="peso"
              type="number"
              step="0.1"
              min="0"
              inputMode="decimal"
              placeholder="Ej. 1500 (kg)"
              value={peso}
              onChange={(e) => setPeso(e.target.value)}
              className="h-11 pl-9 pr-12 text-sm"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#94A3B8]">
              kg.
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="distancia"
            className="text-[10px] font-semibold uppercase tracking-widest text-[#475569]"
          >
            Distancia recorrida
          </Label>
          <div className="relative">
            <Route size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <Input
              id="distancia"
              type="number"
              step="0.1"
              min="0"
              inputMode="decimal"
              placeholder="Ej. 350 (km)"
              value={distancia}
              onChange={(e) => setDistancia(e.target.value)}
              className="h-11 pl-9 pr-12 text-sm"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#94A3B8]">
              km.
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC]">
          <div className="flex items-center gap-2">
            <DollarSign size={14} className="text-[#0088D1]" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[#475569]">
              Precio estimado
            </span>
          </div>
          <span className="text-xl font-bold text-[#0F172A] font-mono">
            {precio === null ? "—" : `$ ${formatARS(precio)}`}
          </span>
        </div>

        <Button type="button" variant="brand" size="lg" onClick={calcular} className="w-full">
          <Calculator size={14} />
          Calcular tarifa
        </Button>
      </div>
    </div>
  );
}
