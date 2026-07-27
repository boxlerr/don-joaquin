"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
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
import { PlaceCombobox } from "@/components/ui/place-combobox";
import { addPrestamoAction } from "./actions";
import { listaBancos } from "./bancos";
import { Repeat, TrendingUp } from "lucide-react";

/**
 * Alta de un préstamo con los mismos campos de la planilla de la mamá:
 * banco, importe de cuota, tasa, cantidad de cuotas y por cuál va. El
 * cronograma completo se genera solo (una cuota por mes, mismo día).
 */
export default function AddPrestamoDialog({ bancos = [] }: { bancos?: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [banco, setBanco] = useState("");
  const [detalle, setDetalle] = useState("");
  const [referencia, setReferencia] = useState("");
  const [tasa, setTasa] = useState("");
  const [importeCuota, setImporteCuota] = useState("");
  const [cuotasTotal, setCuotasTotal] = useState("");
  const [proximaNro, setProximaNro] = useState("1");
  const [proximaFecha, setProximaFecha] = useState("");
  const [moneda, setMoneda] = useState<"ARS" | "USD">("ARS");
  const [variable, setVariable] = useState(false);
  const [recurrente, setRecurrente] = useState(false);
  const [diaMes, setDiaMes] = useState("");
  // El diálogo se monta en dos lugares (encabezado y tabla): ids únicos por
  // instancia para que las etiquetas nunca apunten al input equivocado.
  const uid = useId();
  // La lista se arma con los bancos que ya se usan; si escribe uno nuevo queda
  // disponible para la próxima carga sin tener que mantener nada.
  const opcionesBanco = listaBancos(bancos).map((b) => ({ id: b, label: b }));

  const reset = () => {
    setBanco("");
    setDetalle("");
    setReferencia("");
    setTasa("");
    setImporteCuota("");
    setCuotasTotal("");
    setProximaNro("1");
    setProximaFecha("");
    setMoneda("ARS");
    setVariable(false);
    setRecurrente(false);
    setDiaMes("");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!banco.trim()) {
      setError("Elegí o escribí el banco.");
      return;
    }
    if (recurrente && !diaMes.trim()) {
      setError("Indicá qué día del mes vence.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await addPrestamoAction({
        banco,
        detalle: detalle.trim() || null,
        referencia: referencia.trim() || null,
        tasa: tasa.trim() === "" ? null : Number(tasa) || 0,
        importe_cuota: Number(importeCuota) || 0,
        cuotas_total: parseInt(cuotasTotal) || 0,
        proxima_cuota_nro: parseInt(proximaNro) || 1,
        proxima_fecha: proximaFecha,
        moneda,
        cuota_variable: variable,
        es_recurrente: recurrente,
        dia_vencimiento: recurrente ? Number(diaMes) : null,
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setOpen(false);
      reset();
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (loading) return; setOpen(v); if (!v) reset(); }}>
      <DialogTrigger
        render={
          <Button size="sm">
            <Plus size={14} /> Cargar préstamo
          </Button>
        }
      />
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Cargar préstamo</DialogTitle>
          <DialogDescription>
            Los mismos datos de la planilla. El cronograma de cuotas (una por mes) se genera solo
            y después se puede corregir cuota por cuota.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-2.5 py-1.5">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <PlaceCombobox
              label="Banco"
              name={`${uid}-banco`}
              value={banco}
              onValueChange={setBanco}
              options={opcionesBanco}
              placeholder="Elegí o escribí uno nuevo"
            />
            <div className="space-y-1">
              <Label htmlFor={`${uid}-detalle`} className="text-xs font-semibold text-muted-foreground">
                Monto del préstamo{" "}
                <span className="font-normal text-muted-foreground/70">(opcional)</span>
              </Label>
              <Input
                id={`${uid}-detalle`}
                value={detalle}
                onChange={(e) => setDetalle(e.target.value)}
                placeholder="Ej: $50.000.000"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor={`${uid}-referencia`} className="text-xs font-semibold text-muted-foreground">
              Referencia{" "}
              <span className="font-normal text-muted-foreground/70">
                (opcional — cómo lo llaman en la planilla, ej. SUECA)
              </span>
            </Label>
            <Input
              id={`${uid}-referencia`}
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              placeholder="Ej: SUECA, FORTE CAR"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor={`${uid}-cuota`} className="text-xs font-semibold text-muted-foreground">
                Importe de la cuota $
              </Label>
              <Input
                id={`${uid}-cuota`}
                type="number"
                min="1"
                step="0.01"
                value={importeCuota}
                onChange={(e) => setImporteCuota(e.target.value)}
                placeholder="Ej: 4500000"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${uid}-tasa`} className="text-xs font-semibold text-muted-foreground">
                Tasa % <span className="font-normal text-muted-foreground/70">(opcional)</span>
              </Label>
              <Input
                id={`${uid}-tasa`}
                type="number"
                min="0"
                step="0.01"
                value={tasa}
                onChange={(e) => setTasa(e.target.value)}
                placeholder="Ej: 45"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold text-muted-foreground">Moneda</Label>
            <div className="inline-flex overflow-hidden rounded-[6px] border border-border">
              {(["ARS", "USD"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMoneda(m)}
                  aria-pressed={moneda === m}
                  className={`h-8 px-3 text-xs font-medium transition-colors ${
                    moneda === m
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m === "ARS" ? "Pesos" : "Dólares"}
                </button>
              ))}
            </div>
            {moneda === "USD" && (
              <p className="text-[11px] text-muted-foreground">
                El importe de la cuota se guarda en dólares (ej. los Scania Credit).
              </p>
            )}
          </div>

          {/* No todo es un préstamo con N cuotas: el plan de ARCA se paga
              todos los meses y no termina nunca. */}
          <div className="space-y-2.5 rounded-lg border border-border px-3 py-2.5">
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={variable}
                onChange={(e) => setVariable(e.target.checked)}
                className="mt-0.5 size-3.5 accent-[#0088D1]"
              />
              <span className="text-[12px] leading-snug">
                <span className="inline-flex items-center gap-1 font-medium text-foreground">
                  <TrendingUp size={12} className="text-primary" /> La cuota cambia mes a mes
                </span>
                <span className="block text-muted-foreground">
                  Tasa variable. El importe de arriba se toma como el último conocido y la tabla
                  muestra cuánto se movió; la deuda total pasa a ser una estimación.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={recurrente}
                onChange={(e) => setRecurrente(e.target.checked)}
                className="mt-0.5 size-3.5 accent-[#0088D1]"
              />
              <span className="text-[12px] leading-snug">
                <span className="inline-flex items-center gap-1 font-medium text-foreground">
                  <Repeat size={12} className="text-primary" /> Se paga todos los meses
                </span>
                <span className="block text-muted-foreground">
                  Sin fecha de fin, como el plan de ARCA. No hace falta cargar cuántas cuotas son.
                </span>
              </span>
            </label>
            {recurrente && (
              <div className="flex items-center gap-2 pl-[22px]">
                <Label className="text-xs text-muted-foreground">Vence el día</Label>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  value={diaMes}
                  onChange={(e) => setDiaMes(e.target.value)}
                  placeholder="16"
                  className="h-8 w-20"
                />
                <span className="text-xs text-muted-foreground">de cada mes</span>
              </div>
            )}
          </div>

          <div className={`grid grid-cols-3 gap-3 ${recurrente ? "hidden" : ""}`}>
            <div className="space-y-1">
              <Label htmlFor={`${uid}-total`} className="text-xs font-semibold text-muted-foreground">
                Cuotas totales
              </Label>
              <Input
                id={`${uid}-total`}
                type="number"
                min="1"
                value={cuotasTotal}
                onChange={(e) => setCuotasTotal(e.target.value)}
                placeholder="Ej: 48"
                required={!recurrente}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${uid}-prox`} className="text-xs font-semibold text-muted-foreground">
                Próxima cuota Nº
              </Label>
              <Input
                id={`${uid}-prox`}
                type="number"
                min="1"
                value={proximaNro}
                onChange={(e) => setProximaNro(e.target.value)}
                required={!recurrente}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${uid}-fecha`} className="text-xs font-semibold text-muted-foreground">
                Vence el
              </Label>
              <Input
                id={`${uid}-fecha`}
                type="date"
                value={proximaFecha}
                onChange={(e) => setProximaFecha(e.target.value)}
                required={!recurrente}
              />
            </div>
          </div>

          <div className={`rounded-lg border border-border bg-muted/40 px-3 py-2.5 ${recurrente ? "hidden" : ""}`}>
            <p className="text-[11px] font-semibold text-foreground">
              ¿El préstamo ya viene pagándose hace meses?
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              No hace falta cargar las cuotas viejas a mano. Poné en{" "}
              <b className="text-foreground">Cuotas totales</b> cuántas tiene en total, y en{" "}
              <b className="text-foreground">Próxima cuota Nº</b> más{" "}
              <b className="text-foreground">Vence el</b> la primera que todavía NO pagaste.
            </p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
              Ejemplo: un préstamo de <b className="text-foreground">48 cuotas</b> del que ya pagaste
              43 y la que sigue vence el 10/08 → cuotas totales <b className="text-foreground">48</b>,
              próxima cuota <b className="text-foreground">44</b>, vence el{" "}
              <b className="text-foreground">10/08</b>. El sistema arma las 48: marca las{" "}
              <b className="text-foreground">1 a 43 como pagadas</b> y agenda las{" "}
              <b className="text-foreground">44 a 48</b>, una por mes.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando…" : "Cargar préstamo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
