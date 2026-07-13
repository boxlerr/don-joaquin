"use client";

// Importar el Excel de entrevistas de Bárbara: elegir archivo → preview con
// qué se carga y qué ya existe (no se duplica) → confirmar.

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, AlertTriangle, CheckCircle2, FileSpreadsheet } from "lucide-react";
import {
  previewImportEntrevistasAction,
  confirmImportEntrevistasAction,
  type EntrevistasImportPreview,
} from "../import-actions";

type Step = "select" | "preview" | "done";

function fmtFecha(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export default function ImportEntrevistasDialog({
  open, onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("select");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Extract<EntrevistasImportPreview, { ok: true }> | null>(null);
  const [resultado, setResultado] = useState<{ insertadas: number; salteadas: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const fileObjRef = useRef<File | null>(null);

  const reset = () => {
    setStep("select");
    setLoading(false);
    setError(null);
    setPreview(null);
    setResultado(null);
    fileObjRef.current = null;
  };

  const close = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
    if (!v && step === "done") router.refresh();
  };

  const handlePreview = async () => {
    const f = fileRef.current?.files?.[0];
    if (!f) return;
    fileObjRef.current = f;
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("file", f);
      const res = await previewImportEntrevistasAction(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setPreview(res);
      setStep("preview");
    } catch (err) {
      console.error(err);
      setError("No se pudo analizar el Excel.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!fileObjRef.current) return;
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("file", fileObjRef.current);
      const res = await confirmImportEntrevistasAction(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setResultado({ insertadas: res.insertadas, salteadas: res.salteadas });
      setStep("done");
      router.refresh();
    } catch (err) {
      console.error(err);
      setError("No se pudo importar el Excel.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet size={18} className="text-[#10B981]" /> Importar entrevistas desde Excel
          </DialogTitle>
          <DialogDescription>
            La planilla de Bárbara: una fila por candidato con NOMBRE, FECHA, EDAD, DE DÓNDE ES,
            OBSERVACIONES y el seguimiento. Los nombres que ya están cargados no se duplican.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-600">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {error}
          </div>
        )}

        {step === "select" && (
          <div className="space-y-3">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="block w-full cursor-pointer rounded-lg border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => close(false)}>Cancelar</Button>
              <Button onClick={handlePreview} disabled={loading} className="gap-1.5">
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                Analizar
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "preview" && preview && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 font-medium text-emerald-700">
                {preview.nuevas.length} para cargar
              </span>
              <span className="rounded-full bg-muted px-2.5 py-0.5 font-medium text-muted-foreground">
                {preview.existentes.length} ya existen (se saltean)
              </span>
              <span className="text-xs text-muted-foreground">hoja: {preview.hoja}</span>
            </div>
            {preview.avisos.map((a) => (
              <p key={a} className="flex items-start gap-1.5 text-xs text-amber-600">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {a}
              </p>
            ))}

            <div className="max-h-72 overflow-y-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/90">
                  <tr className="text-xs text-muted-foreground">
                    <th className="px-2.5 py-1.5 text-left font-medium">Nombre</th>
                    <th className="px-2.5 py-1.5 text-left font-medium">Fecha</th>
                    <th className="px-2.5 py-1.5 text-right font-medium">Edad</th>
                    <th className="px-2.5 py-1.5 text-left font-medium">Localidad</th>
                    <th className="px-2.5 py-1.5 text-left font-medium">Observaciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {preview.nuevas.map((f) => (
                    <tr key={f.rowNum}>
                      <td className="px-2.5 py-1.5 font-medium text-foreground">{f.nombre}</td>
                      <td className="px-2.5 py-1.5 whitespace-nowrap">{fmtFecha(f.fecha)}</td>
                      <td className="px-2.5 py-1.5 text-right font-mono">{f.edad ?? "—"}</td>
                      <td className="px-2.5 py-1.5">{f.localidad ?? "—"}</td>
                      <td className="max-w-56 truncate px-2.5 py-1.5 text-muted-foreground" title={f.observaciones ?? ""}>
                        {f.observaciones ?? "—"}
                      </td>
                    </tr>
                  ))}
                  {preview.existentes.map(({ fila, nombreExistente }) => (
                    <tr key={`ex-${fila.rowNum}`} className="bg-muted/30 text-muted-foreground">
                      <td className="px-2.5 py-1.5">{fila.nombre}</td>
                      <td className="px-2.5 py-1.5 whitespace-nowrap" colSpan={4}>
                        ya cargado como “{nombreExistente}” — se saltea
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={reset} disabled={loading}>Elegir otro archivo</Button>
              <Button onClick={handleConfirm} disabled={loading || preview.nuevas.length === 0} className="gap-1.5">
                {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Cargar {preview.nuevas.length} candidato{preview.nuevas.length === 1 ? "" : "s"}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "done" && resultado && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
              <CheckCircle2 size={16} className="shrink-0" />
              Se cargaron {resultado.insertadas} candidato{resultado.insertadas === 1 ? "" : "s"}
              {resultado.salteadas > 0 ? ` (${resultado.salteadas} ya existían y se saltearon)` : ""}.
            </div>
            <DialogFooter>
              <Button onClick={() => close(false)}>Listo</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
