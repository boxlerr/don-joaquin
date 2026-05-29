"use client";

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
import { Upload, Loader2, Check, X, AlertTriangle } from "lucide-react";
import {
  previewChoferesImportAction,
  confirmChoferesImportAction,
  type ParsedChoferImportRow,
  type ParsedDocumentImportRow,
} from "../actions";

type Step = "select" | "preview" | "done";

export function ImportChoferesButton() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("select");
  const [loading, setLoading] = useState(false);
  const [detectedType, setDetectedType] = useState<"choferes" | "licencias" | "manuales">("choferes");
  const [choferesRows, setChoferesRows] = useState<ParsedChoferImportRow[]>([]);
  const [documentRows, setDocumentRows] = useState<ParsedDocumentImportRow[]>([]);
  const [summary, setSummary] = useState<{ validas: number; invalidas: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    imported: number;
    updated: number;
    skipped: number;
    errors: { row: number; message: string }[];
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePreview = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await previewChoferesImportAction(fd);
      if (res.error) {
        setError(res.error);
      } else if (res.summary) {
        setDetectedType(res.detectedType);
        setChoferesRows(res.choferesRows || []);
        setDocumentRows(res.documentRows || []);
        setSummary(res.summary);
        setStep("preview");
      }
    } catch (err: any) {
      setError(err?.message || "Ocurrió un error al procesar el archivo.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const res = await confirmChoferesImportAction(detectedType, choferesRows, documentRows);
      setResult(res);
      setStep("done");
    } catch (err: any) {
      setError(err?.message || "Ocurrió un error al guardar los datos.");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep("select");
    setChoferesRows([]);
    setDocumentRows([]);
    setSummary(null);
    setError(null);
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const formatFecha = (fechaStr: string | null) => {
    if (!fechaStr) return "—";
    const [y, m, d] = fechaStr.split("-");
    return `${d}/${m}/${y}`;
  };

  const getFriendlyTypeLabel = () => {
    if (detectedType === "licencias") return "Planilla de Vencimiento de Licencias";
    if (detectedType === "manuales") return "Planilla de Vencimiento de Manuales";
    return "Planilla de Choferes / Personal";
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Upload size={14} />
        Importar
      </Button>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) reset();
        }}
      >
        <DialogContent className={step === "preview" ? "sm:max-w-[1040px]" : "sm:max-w-[480px]"}>
          <DialogHeader>
            <DialogTitle className="text-foreground text-xl">
              {step === "preview" ? "Vista previa" : step === "done" ? "Importación completada" : "Importar Choferes / Vencimientos"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {step === "select" && (
                <>
                  Subí una planilla .xlsx o .csv. El sistema detectará automáticamente si es de:
                  <ul className="list-disc list-inside mt-1 space-y-0.5 text-xs text-muted-foreground/90">
                    <li><strong>Choferes:</strong> Para dar de alta o actualizar perfiles de choferes.</li>
                    <li><strong>Licencias:</strong> Fechas de vencimiento de las licencias de conducir.</li>
                    <li><strong>Manuales:</strong> Fechas de vencimiento de manuales de inducción.</li>
                  </ul>
                </>
              )}
              {step === "preview" && summary && (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-primary text-sm font-semibold">
                    <Check size={16} />
                    <span>Detectado: {getFriendlyTypeLabel()}</span>
                  </div>
                  <div>
                    <span className="text-[#047857] font-semibold">{summary.validas} válidas</span>
                    {summary.invalidas > 0 && (
                      <> · <span className="text-red-600 font-semibold">{summary.invalidas} con error</span></>
                    )}
                    {" "}· Se procesarán {summary.validas} registros.
                  </div>
                </div>
              )}
              {step === "done" && result && (
                <>
                  {result.imported} insertados, {result.updated} actualizados, {result.skipped} omitidos.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {step === "select" && (
            <form onSubmit={handlePreview} className="space-y-4 py-2">
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.csv,.xls"
                className="w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-[#E1F5FE] file:text-primary file:font-semibold hover:file:bg-[#B3E5FC]"
                required
              />
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
                  {error}
                </div>
              )}
              <DialogFooter className="pt-3 border-t border-[#F1F5F9] gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" variant="brand" disabled={loading}>
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {loading ? "Analizando..." : "Analizar archivo"}
                </Button>
              </DialogFooter>
            </form>
          )}

          {step === "preview" && (
            <div className="space-y-3 py-2">
              <div className="max-h-[440px] overflow-y-auto border border-border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 sticky top-0">
                    <tr className="text-left text-muted-foreground text-xs uppercase tracking-wide">
                      <th className="px-3 py-2 w-10"></th>
                      <th className="px-3 py-2 w-12">Fila</th>
                      {detectedType === "choferes" ? (
                        <>
                          <th className="px-3 py-2">DNI</th>
                          <th className="px-3 py-2">Apellido / Nombre</th>
                          <th className="px-3 py-2">CUIL</th>
                          <th className="px-3 py-2">Teléfono</th>
                          <th className="px-3 py-2">Localidad</th>
                          <th className="px-3 py-2">Ingreso</th>
                          <th className="px-3 py-2">Estado</th>
                        </>
                      ) : (
                        <>
                          <th className="px-3 py-2">Chofer (Excel)</th>
                          <th className="px-3 py-2">Chofer DB (Emparejado)</th>
                          <th className="px-3 py-2">CUIL / DNI (Excel)</th>
                          <th className="px-3 py-2">Vencimiento (Excel)</th>
                          <th className="px-3 py-2">Vencimiento (Normalizado)</th>
                        </>
                      )}
                      <th className="px-3 py-2">Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detectedType === "choferes"
                      ? choferesRows.slice(0, 100).map((r) => (
                          <tr
                            key={r.rowNum}
                            className={`border-t border-[#F1F5F9] ${
                              r.isValid ? "" : "bg-[#FEF2F2]"
                            }`}
                          >
                            <td className="px-3 py-2">
                              {r.isValid ? (
                                <Check size={14} className="text-[#10B981]" />
                              ) : (
                                <X size={14} className="text-red-500" />
                              )}
                            </td>
                            <td className="px-3 py-2 font-mono text-muted-foreground">{r.rowNum}</td>
                            <td className="px-3 py-2 font-semibold text-foreground">{r.dni || "—"}</td>
                            <td className="px-3 py-2 text-foreground font-medium">
                              {r.apellido}, {r.nombre}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">{r.cuil || "—"}</td>
                            <td className="px-3 py-2 text-muted-foreground">{r.telefono || "—"}</td>
                            <td className="px-3 py-2 text-muted-foreground">{r.localidad || "—"}</td>
                            <td className="px-3 py-2 text-muted-foreground">{formatFecha(r.fecha_ingreso)}</td>
                            <td className="px-3 py-2 text-xs font-semibold capitalize text-muted-foreground">{r.estado}</td>
                            <td className="px-3 py-2 text-xs">
                              {r.errorMsg ? (
                                <span className="text-red-600 font-medium">{r.errorMsg}</span>
                              ) : r.warningMsg ? (
                                <span className="text-amber-600 font-medium">{r.warningMsg}</span>
                              ) : (
                                <span className="text-green-600 font-medium">OK</span>
                              )}
                            </td>
                          </tr>
                        ))
                      : documentRows.slice(0, 100).map((r) => (
                          <tr
                            key={r.rowNum}
                            className={`border-t border-[#F1F5F9] ${
                              r.isValid ? "" : "bg-[#FEF2F2]"
                            }`}
                          >
                            <td className="px-3 py-2">
                              {r.isValid ? (
                                <Check size={14} className="text-[#10B981]" />
                              ) : (
                                <X size={14} className="text-red-500" />
                              )}
                            </td>
                            <td className="px-3 py-2 font-mono text-muted-foreground">{r.rowNum}</td>
                            <td className="px-3 py-2 font-semibold text-foreground">{r.choferExcel || "—"}</td>
                            <td className="px-3 py-2 text-foreground font-semibold">
                              {r.choferNombreDb ? (
                                <span className="text-blue-700">{r.choferNombreDb}</span>
                              ) : (
                                <span className="text-red-500 font-semibold italic">No encontrado</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground font-mono">{r.cuilExcel || "—"}</td>
                            <td className="px-3 py-2 text-muted-foreground">{r.vencimientoExcel || "—"}</td>
                            <td className="px-3 py-2 text-muted-foreground font-medium">
                              {formatFecha(r.fechaVencimiento)}
                            </td>
                            <td className="px-3 py-2 text-xs">
                              {r.errorMsg ? (
                                <span className="text-red-600 font-medium">{r.errorMsg}</span>
                              ) : r.warningMsg ? (
                                <span className="text-amber-600 font-medium">{r.warningMsg}</span>
                              ) : (
                                <span className="text-green-600 font-medium">OK</span>
                              )}
                            </td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>
              {(detectedType === "choferes" ? choferesRows.length : documentRows.length) > 100 && (
                <p className="text-xs text-muted-foreground px-1">
                  Mostrando primeras 100 de {detectedType === "choferes" ? choferesRows.length : documentRows.length} filas. Todas se importarán si confirmás.
                </p>
              )}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
                  {error}
                </div>
              )}
              <DialogFooter className="pt-3 border-t border-[#F1F5F9] gap-2">
                <Button type="button" variant="outline" onClick={reset} disabled={loading}>
                  Volver
                </Button>
                <Button
                  type="button"
                  variant="brand"
                  onClick={handleConfirm}
                  disabled={loading || !summary || summary.validas === 0}
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {loading ? "Importando..." : `Confirmar ${summary?.validas ?? 0} registros`}
                </Button>
              </DialogFooter>
            </div>
          )}

          {step === "done" && result && (
            <div className="space-y-3 py-2">
              <div className="bg-[#F0F9FF] border border-[#BAE6FD] text-[#075985] text-sm rounded-lg p-3 space-y-1">
                <div>
                  Se procesó con éxito la importación de tipo <strong>{getFriendlyTypeLabel()}</strong>:
                  <ul className="list-disc list-inside mt-1 font-semibold">
                    <li>{result.imported} registros insertados</li>
                    <li>{result.updated} registros actualizados</li>
                    {result.skipped ? <li>{result.skipped} omitidos</li> : null}
                  </ul>
                </div>
                {result.errors.length > 0 && (
                  <ul className="text-xs text-[#9F1239] max-h-32 overflow-y-auto list-disc list-inside pt-2">
                    {result.errors.slice(0, 20).map((e, i) => (
                      <li key={i}>Fila {e.row}: {e.message}</li>
                    ))}
                  </ul>
                )}
              </div>
              <DialogFooter className="pt-3 border-t border-[#F1F5F9] gap-2">
                <Button type="button" variant="brand" onClick={() => setOpen(false)}>
                  Cerrar
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
