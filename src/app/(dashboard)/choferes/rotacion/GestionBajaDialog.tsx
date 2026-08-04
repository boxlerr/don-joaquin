"use client";

import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { AlertCircle } from "lucide-react";
import { crearBajaAction, editarBajaAction, type BajaInput } from "./actions";
import { TIPO_BAJA_OPTIONS, antiguedadTexto, type BajaRotacion, type TipoBaja } from "./compute";

function mesesEntre(ing: string, egr: string): number | null {
  if (!ing || !egr) return null;
  const a = new Date(ing + "T00:00:00");
  const b = new Date(egr + "T00:00:00");
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  let m = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) m -= 1;
  return Math.max(0, m);
}

export default function GestionBajaDialog({
  open, onOpenChange, baja, anioDefault, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  baja: BajaRotacion | null;
  anioDefault: number;
  onSaved: () => void;
}) {
  const esEdicion = !!baja;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [anio, setAnio] = useState(String(anioDefault));
  const [tipo, setTipo] = useState<TipoBaja>("renuncia_voluntaria");
  const [fechaIngreso, setFechaIngreso] = useState("");
  const [fechaEgreso, setFechaEgreso] = useState("");
  const [antiguedadManual, setAntiguedadManual] = useState("");
  const [baseZona, setBaseZona] = useState("");
  const [motivo, setMotivo] = useState("");
  const [observaciones, setObservaciones] = useState("");

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- init al abrir
    setError(null);
    setNombre(baja?.nombre ?? "");
    setAnio(String(baja?.anio ?? anioDefault));
    setTipo(baja?.tipo_baja ?? "renuncia_voluntaria");
    setFechaIngreso(baja?.fecha_ingreso ?? "");
    setFechaEgreso(baja?.fecha_egreso ?? "");
    setAntiguedadManual(baja?.antiguedad_meses != null ? String(baja.antiguedad_meses) : "");
    setBaseZona(baja?.base_zona ?? "");
    setMotivo(baja?.motivo ?? "");
    setObservaciones(baja?.observaciones ?? "");
  }, [open, baja, anioDefault]);

  const mesesCalc = mesesEntre(fechaIngreso, fechaEgreso);
  const antiguedadPreview =
    mesesCalc != null ? antiguedadTexto(mesesCalc)
    : antiguedadManual ? antiguedadTexto(Number(antiguedadManual))
    : "—";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return setError("El nombre es obligatorio.");
    const anioNum = Number(anio);
    if (!Number.isFinite(anioNum)) return setError("Año inválido.");
    setLoading(true);
    setError(null);
    const input: BajaInput = {
      nombre,
      anio: anioNum,
      tipo_baja: tipo,
      fecha_ingreso: fechaIngreso || null,
      fecha_egreso: fechaEgreso || null,
      antiguedad_meses: antiguedadManual ? Number(antiguedadManual) : null,
      base_zona: baseZona || null,
      motivo: motivo || null,
      observaciones: observaciones || null,
    };
    const res = esEdicion ? await editarBajaAction(baja!.id, input) : await crearBajaAction(input);
    setLoading(false);
    if (res.error) setError(res.error);
    else { onSaved(); onOpenChange(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!loading) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="text-foreground text-xl">
            {esEdicion ? "Editar baja" : "Cargar baja"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Registro de un egreso para el índice de rotación. Si cargás ingreso y egreso, la antigüedad se calcula sola.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-1">
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
              <AlertCircle size={16} className="mt-0.5 shrink-0" /><span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-[1fr_auto] gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Nombre y apellido *</Label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Pérez Juan" disabled={loading} required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Año *</Label>
              <Input type="number" value={anio} onChange={(e) => setAnio(e.target.value)} className="w-24" disabled={loading} required />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Tipo de baja</Label>
            <Combobox
              value={tipo}
              onValueChange={(v) => setTipo((v as TipoBaja) || "renuncia_voluntaria")}
              options={TIPO_BAJA_OPTIONS.map((o) => ({ id: o.value, label: o.label }))}
              searchable={false}
              triggerClassName="h-10"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Fecha de ingreso</Label>
              <Input type="date" value={fechaIngreso} onChange={(e) => setFechaIngreso(e.target.value)} disabled={loading} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Fecha de egreso</Label>
              <Input type="date" value={fechaEgreso} onChange={(e) => setFechaEgreso(e.target.value)} disabled={loading} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                Antigüedad (meses){mesesCalc != null && <span className="text-muted-foreground font-normal"> · auto</span>}
              </Label>
              <Input
                type="number" value={mesesCalc != null ? String(mesesCalc) : antiguedadManual}
                onChange={(e) => setAntiguedadManual(e.target.value)}
                disabled={loading || mesesCalc != null} placeholder="Si no cargás fechas"
              />
              <p className="text-[11px] text-muted-foreground">{antiguedadPreview}</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Base / zona</Label>
              <Input value={baseZona} onChange={(e) => setBaseZona(e.target.value)} placeholder="Ej: Olavarría" disabled={loading} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Motivo</Label>
            <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Opcional" disabled={loading} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Observaciones</Label>
            <textarea
              className="flex w-full min-h-[56px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none disabled:opacity-50"
              value={observaciones} onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Ej: se fue a la competencia" disabled={loading}
            />
          </div>

          <DialogFooter className="pt-3 border-t border-border gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
            <Button type="submit" variant="brand" disabled={loading}>
              {loading ? "Guardando…" : esEdicion ? "Guardar cambios" : "Cargar baja"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
