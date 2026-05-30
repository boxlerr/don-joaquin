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
import { SlidersHorizontal, RotateCcw } from "lucide-react";
import { updateRankingCriteriosAction } from "./actions";
import { RANKING_CRITERIOS_DEFAULT, type RankingCriterios } from "./criterios";

// Criterios en orden de aparición, con etiqueta amigable para Bárbara.
const CRITERIOS: { key: keyof RankingCriterios; label: string; hint: string }[] = [
  { key: "vacios_leve", label: "Km vacíos 20–30%", hint: "Resta si maneja con 20% a 30% sin carga" },
  { key: "vacios_moderado", label: "Km vacíos 30–40%", hint: "Resta si maneja con 30% a 40% sin carga" },
  { key: "vacios_alto", label: "Km vacíos +40%", hint: "Resta si maneja con más del 40% sin carga" },
  { key: "rotura", label: "Cada rotura de goma", hint: "Resta por cada goma rota" },
  { key: "taller", label: "Cada visita al taller", hint: "Resta por cada reparación o gomería" },
  { key: "aperc", label: "Cada apercibimiento", hint: "Resta por cada apercibimiento del chofer" },
  { key: "licencia", label: "Licencia médica activa", hint: "Resta si tuvo una licencia en el período" },
];

export default function CriteriosButton({ criterios }: { criterios: RankingCriterios }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [valores, setValores] = useState<RankingCriterios>(criterios);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const setVal = (k: keyof RankingCriterios, v: string) =>
    setValores((prev) => ({ ...prev, [k]: v === "" ? 0 : Math.max(0, parseInt(v) || 0) }));

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
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="text-foreground text-xl">Criterios del ranking</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Cada chofer arranca en <strong>100 puntos</strong>. Definí cuántos puntos resta cada
            cosa: mientras más puntos le pongas a un criterio, más castiga la nota. El ranking se
            recalcula con estos valores.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-2 max-h-[55vh] overflow-y-auto">
          {error && <InlineFeedback variant="error" message={error} onDismiss={() => setError(null)} autoHideMs={0} />}
          {success && <InlineFeedback variant="success" message={success} onDismiss={() => setSuccess(null)} />}

          {CRITERIOS.map((c) => (
            <div key={c.key} className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-2">
              <div className="min-w-0">
                <Label htmlFor={`peso-${c.key}`} className="text-sm font-medium text-foreground">{c.label}</Label>
                <p className="text-[11px] text-muted-foreground">{c.hint}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-xs text-muted-foreground">−</span>
                <Input
                  id={`peso-${c.key}`}
                  type="number"
                  min={0}
                  max={100}
                  value={String(valores[c.key])}
                  onChange={(e) => setVal(c.key, e.target.value)}
                  className="w-16 h-8 text-sm text-right"
                />
                <span className="text-xs text-muted-foreground">pts</span>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="pt-2 sm:justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setValores(RANKING_CRITERIOS_DEFAULT)}
            disabled={loading}
            className="text-muted-foreground border-border hover:bg-muted/40 gap-1.5"
          >
            <RotateCcw size={13} /> Valores por defecto
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

