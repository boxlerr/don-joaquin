"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import InlineFeedback from "@/components/ui/InlineFeedback";
import { SlidersHorizontal, RotateCcw, CheckCircle2, AlertTriangle } from "lucide-react";
import { updateRankingCriteriosAction } from "./actions";
import {
  RANKING_CRITERIOS_DEFAULT,
  CONCEPTOS_META,
  TRAMOS_META,
  type RankingCriterios,
  type ConceptoKey,
} from "./criterios";

export default function CriteriosButton({ criterios }: { criterios: RankingCriterios }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [valores, setValores] = useState<RankingCriterios>(criterios);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const setTope = (k: ConceptoKey, v: string) =>
    setValores((prev) => ({
      ...prev,
      topes: { ...prev.topes, [k]: v === "" ? 0 : Math.max(0, parseInt(v) || 0) },
    }));

  // Los % se editan en números enteros (0–100) y se guardan como fracción 0..1.
  const setTramo = (concepto: ConceptoKey, nivel: string, v: string) =>
    setValores((prev) => {
      const pct = v === "" ? 0 : Math.max(0, Math.min(100, parseInt(v) || 0)) / 100;
      const grupo = { ...(prev.tramos[concepto] as Record<string, number>), [nivel]: pct };
      return { ...prev, tramos: { ...prev.tramos, [concepto]: grupo } };
    });

  const setRef = (field: "km_ref_mensual" | "combustible_ref", v: string) =>
    setValores((prev) => ({ ...prev, [field]: v === "" ? 0 : Math.max(0, parseFloat(v) || 0) }));

  const tramoPct = (concepto: ConceptoKey, nivel: string) =>
    Math.round(((valores.tramos[concepto] as Record<string, number>)[nivel] ?? 0) * 100);

  const sumaTopes = (Object.keys(valores.topes) as ConceptoKey[]).reduce((s, k) => s + (valores.topes[k] || 0), 0);
  const sumaOk = sumaTopes === 100;

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await updateRankingCriteriosAction(valores);
      if (res.error) setError(res.error);
      else {
        setSuccess("Criterios guardados. El ranking se recalcula con estos valores.");
        router.refresh();
        setTimeout(() => setOpen(false), 1000);
      }
    } catch {
      setError("Ocurrió un error inesperado.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) setValores(criterios); // recargar al abrir
      }}
    >
      <DialogTrigger
        render={
          <button className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-border bg-background text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            <SlidersHorizontal size={14} />
            Configurar criterios
          </button>
        }
      />
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="text-foreground text-xl">Configurar el score</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Cada chofer arranca en <strong>100 puntos</strong>. Por cada concepto definís el{" "}
            <strong>tope</strong> (cuántos puntos vale como máximo) y <strong>cuánto resta</strong> en
            cada nivel. Los topes deberían sumar 100. El ranking se recalcula al guardar.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-2.5 max-h-[60vh] overflow-y-auto">
          {error && <InlineFeedback variant="error" message={error} onDismiss={() => setError(null)} autoHideMs={0} />}
          {success && <InlineFeedback variant="success" message={success} onDismiss={() => setSuccess(null)} />}

          {/* Suma de topes */}
          <div
            className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm sticky top-0 z-10 ${
              sumaOk ? "border-[#A7F3D0] bg-[#ECFDF5] text-[#065F46]" : "border-amber-300 bg-amber-50 text-amber-800"
            }`}
          >
            <span className="flex items-center gap-1.5 font-medium">
              {sumaOk ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
              {sumaOk ? "Los topes suman 100" : "Los topes deberían sumar 100"}
            </span>
            <span className="font-bold tabular-nums">{sumaTopes}</span>
          </div>

          {/* Una tarjeta por concepto: tope + % por nivel */}
          {CONCEPTOS_META.map((c) => (
            <div key={c.key} className="rounded-lg border border-border px-3 py-2.5 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <Label htmlFor={`tope-${c.key}`} className="text-sm font-semibold text-foreground">
                    {c.label}
                  </Label>
                  <p className="text-[11px] text-muted-foreground">{c.categoria}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[11px] text-muted-foreground">tope</span>
                  <Input
                    id={`tope-${c.key}`}
                    type="number"
                    min={0}
                    max={100}
                    value={String(valores.topes[c.key])}
                    onChange={(e) => setTope(c.key, e.target.value)}
                    className="w-14 h-8 text-sm text-right"
                  />
                  <span className="text-xs text-muted-foreground">pts</span>
                </div>
              </div>
              {/* Niveles editables (% de descuento del tope) */}
              <div className="grid grid-cols-3 gap-2">
                {TRAMOS_META[c.key].map((nivel) => (
                  <div key={nivel.key} className="rounded-md bg-muted/40 border border-border px-2 py-1.5">
                    <p className="text-[11px] font-medium text-foreground leading-tight">{nivel.label}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight mb-1">{nivel.condicion}</p>
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-muted-foreground">−</span>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={String(tramoPct(c.key, nivel.key))}
                        onChange={(e) => setTramo(c.key, nivel.key, e.target.value)}
                        className="w-12 h-7 text-xs text-right px-1.5"
                      />
                      <span className="text-[11px] text-muted-foreground">%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Referencias */}
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground pt-1 px-1">
            Referencias
          </p>
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-2">
            <div className="min-w-0">
              <Label htmlFor="ref-km" className="text-sm font-medium text-foreground">Objetivo de km por mes</Label>
              <p className="text-[11px] text-muted-foreground">Km mensuales considerados &ldquo;muy bueno&rdquo; (100%)</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Input id="ref-km" type="number" min={0} step={500} value={String(valores.km_ref_mensual)} onChange={(e) => setRef("km_ref_mensual", e.target.value)} className="w-24 h-8 text-sm text-right" />
              <span className="text-xs text-muted-foreground">km</span>
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-2">
            <div className="min-w-0">
              <Label htmlFor="ref-comb" className="text-sm font-medium text-foreground">Consumo de referencia</Label>
              <p className="text-[11px] text-muted-foreground">Hasta este consumo el chofer no pierde puntos</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Input id="ref-comb" type="number" min={0} step={0.1} value={String(valores.combustible_ref)} onChange={(e) => setRef("combustible_ref", e.target.value)} className="w-24 h-8 text-sm text-right" />
              <span className="text-xs text-muted-foreground">L/100km</span>
            </div>
          </div>
        </div>

        <DialogFooter className="pt-2 sm:justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setValores(RANKING_CRITERIOS_DEFAULT)}
            disabled={loading}
            className="text-muted-foreground border-border hover:bg-muted/40 gap-1.5"
          >
            <RotateCcw size={13} /> Valores de la planilla
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading} className="text-muted-foreground border-border hover:bg-muted/40">
              Cancelar
            </Button>
            <Button type="button" onClick={handleSave} disabled={loading} variant="brand" className="bg-[#0088D1] hover:bg-[#0277BD] text-white">
              {loading ? "Guardando..." : "Guardar criterios"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
