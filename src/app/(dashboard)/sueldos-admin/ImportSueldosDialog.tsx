"use client";

// Diálogo "Importar Excel" de sueldos admin/taller (formato de bloques por mes).
// Pasos: elegir archivo → preview con matching de nombres editable → resultado.

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Upload, Loader2, AlertTriangle, CheckCircle2, FileSpreadsheet } from "lucide-react";
import {
  previewImportSueldosAction,
  confirmImportSueldosAction,
  type SueldosImportPreview,
  type SueldosImportResult,
} from "./import-actions";

type Step = "select" | "preview" | "done";

const money = (n: number | null | undefined) =>
  n == null ? "—" : "$" + Math.round(n).toLocaleString("es-AR");

const mesLabel = (iso: string) => {
  const [y, m] = iso.split("-");
  const nombres = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${nombres[parseInt(m, 10) - 1]} ${y}`;
};

const ROL_LABEL: Record<string, string> = {
  administrativo: "Administración",
  mantenimiento: "Taller",
  chofer: "Chofer",
};

export default function ImportSueldosDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [step, setStep] = useState<Step>("select");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Extract<SueldosImportPreview, { ok: true }> | null>(null);
  // Asignación final por nombre del Excel: chofer_id o "" = no cargar.
  const [asignaciones, setAsignaciones] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Extract<SueldosImportResult, { ok: true }> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const fileObjRef = useRef<File | null>(null);

  const reset = () => {
    setStep("select");
    setLoading(false);
    setError(null);
    setPreview(null);
    setAsignaciones({});
    setResult(null);
    fileObjRef.current = null;
  };

  const close = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const handlePreview = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = fileRef.current?.files?.[0];
    if (!f) return;
    fileObjRef.current = f;
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("file", f);
      const res = await previewImportSueldosAction(fd);
      if (!res.ok) {
        setError(res.error ?? "Error al analizar el Excel.");
        return;
      }
      setPreview(res);
      setAsignaciones(
        Object.fromEntries(res.matches.map((m) => [m.nombreExcel, m.choferId ?? ""])),
      );
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
      fd.set("asignaciones", JSON.stringify(asignaciones));
      const res = await confirmImportSueldosAction(fd);
      if (!res.ok) {
        setError(res.error ?? "Error al importar.");
        return;
      }
      setResult(res);
      setStep("done");
      onDone();
    } catch (err) {
      console.error(err);
      setError("No se pudo completar la importación.");
    } finally {
      setLoading(false);
    }
  };

  const sinAsignar = preview
    ? preview.matches.filter((m) => !asignaciones[m.nombreExcel]).length
    : 0;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet size={18} className="text-primary" />
            Importar Excel de sueldos
          </DialogTitle>
          <DialogDescription>
            Planilla de sueldos de administración y taller (bloques por mes con sueldo,
            comisión, combustible, plus YPF, sábados y facturación). Re-importar el mismo
            mes pisa los valores con los del archivo.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {step === "select" && (
          <form onSubmit={handlePreview} className="space-y-4">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              required
              className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary hover:file:bg-primary/20"
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => close(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Upload size={14} className="mr-1.5" />}
                Analizar
              </Button>
            </DialogFooter>
          </form>
        )}

        {step === "preview" && preview && (
          <div className="space-y-4">
            {preview.warnings.length > 0 && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400 space-y-1">
                {preview.warnings.map((w, i) => (
                  <p key={i}>⚠️ {w}</p>
                ))}
              </div>
            )}

            <div>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                Meses detectados ({preview.bloques.length})
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {preview.bloques.map((b) => (
                  <span
                    key={b.mes}
                    className="rounded-md bg-muted px-2 py-1 text-xs text-foreground"
                    title={`Facturación: ${money(b.facturacion)} · ${b.filas} empleados`}
                  >
                    {mesLabel(b.mes)}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                Empleados del Excel → legajo
              </h4>
              <div className="rounded-md border border-border divide-y divide-border">
                {preview.matches.map((m) => {
                  const val = asignaciones[m.nombreExcel] ?? "";
                  return (
                    <div key={m.nombreExcel} className="flex items-center gap-3 px-3 py-2">
                      <span className="w-28 shrink-0 font-mono text-xs font-medium text-foreground">
                        {m.nombreExcel}
                      </span>
                      <select
                        value={val}
                        onChange={(e) =>
                          setAsignaciones((prev) => ({ ...prev, [m.nombreExcel]: e.target.value }))
                        }
                        className="h-8 flex-1 rounded-md border border-border bg-card px-2 text-xs text-foreground focus:border-primary focus:outline-none"
                      >
                        <option value="">No cargar</option>
                        {preview.roster.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.nombre} · {ROL_LABEL[r.rol] ?? r.rol}
                          </option>
                        ))}
                      </select>
                      {m.auto ? (
                        <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                          auto
                        </span>
                      ) : m.sugeridoId ? (
                        <button
                          type="button"
                          onClick={() =>
                            setAsignaciones((prev) => ({ ...prev, [m.nombreExcel]: m.sugeridoId! }))
                          }
                          className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-500/20"
                          title="Hay un chofer con ese nombre. Clic para usarlo."
                        >
                          ¿chofer?
                        </button>
                      ) : (
                        <span className="shrink-0 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-600 dark:text-red-400">
                          sin match
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              {sinAsignar > 0 && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {sinAsignar} nombre{sinAsignar !== 1 ? "s" : ""} sin asignar: sus filas no se
                  cargan (se pueden re-importar después).
                </p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={reset}>
                Volver
              </Button>
              <Button onClick={handleConfirm} disabled={loading}>
                {loading ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <CheckCircle2 size={14} className="mr-1.5" />}
                Importar
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "done" && result && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Importación completada</p>
                <p className="mt-0.5 text-xs">
                  {result.meses} mes{result.meses !== 1 ? "es" : ""} · {result.aumentos} sueldos
                  base · {result.variables} filas de variables.
                  {result.omitidos.length > 0 && (
                    <> Sin cargar: {result.omitidos.join(", ")}.</>
                  )}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => close(false)}>Cerrar</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
