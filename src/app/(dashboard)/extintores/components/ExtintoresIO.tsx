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
import { Download, Upload, Loader2, Check, X } from "lucide-react";
import {
  previewExtintoresImportAction,
  confirmExtintoresImportAction,
  exportExtintoresAction,
  type ParsedExtintorImportRow,
} from "../actions";

export function ExportExtintoresButton() {
  const [loading, setLoading] = useState(false);
  const handleExport = async () => {
    setLoading(true);
    try {
      const { filename, base64 } = await exportExtintoresAction();
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("No se pudo generar el reporte.");
    } finally {
      setLoading(false);
    }
  };
  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={loading}>
      {loading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
      Exportar
    </Button>
  );
}

type Step = "select" | "preview" | "done";

export function ImportExtintoresButton() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("select");
  const [loading, setLoading] = useState(false);
  const [previewRows, setPreviewRows] = useState<ParsedExtintorImportRow[]>([]);
  const [summary, setSummary] = useState<{
    validas: number;
    invalidas: number;
    chasis: number;
    acoplados: number;
    otros: number;
  } | null>(null);
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
      const res = await previewExtintoresImportAction(fd);
      if (res.error) {
        setError(res.error);
      } else if (res.rows && res.summary) {
        setPreviewRows(res.rows);
        setSummary(res.summary);
        setStep("preview");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const res = await confirmExtintoresImportAction(previewRows);
      setResult(res);
      setStep("done");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep("select");
    setPreviewRows([]);
    setSummary(null);
    setError(null);
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
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
              {step === "preview" ? "Vista previa" : step === "done" ? "Importación completada" : "Importar extintores"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {step === "select" && (
                <>
                  Subí un archivo .xlsx o .csv. Columnas reconocidas: <strong>Nº Extintor</strong>, Ubicación / Dominio, Nº Interno, Capacidad, Vencimiento, Categoría, Observaciones.
                  <br />
                  <span className="text-xs text-muted-foreground/80">
                    Se emparejará por <strong>Nº Extintor</strong> para actualizar los existentes. Si la fila no tiene categoría, se infiere por la patente en la base de datos (Camiones/Acoplados).
                  </span>
                </>
              )}
              {step === "preview" && summary && (
                <>
                  <span className="text-[#047857] font-semibold">{summary.validas} válidas</span>
                  {summary.invalidas > 0 && (
                    <> · <span className="text-red-600 font-semibold">{summary.invalidas} con error</span></>
                  )}
                  {summary.chasis > 0 && (
                    <> · <span className="text-[#0369A1] font-semibold">{summary.chasis} chasis</span></>
                  )}
                  {summary.acoplados > 0 && (
                    <> · <span className="text-[#6366F1] font-semibold">{summary.acoplados} acoplados</span></>
                  )}
                  {summary.otros > 0 && (
                    <> · <span className="text-[#8B5CF6] font-semibold">{summary.otros} otros</span></>
                  )}
                  {" "}· Se procesarán {summary.validas} registros.
                </>
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
                      <th className="px-3 py-2">Fila</th>
                      <th className="px-3 py-2">Nº Extintor</th>
                      <th className="px-3 py-2">Ubicación / Dominio</th>
                      <th className="px-3 py-2">Nº Interno</th>
                      <th className="px-3 py-2">Capacidad</th>
                      <th className="px-3 py-2">Vencimiento</th>
                      <th className="px-3 py-2">Categoría</th>
                      <th className="px-3 py-2">Observaciones</th>
                      <th className="px-3 py-2">Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.slice(0, 100).map((r) => (
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
                        <td className="px-3 py-2 font-semibold text-foreground">{r.n_extintor || "—"}</td>
                        <td className="px-3 py-2 text-foreground font-semibold">
                          {r.dominio || "—"}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{r.n_interno || "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.capacidad || "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {r.fecha_vencimiento ? (
                            (() => {
                              const [y, m, d] = r.fecha_vencimiento.split("-");
                              return `${d}/${m}/${y}`;
                            })()
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground capitalize">{r.categoria}</td>
                        <td className="px-3 py-2 text-muted-foreground max-w-[200px] truncate" title={r.observaciones ?? ""}>
                          {r.observaciones || "—"}
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
              {previewRows.length > 100 && (
                <p className="text-xs text-muted-foreground px-1">
                  Mostrando primeras 100 de {previewRows.length} filas. Todas se importarán si confirmás.
                </p>
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
                  Se procesaron con éxito los registros:
                  <ul className="list-disc list-inside mt-1 font-semibold">
                    <li>{result.imported} insertados</li>
                    <li>{result.updated} actualizados</li>
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
