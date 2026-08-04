"use client";

import { useRef, useState } from "react";
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
import { Upload, Loader2, AlertTriangle, CheckCircle2, FileSpreadsheet } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  previewYpfImportAction,
  confirmYpfImportAction,
  type YpfPreviewData,
  type YpfConfirmData,
} from "../import-ypf/actions";

type Step = "select" | "preview" | "done";
type PreviewOk = Exclude<YpfPreviewData, { error: string }>;
type ConfirmOk = Exclude<YpfConfirmData, { error: string }>;

const num = (n: number) => n.toLocaleString("es-AR");

export default function ImportYpfModal({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("select");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewOk | null>(null);
  const [result, setResult] = useState<ConfirmOk | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const fileObjRef = useRef<File | null>(null);

  const reset = () => {
    setStep("select");
    setLoading(false);
    setError(null);
    setPreview(null);
    setResult(null);
    fileObjRef.current = null;
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) setTimeout(reset, 200);
  };

  const handlePreview = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Elegí el archivo .xlsx del reporte de YPF.");
      return;
    }
    fileObjRef.current = file;
    setLoading(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await previewYpfImportAction(fd);
    setLoading(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setPreview(res);
    setStep("preview");
  };

  const handleConfirm = async () => {
    const file = fileObjRef.current;
    if (!file) {
      setError("Volvé a elegir el archivo.");
      setStep("select");
      return;
    }
    setLoading(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await confirmYpfImportAction(fd);
    setLoading(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setResult(res);
    setStep("done");
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={children as React.ReactElement} />
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="text-foreground text-xl">Importar YPF en ruta</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Subí el reporte de consumos de YPF (.xlsx). Se cargan las cargas que coinciden con un
            camión de la flota; el resto se informa y no se importa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {step === "select" && (
            <div className="space-y-3">
              <label
                htmlFor="ypf-file"
                className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/20 px-4 py-8 text-center cursor-pointer hover:bg-muted/40 transition-colors"
              >
                <FileSpreadsheet size={28} className="text-[#10B981]" />
                <span className="text-sm font-medium text-foreground">
                  Elegí el archivo del reporte de YPF
                </span>
                <span className="text-xs text-muted-foreground">ReporteConsumos.xlsx</span>
                <input
                  ref={fileRef}
                  id="ypf-file"
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={() => setError(null)}
                />
              </label>
            </div>
          )}

          {step === "preview" && preview && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <div className="text-xl sm:text-2xl font-extrabold text-emerald-700">{num(preview.aImportar)}</div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700/80">
                    cargas a importar
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                  <div className="text-xl sm:text-2xl font-extrabold text-foreground">{num(preview.total)}</div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    filas en el reporte
                  </div>
                </div>
              </div>

              {preview.rango.desde && (
                <p className="text-xs text-muted-foreground">
                  Período del reporte: <strong>{preview.rango.desde}</strong> a{" "}
                  <strong>{preview.rango.hasta}</strong>
                </p>
              )}

              <div className="space-y-1 text-sm">
                {preview.porEstado.duplicado > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Duplicadas (remito ya importado)</span>
                    <span className="font-semibold">{num(preview.porEstado.duplicado)}</span>
                  </div>
                )}
                {preview.porEstado.sin_camion > 0 && (
                  <div className="flex justify-between text-amber-700">
                    <span>Sin camión en la flota</span>
                    <span className="font-semibold">{num(preview.porEstado.sin_camion)}</span>
                  </div>
                )}
                {preview.porEstado.invalido > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Inválidas (sin fecha / litros)</span>
                    <span className="font-semibold">{num(preview.porEstado.invalido)}</span>
                  </div>
                )}
              </div>

              {preview.patentesSinCamion.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <p className="font-semibold mb-1">
                    Patentes que no están en la flota (se omiten):
                  </p>
                  <p className="font-mono leading-relaxed">
                    {preview.patentesSinCamion.join(", ")}
                  </p>
                </div>
              )}

              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  Productos en el reporte
                </summary>
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.entries(preview.productos)
                    .sort((a, b) => b[1] - a[1])
                    .map(([p, n]) => (
                      <span key={p} className="bg-muted px-2 py-0.5 rounded text-[11px]">
                        {p}: <strong>{n}</strong>
                      </span>
                    ))}
                </div>
              </details>
            </div>
          )}

          {step === "done" && result && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle2 size={40} className="text-emerald-500" />
              <p className="text-lg font-bold text-foreground">
                {num(result.insertadas)} cargas importadas
              </p>
              <p className="text-xs text-muted-foreground">
                {result.duplicadas > 0 && `${num(result.duplicadas)} duplicadas omitidas · `}
                {result.sinCamion > 0 && `${num(result.sinCamion)} sin camión · `}
                {result.invalidas > 0 && `${num(result.invalidas)} inválidas`}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-end">
          {step === "select" && (
            <Button variant="brand" onClick={handlePreview} disabled={loading}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {loading ? "Analizando..." : "Analizar"}
            </Button>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => setStep("select")} disabled={loading}>
                Volver
              </Button>
              <Button
                variant="brand"
                onClick={handleConfirm}
                disabled={loading || preview?.aImportar === 0}
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                {loading ? "Importando..." : `Importar ${preview ? num(preview.aImportar) : ""} cargas`}
              </Button>
            </>
          )}
          {step === "done" && (
            <Button variant="brand" onClick={() => handleOpenChange(false)}>
              Listo
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
