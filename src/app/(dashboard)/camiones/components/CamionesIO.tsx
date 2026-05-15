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
import { Download, Upload, Loader2 } from "lucide-react";
import { importCamionesAction, exportCamionesAction } from "../actions";

export function ExportCamionesButton() {
  const [loading, setLoading] = useState(false);
  const handleExport = async () => {
    setLoading(true);
    try {
      const { filename, base64 } = await exportCamionesAction();
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

export function ImportCamionesButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    imported?: number;
    skipped?: number;
    errors?: { row: number; message: string }[];
    error?: string;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setLoading(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await importCamionesAction(fd);
      setResult(res);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
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
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-[#0F172A] text-xl">Importar camiones</DialogTitle>
            <DialogDescription className="text-[#475569]">
              Subí un archivo .xlsx o .csv con columnas: <strong>Patente</strong>, Marca, Modelo, Año,
              Capacidad TN, Tipo, Estado.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.csv,.xls"
              className="w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-[#E1F5FE] file:text-[#0088D1] file:font-semibold hover:file:bg-[#B3E5FC]"
              required
            />

            {result?.error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
                {result.error}
              </div>
            )}

            {result && !result.error && (
              <div className="bg-[#F0F9FF] border border-[#BAE6FD] text-[#075985] text-sm rounded-lg p-3 space-y-1">
                <div>
                  <strong>{result.imported}</strong> importados
                  {result.skipped ? `, ${result.skipped} omitidos` : ""}
                </div>
                {result.errors && result.errors.length > 0 && (
                  <ul className="text-xs text-[#9F1239] max-h-32 overflow-y-auto list-disc list-inside">
                    {result.errors.slice(0, 10).map((e, i) => (
                      <li key={i}>
                        Fila {e.row}: {e.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <DialogFooter className="pt-3 border-t border-[#F1F5F9] gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cerrar
              </Button>
              <Button type="submit" variant="brand" disabled={loading}>
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {loading ? "Importando..." : "Importar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
