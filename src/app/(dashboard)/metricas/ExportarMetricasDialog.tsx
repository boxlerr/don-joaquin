"use client";

// Exportar las planillas del mes: checklist de cuáles, formato Excel o PDF
// imprimible, y si van todas juntas en un archivo (multi-hoja) o un archivo
// por planilla descargados a la vez.

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
  const [modo, setModo] = useState<"juntas" | "separadas">("juntas");
  const [bajando, setBajando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: string) =>
    setSeleccion((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });

  const month = mes.slice(0, 7);
  const ids = PLANILLAS.map((p) => p.id).filter((id) => seleccion.has(id));
  const param = ids.length === PLANILLAS.length ? "todas" : ids.join(",");

  const excel = async () => {
    setBajando(true);
    setError(null);
    try {
      if (modo === "separadas" && ids.length > 1) {
        // Un archivo por planilla, descargados en secuencia.
        for (const id of ids) {
          await descargarExport(`/metricas/export?month=${month}&planilla=${id}`, `metricas_${month}_${id}.xlsx`);
        }
      } else {
        await descargarExport(`/metricas/export?month=${month}&planilla=${param}`, `metricas_${month}.xlsx`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo exportar el Excel.");
    } finally {
      setBajando(false);
    }
  };
  const pdf = () => {
    window.open(`/metricas/imprimir?month=${month}&planilla=${param}`, "_blank");
  };

  const marcarTodas = () => setSeleccion(new Set(PLANILLAS.map((p) => p.id)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Exportar planillas del mes</DialogTitle>
          <DialogDescription>
            Marcá qué planillas exportar y el formato. El PDF sale con una
            planilla por página (se guarda desde el diálogo de impresión).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">
              Planillas ({seleccion.size}/{PLANILLAS.length})
            </p>
            <button
              type="button"
              onClick={seleccion.size === PLANILLAS.length ? () => setSeleccion(new Set()) : marcarTodas}
              className="text-xs font-medium text-primary hover:underline"
            >
              {seleccion.size === PLANILLAS.length ? "Desmarcar todas" : "Marcar todas"}
            </button>
          </div>
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

        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Excel: cómo se descarga</p>
          <div className="flex items-center gap-1 rounded-lg bg-muted p-1 w-fit">
            {([
              { id: "juntas", label: "Todas juntas (un archivo)" },
              { id: "separadas", label: "Un archivo por planilla" },
            ] as const).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setModo(m.id)}
                className={`h-7 rounded-md px-2.5 text-xs font-medium transition-all ${
                  modo === m.id ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
          <Button variant="outline" onClick={pdf} disabled={!seleccion.size} className="gap-1.5">
            <Printer size={14} /> PDF / Imprimir
          </Button>
          <Button variant="success" onClick={excel} disabled={!seleccion.size || bajando} className="gap-1.5">
            {bajando ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
            {modo === "separadas" && seleccion.size > 1 ? `Excel (${seleccion.size} archivos)` : "Excel"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
