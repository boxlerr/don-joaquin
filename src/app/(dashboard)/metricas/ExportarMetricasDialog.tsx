"use client";

// Exportar las planillas del mes: elegir cuáles y en qué formato —
// Excel (multi-hoja) o PDF (vista imprimible, se guarda desde el navegador).

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { FileSpreadsheet, Printer, Loader2 } from "lucide-react";
import { descargarExport } from "@/lib/download-export";

const PLANILLAS = [
  { id: "sueldo", label: "Sueldo sobre facturación (con desglose)" },
  { id: "factkm", label: "Facturación por km" },
  { id: "costo", label: "Facturación vs costo por km" },
  { id: "vacios", label: "KM vacíos" },
  { id: "km100", label: "KM al 100%" },
  { id: "toneladas", label: "Toneladas" },
];

export default function ExportarMetricasDialog({
  open, onOpenChange, mes,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mes: string; // ISO día 1
}) {
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set(PLANILLAS.map((p) => p.id)));
  const [bajando, setBajando] = useState(false);

  const toggle = (id: string) =>
    setSeleccion((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });

  const month = mes.slice(0, 7);
  const param = seleccion.size === PLANILLAS.length ? "todas" : Array.from(seleccion).join(",");

  const excel = async () => {
    setBajando(true);
    try {
      await descargarExport(`/metricas/export?month=${month}&planilla=${param}`, `metricas_${month}.xlsx`);
    } finally {
      setBajando(false);
    }
  };
  const pdf = () => {
    window.open(`/metricas/imprimir?month=${month}&planilla=${param}`, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Exportar planillas del mes</DialogTitle>
          <DialogDescription>
            Elegí qué planillas y el formato. El PDF abre la vista imprimible
            (se guarda desde el diálogo de impresión).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          {PLANILLAS.map((p) => (
            <label key={p.id} className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-muted/40 cursor-pointer">
              <input
                type="checkbox"
                checked={seleccion.has(p.id)}
                onChange={() => toggle(p.id)}
                className="h-4 w-4 accent-[#0088D1]"
              />
              {p.label}
            </label>
          ))}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
          <Button variant="outline" onClick={pdf} disabled={!seleccion.size} className="gap-1.5">
            <Printer size={14} /> PDF / Imprimir
          </Button>
          <Button onClick={excel} disabled={!seleccion.size || bajando} className="gap-1.5">
            {bajando ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />} Excel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
