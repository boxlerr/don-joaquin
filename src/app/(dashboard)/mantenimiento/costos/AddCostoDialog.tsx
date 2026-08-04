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
import MonthPicker from "@/components/ui/MonthPicker";
import { PlaceCombobox } from "@/components/ui/place-combobox";
import { Building2 } from "lucide-react";
import { addCostoRepRepAction, updateCostoRepRepAction, type CostoRepRep } from "./actions";
import { ars } from "./formato";

/** Campo de importe: acepta negativos (notas de crédito) y coma decimal. */
function ImporteInput({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        className="font-mono"
      />
    </div>
  );
}

function aNumero(s: string): number {
  const limpio = s.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(limpio);
  return Number.isFinite(n) ? n : 0;
}

export default function AddCostoDialog({
  children,
  mesInicial,
  proveedores = [],
  costo,
  open: openProp,
  onOpenChange,
  onSaved,
}: {
  children?: React.ReactNode;
  mesInicial?: string; // YYYY-MM
  /** Proveedores ya cargados, para no inventar variantes del mismo nombre. */
  proveedores?: string[];
  /** Si viene, el diálogo edita ese costo en vez de crear uno nuevo. */
  costo?: CostoRepRep | null;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
  /** Avisa el mes (YYYY-MM) recién guardado, para que la vista salte a ese mes. */
  onSaved?: (mes: string) => void;
}) {
  const router = useRouter();
  const [openInterno, setOpenInterno] = useState(false);
  const open = openProp ?? openInterno;
  const setOpen = onOpenChange ?? setOpenInterno;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hoyMes = new Date().toISOString().slice(0, 7);
  const [mes, setMes] = useState(costo?.mes.slice(0, 7) ?? mesInicial ?? hoyMes);
  const [proveedor, setProveedor] = useState(costo?.proveedor ?? "");
  const [netoGrav, setNetoGrav] = useState(costo ? String(costo.neto_gravado) : "");
  const [factGrav, setFactGrav] = useState(costo ? String(costo.facturado_gravado) : "");
  const [netoNg, setNetoNg] = useState(costo ? String(costo.neto_ng) : "");
  const [factNg, setFactNg] = useState(costo ? String(costo.facturado_ng) : "");
  const [obs, setObs] = useState(costo?.observaciones ?? "");

  // Ojo: el estado inicial se toma una sola vez. Quien lo usa le pasa un `key`
  // (la fila que se edita / el mes elegido) para que React lo remonte con los
  // datos nuevos, en vez de sincronizar los campos a mano desde un efecto.

  const netoTotal = aNumero(netoGrav) + aNumero(netoNg);
  const facturadoTotal = aNumero(factGrav) + aNumero(factNg);
  const iva = facturadoTotal - netoTotal;
  const esCredito = facturadoTotal < 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload = {
        mes,
        proveedor,
        neto_gravado: aNumero(netoGrav),
        facturado_gravado: aNumero(factGrav),
        neto_ng: aNumero(netoNg),
        facturado_ng: aNumero(factNg),
        observaciones: obs.trim() || null,
      };
      const res = costo
        ? await updateCostoRepRepAction(costo.id, payload)
        : await addCostoRepRepAction(payload);
      if (!res.ok) {
        setError(res.error ?? "No se pudo guardar el costo.");
        return;
      }
      setOpen(false);
      if (!costo) {
        // El alta queda montada para la próxima carga: se limpia el proveedor y
        // los importes, y se conserva el mes (se cargan varios seguidos del mismo).
        setProveedor("");
        setNetoGrav("");
        setFactGrav("");
        setNetoNg("");
        setFactNg("");
        setObs("");
      }
      router.refresh();
      onSaved?.(mes);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children && <DialogTrigger render={children as React.ReactElement} />}
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>
            {costo ? "Editar costo" : "Cargar costo de repuestos y reparaciones"}
          </DialogTitle>
          <DialogDescription>
            {costo
              ? "Se guarda sobre el costo ya cargado de ese proveedor y mes."
              : "Resumen mensual por proveedor. Si ese proveedor ya está cargado en el mes, se actualiza."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="text-xs text-red-600 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 rounded-md px-2.5 py-1.5">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">Mes</Label>
              <MonthPicker value={mes} onChange={setMes} />
            </div>
            <PlaceCombobox
              label="Proveedor"
              name="proveedor"
              value={proveedor}
              onValueChange={setProveedor}
              options={proveedores.map((p) => ({ id: p, label: p }))}
              icon={Building2}
              placeholder="Ej: SCANIA ARGENTINA S.A."
            />
          </div>

          <div className="rounded-lg border border-border p-3 space-y-3">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              Gravado (21%)
            </p>
            {/* Neto y facturado son dos números cortos: entran de a dos aun en
                320px, y verlos juntos es justamente lo que se está cargando. */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <ImporteInput id="ng" label="Importe neto" value={netoGrav} onChange={setNetoGrav} />
              <ImporteInput id="fg" label="Importe facturado" value={factGrav} onChange={setFactGrav} />
            </div>
          </div>

          <div className="rounded-lg border border-border p-3 space-y-3">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              No gravado
            </p>
            {/* Neto y facturado son dos números cortos: entran de a dos aun en
                320px, y verlos juntos es justamente lo que se está cargando. */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <ImporteInput id="nng" label="Importe neto" value={netoNg} onChange={setNetoNg} />
              <ImporteInput id="fng" label="Importe facturado" value={factNg} onChange={setFactNg} />
            </div>
          </div>

          <div className="rounded-md border border-border px-3 py-2 space-y-0.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Neto</span>
              <span className="font-mono text-foreground">{ars(netoTotal)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">IVA</span>
              <span className="font-mono text-foreground">{ars(iva)}</span>
            </div>
            <div className="flex items-center justify-between text-sm pt-1 border-t border-border/60 mt-1">
              <span className="font-semibold text-foreground">Facturado</span>
              <span className="font-mono font-bold text-foreground">{ars(facturadoTotal)}</span>
            </div>
            {esCredito && (
              <p className="text-[11px] text-[#F59E0B] pt-1">
                Importe negativo: se carga como nota de crédito y resta del total del mes.
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="obs" className="text-xs font-semibold text-muted-foreground">
              Observaciones <span className="text-muted-foreground/70 font-normal">(opcional)</span>
            </Label>
            <Input id="obs" value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !proveedor.trim()}>
              {loading ? "Guardando…" : costo ? "Guardar cambios" : "Guardar costo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
