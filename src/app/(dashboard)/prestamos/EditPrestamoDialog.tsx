"use client";

// Edición de la ficha del préstamo. Existe sobre todo para completar los que
// entraron desde la planilla con datos a medias: al cargarles lo que faltaba, el
// aviso de "falta completar" se apaga solo.

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { PlaceCombobox } from "@/components/ui/place-combobox";
import { updatePrestamoAction, type PrestamoRow } from "./actions";
import { listaBancos } from "./bancos";
import { etiquetaFaltante, faltantesVigentes, siguePendiente, type Faltante } from "./faltantes";
import { Check, Repeat, TrendingUp } from "lucide-react";

export default function EditPrestamoDialog({
  prestamo,
  open,
  onOpenChange,
  bancos = [],
}: {
  prestamo: PrestamoRow | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Bancos ya en uso, para el desplegable. */
  bancos?: string[];
}) {
  const router = useRouter();
  const [banco, setBanco] = useState(prestamo?.banco ?? "");
  const [detalle, setDetalle] = useState(prestamo?.detalle ?? "");
  const [referencia, setReferencia] = useState(prestamo?.referencia ?? "");
  const [tasa, setTasa] = useState(prestamo?.tasa != null ? String(prestamo.tasa) : "");
  const [importe, setImporte] = useState(
    prestamo && prestamo.importe_cuota > 0 ? String(prestamo.importe_cuota) : "",
  );
  const [moneda, setMoneda] = useState<"ARS" | "USD">(prestamo?.moneda === "USD" ? "USD" : "ARS");
  const [falta, setFalta] = useState(prestamo?.datos_faltantes ?? "");
  const [variable, setVariable] = useState(prestamo?.cuota_variable ?? false);
  const [recurrente, setRecurrente] = useState(prestamo?.es_recurrente ?? false);
  const [diaMes, setDiaMes] = useState(
    prestamo?.dia_vencimiento != null ? String(prestamo.dia_vencimiento) : "",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!prestamo) return null;

  const guardar = async () => {
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
    const res = await updatePrestamoAction(prestamo.id, {
      banco,
      detalle: detalle.trim() || null,
      referencia: referencia.trim() || null,
      tasa: tasa.trim() === "" ? null : Number(tasa),
      importe_cuota: importe.trim() === "" ? 0 : Number(importe),
      moneda,
      datos_faltantes: falta.trim() || null,
      cuota_variable: variable,
      es_recurrente: recurrente,
      dia_vencimiento: recurrente && diaMes.trim() !== "" ? Number(diaMes) : null,
    });
    setLoading(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    onOpenChange(false);
    router.refresh();
  };

  // Lo que hoy tiene el formulario, para evaluar en vivo qué falta todavía.
  const enElFormulario = {
    detalle: detalle.trim() || null,
    importe_cuota: importe.trim() === "" ? 0 : Number(importe),
    tasa: tasa.trim() === "" ? null : Number(tasa),
    faltantes: [] as string[],
    datos_faltantes: null,
  };
  const marcasIniciales: Faltante[] = faltantesVigentes({
    detalle: prestamo.detalle,
    importe_cuota: prestamo.importe_cuota,
    tasa: prestamo.tasa,
    faltantes: prestamo.faltantes ?? [],
    datos_faltantes: null,
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !loading && onOpenChange(v)}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="text-lg text-foreground">
            {prestamo.banco}
            {prestamo.referencia ? ` · ${prestamo.referencia}` : prestamo.detalle ? ` · ${prestamo.detalle}` : ""}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Cuota {prestamo.pagadas + 1} de {prestamo.cuotas_total}. Cambiar el importe lo aplica a
            las cuotas que faltan pagar; las ya pagadas quedan como están.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {error && (
            <p className="border-l-2 border-[#B91C1C] pl-3 text-sm text-[#B91C1C]">{error}</p>
          )}

          {/* Lo que quedaba pendiente, tachándose en vivo: cuando el usuario
              escribe el importe, ese renglón se marca y al guardar el aviso
              desaparece solo — no hay que borrar ninguna nota a mano. */}
          {marcasIniciales.length > 0 && (
            <ul className="space-y-1 rounded-[6px] border border-border px-3 py-2">
              {marcasIniciales.map((f) => {
                const listo = !siguePendiente(f, enElFormulario);
                return (
                  <li
                    key={f}
                    className={`flex items-center gap-1.5 text-[12px] ${listo ? "text-[#059669]" : "text-[#B45309]"}`}
                  >
                    {listo ? (
                      <Check size={12} className="shrink-0" />
                    ) : (
                      <span className="inline-block size-1.5 shrink-0 rounded-full bg-current" />
                    )}
                    <span className={listo ? "line-through decoration-1" : ""}>
                      Falta {etiquetaFaltante(f)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="grid grid-cols-2 gap-3">
            <PlaceCombobox
              label="Banco"
              name="banco"
              value={banco}
              onValueChange={setBanco}
              options={listaBancos(bancos).map((b) => ({ id: b, label: b }))}
              placeholder="Elegí o escribí uno nuevo"
            />
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">
                Monto del préstamo{" "}
                <span className="font-normal text-muted-foreground/70">(dejalo vacío si no lo tenés)</span>
              </Label>
              <Input
                value={detalle}
                onChange={(e) => setDetalle(e.target.value)}
                placeholder="Ej: $50.000.000"
              />
            </div>
          </div>

          {/* La planilla a veces identifica al préstamo con un nombre en vez de
              un monto (SUECA, FORTE CAR). Va acá y no en el monto. */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-muted-foreground">
              Referencia{" "}
              <span className="font-normal text-muted-foreground/70">
                (opcional — cómo lo llaman en la planilla)
              </span>
            </Label>
            <Input
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              placeholder="Ej: SUECA, FORTE CAR, TARJ.PYME"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">
                Importe de la cuota
              </Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={importe}
                onChange={(e) => setImporte(e.target.value)}
                placeholder="Ej: 4500000"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">
                Tasa % <span className="font-normal text-muted-foreground/70">(opcional)</span>
              </Label>
              <Input
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
          </div>

          {/* Pagos que no son un préstamo con N cuotas sino una obligación
              mensual sin fin, como el plan de ARCA. */}
          <div className="space-y-2.5 rounded-[6px] border border-border px-3 py-2.5">
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
                  Sin fecha de fin, como el plan de ARCA. El sistema agenda el vencimiento mes a
                  mes y no le calcula una deuda total.
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

          <div className="space-y-1">
            <Label className="text-xs font-semibold text-muted-foreground">
              Qué falta cargar{" "}
              <span className="font-normal text-muted-foreground/70">
                (sólo lo que el sistema no puede ver: fechas, si es un pago único…)
              </span>
            </Label>
            <textarea
              value={falta}
              onChange={(e) => setFalta(e.target.value)}
              rows={2}
              placeholder="Ej: el importe de la cuota"
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 border-t border-border pt-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="border-border text-muted-foreground"
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
