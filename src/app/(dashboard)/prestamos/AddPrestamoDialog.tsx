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
import { PiggyBank } from "lucide-react";

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
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!banco.trim()) {
      setError("Elegí o escribí el banco.");
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
      <DialogContent className="gap-0 p-6 sm:max-w-[940px]">
        <DialogHeader className="-mx-6 border-b border-border px-6 pb-4 pt-1">
          <div className="flex items-start gap-4 pr-8">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#E1F5FE] text-primary">
              <PiggyBank size={22} />
            </span>
            <div>
              <DialogTitle className="text-lg text-foreground">Cargar préstamo</DialogTitle>
              <DialogDescription className="mt-0.5 text-xs text-muted-foreground">
                Los mismos datos de la planilla. El cronograma de cuotas (una por mes) se genera
                solo y después se puede corregir cuota por cuota.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-5">
          {error && (
            <p className="border-l-2 border-[#B91C1C] pl-3 text-sm text-[#B91C1C]">{error}</p>
          )}

          <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
            {/* ---------------------------- Ficha ---------------------------- */}
            <section className="space-y-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                Datos del préstamo
              </h3>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <PlaceCombobox
                  label="Banco"
                  name={`${uid}-banco`}
                  value={banco}
                  onValueChange={setBanco}
                  options={opcionesBanco}
                  placeholder="Elegí o escribí uno nuevo"
                />
                <div className="space-y-1">
                  <Label
                    htmlFor={`${uid}-detalle`}
                    className="text-xs font-semibold text-muted-foreground"
                  >
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
                <Label
                  htmlFor={`${uid}-referencia`}
                  className="text-xs font-semibold text-muted-foreground"
                >
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

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_7rem_auto]">
                <div className="space-y-1">
                  <Label
                    htmlFor={`${uid}-cuota`}
                    className="text-xs font-semibold text-muted-foreground"
                  >
                    Importe de la cuota
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
                  <Label
                    htmlFor={`${uid}-tasa`}
                    className="text-xs font-semibold text-muted-foreground"
                  >
                    Tasa % <span className="font-normal text-muted-foreground/70">(opc.)</span>
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
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-muted-foreground">Moneda</Label>
                  <div className="inline-flex h-10 overflow-hidden rounded-[6px] border border-border">
                    {(["ARS", "USD"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMoneda(m)}
                        aria-pressed={moneda === m}
                        className={`px-3 text-xs font-medium transition-colors ${
                          moneda === m
                            ? "bg-primary text-primary-foreground"
                            : "bg-background text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {m === "ARS" ? "Pesos" : "Dólares"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {moneda === "USD" && (
                <p className="text-[11px] text-muted-foreground">
                  El importe de la cuota se guarda en dólares (ej. los Scania Credit).
                </p>
              )}
            </section>

            {/* -------------------------- Cronograma ------------------------- */}
            <section className="space-y-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                Cómo se paga
              </h3>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label
                    htmlFor={`${uid}-total`}
                    className="text-xs font-semibold text-muted-foreground"
                  >
                    Cuotas totales
                  </Label>
                  <Input
                    id={`${uid}-total`}
                    type="number"
                    min="1"
                    value={cuotasTotal}
                    onChange={(e) => setCuotasTotal(e.target.value)}
                    placeholder="Ej: 48"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label
                    htmlFor={`${uid}-prox`}
                    className="text-xs font-semibold text-muted-foreground"
                  >
                    Próxima cuota Nº
                  </Label>
                  <Input
                    id={`${uid}-prox`}
                    type="number"
                    min="1"
                    value={proximaNro}
                    onChange={(e) => setProximaNro(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label
                    htmlFor={`${uid}-fecha`}
                    className="text-xs font-semibold text-muted-foreground"
                  >
                    Vence el
                  </Label>
                  <Input
                    id={`${uid}-fecha`}
                    type="date"
                    value={proximaFecha}
                    onChange={(e) => setProximaFecha(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Lo único que no se deduce mirando el formulario: que las
                  cuotas viejas no hay que cargarlas a mano. */}
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Si ya viene pagándose, poné el total y cuál es la próxima que falta: las
                anteriores se generan pagadas. Ej. 48 cuotas, próxima la 44 → arma las 48 y marca
                las 1 a 43.
              </p>
            </section>
          </div>

          <DialogFooter className="mt-5 gap-2 border-t border-border pt-3">
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
