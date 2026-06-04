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
import { Upload, Loader2, AlertTriangle, CheckCircle2, XCircle, FileText } from "lucide-react";
import {
  previewYpfImportAction,
  confirmYpfImportAction,
  type YpfPreviewState,
  type YpfViajePreview,
  type ConfirmYpfState,
} from "../import-ypf/actions";

type Step = "select" | "preview" | "done";

const money = (n: number | null | undefined) =>
  n == null ? "—" : "$" + Math.round(n).toLocaleString("es-AR");

export default function ImportYpfModal() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("select");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<NonNullable<YpfPreviewState> | null>(null);
  const [result, setResult] = useState<NonNullable<ConfirmYpfState> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const fileObjRef = useRef<File | null>(null);

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
      const res = await previewYpfImportAction(fd);
      if (!res || res.error || !res.ok) {
        setError(res?.error ?? "Error al analizar el PDF.");
        return;
      }
      setPreview(res);
      setStep("preview");
    } catch (err) {
      console.error(err);
      setError("No se pudo analizar el PDF.");
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
      const res = await confirmYpfImportAction(fd);
      if (!res || res.error) {
        setError(res?.error ?? "Error al confirmar.");
        return;
      }
      setResult(res);
      setStep("done");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep("select");
    setError(null);
    setPreview(null);
    setResult(null);
    fileObjRef.current = null;
    if (fileRef.current) fileRef.current.value = "";
  };

  const s = preview?.summary;

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <FileText size={14} />
        Importar PDF de YPF
      </Button>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) reset();
        }}
      >
        <DialogContent
          className={step === "preview" ? "sm:max-w-[1100px] max-h-[90vh] flex flex-col" : "sm:max-w-[560px]"}
        >
          <DialogHeader>
            <DialogTitle className="text-foreground text-xl">
              {step === "preview"
                ? "Vista previa — Liquidación YPF"
                : step === "done"
                ? "Importación completada"
                : "Importar PDF quincenal de YPF"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {step === "select" && (
                <>Subí el PDF (&quot;DM Joaquín Directa&quot;). El sistema lee el detalle por viaje y la tarifa, cruza el chofer por CUIL y calcula el importe (neto × precio unitario).</>
              )}
              {step === "preview" && preview && (
                <>
                  {preview.quincenaDesde} → {preview.quincenaHasta} ·{" "}
                  <span className="text-[#047857] font-semibold">{s?.importables ?? 0} a importar</span>
                  {(s?.sinChofer ?? 0) > 0 && <> · <span className="text-red-600 font-semibold">{s?.sinChofer} sin chofer</span></>}
                  {(s?.sinCamion ?? 0) > 0 && <> · <span className="text-[#92400E] font-semibold">{s?.sinCamion} sin camión</span></>}
                  {(s?.yaImportados ?? 0) > 0 && <> · <span className="text-muted-foreground">{s?.yaImportados} ya importados</span></>}
                  {" "}· {money(s?.totalImporte)}
                </>
              )}
              {step === "done" && result?.imported && (
                <>{result.imported.viajes} viajes creados · {result.imported.omitidos} omitidos</>
              )}
            </DialogDescription>
          </DialogHeader>

          {step === "select" && (
            <form onSubmit={handlePreview} className="space-y-4 py-2">
              <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground">Cómo funciona:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Lee el detalle por viaje (fecha de descarga, remito, chofer, toneladas).</li>
                  <li>Cruza el chofer por <strong>CUIL</strong> y le calcula el importe con la tarifa del PDF.</li>
                  <li>El camión sale del asignado a cada chofer. Cliente: <strong>YPF</strong>.</li>
                  <li>Vas a revisar todo antes de confirmar. No se duplican viajes ya importados.</li>
                </ul>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,application/pdf"
                className="w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-[#E1F5FE] file:text-primary file:font-semibold hover:file:bg-[#B3E5FC]"
                required
              />
              {error && <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">{error}</div>}
              <DialogFooter className="pt-3 border-t border-[#F1F5F9] gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="submit" variant="brand" disabled={loading}>
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {loading ? "Analizando..." : "Analizar PDF"}
                </Button>
              </DialogFooter>
            </form>
          )}

          {step === "preview" && preview && (
            <div className="flex flex-col flex-1 min-h-0 gap-3 py-2">
              {(preview.warnings?.length ?? 0) > 0 && (
                <div className="rounded-md border border-[#FCD34D] bg-[#FFFBEB] text-[#92400E] text-xs px-3 py-2 flex items-start gap-2 shrink-0">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  <div>{preview.warnings!.map((w, i) => <div key={i}>{w}</div>)}</div>
                </div>
              )}
              {(preview.tarifas?.length ?? 0) > 0 && (
                <div className="text-xs text-muted-foreground shrink-0">
                  <span className="font-semibold text-foreground">Tarifas detectadas:</span>{" "}
                  {preview.tarifas!.map((t) => `${t.origen}→${t.destino}: ${money(t.precioUnitario)}/tn`).join("  ·  ")}
                </div>
              )}
              <div className="overflow-auto flex-1 min-h-0 border border-border rounded-md">
                <table className="w-full text-xs border-separate border-spacing-0">
                  <thead className="sticky top-0 z-10">
                    <tr className="text-left text-muted-foreground text-[10px] uppercase tracking-wide bg-card">
                      <th className="px-2 py-1.5 border-b border-border bg-card"></th>
                      <th className="px-2 py-1.5 border-b border-border bg-card">Fecha</th>
                      <th className="px-2 py-1.5 border-b border-border bg-card">Chofer</th>
                      <th className="px-2 py-1.5 border-b border-border bg-card">Camión</th>
                      <th className="px-2 py-1.5 border-b border-border bg-card">Origen</th>
                      <th className="px-2 py-1.5 border-b border-border bg-card">Destino</th>
                      <th className="px-2 py-1.5 border-b border-border bg-card text-right">Neto tn</th>
                      <th className="px-2 py-1.5 border-b border-border bg-card text-right">Importe</th>
                      <th className="px-2 py-1.5 border-b border-border bg-card">Remito</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.viajes!.map((v) => (
                      <ViajeRow key={v.idx} v={v} />
                    ))}
                  </tbody>
                </table>
              </div>
              {error && <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg shrink-0">{error}</div>}
              <DialogFooter className="pt-3 border-t border-[#F1F5F9] gap-2 shrink-0">
                <Button type="button" variant="outline" onClick={reset} disabled={loading}>Volver</Button>
                <Button type="button" variant="brand" onClick={handleConfirm} disabled={loading || (s?.importables ?? 0) === 0}>
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {loading ? "Importando..." : `Confirmar ${s?.importables ?? 0} viajes`}
                </Button>
              </DialogFooter>
            </div>
          )}

          {step === "done" && result && (
            <div className="space-y-3 py-2">
              <div className="bg-[#F0F9FF] border border-[#BAE6FD] text-[#075985] text-sm rounded-lg p-3 space-y-1">
                <div><strong>{result.imported?.viajes ?? 0}</strong> viajes insertados</div>
                <div><strong>{result.imported?.omitidos ?? 0}</strong> omitidos (sin chofer/camión, sin precio o ya importados)</div>
                {(result.imported?.puntosCreados ?? 0) > 0 && (
                  <div><strong>{result.imported?.puntosCreados}</strong> puntos de ruta nuevos</div>
                )}
              </div>
              <DialogFooter className="pt-3 border-t border-[#F1F5F9] gap-2">
                <Button type="button" variant="brand" onClick={() => setOpen(false)}>Cerrar</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ViajeRow({ v }: { v: YpfViajePreview }) {
  const status: { icon: React.ReactNode; cls: string; label: string } = v.importable
    ? { icon: <CheckCircle2 size={12} className="text-[#10B981]" />, cls: "", label: "" }
    : v.chofer.status === "not_found"
    ? { icon: <XCircle size={12} className="text-red-500" />, cls: "bg-red-50/50", label: "sin chofer" }
    : v.chofer.status === "inactivo"
    ? { icon: <AlertTriangle size={12} className="text-[#F59E0B]" />, cls: "bg-[#FFFBEB]", label: "chofer de baja" }
    : v.yaImportado
    ? { icon: <span className="w-2 h-2 rounded-full bg-muted-foreground/30 inline-block" />, cls: "text-muted-foreground", label: "ya importado" }
    : v.camion.status === "missing"
    ? { icon: <AlertTriangle size={12} className="text-[#F59E0B]" />, cls: "bg-[#FFFBEB]", label: "sin camión" }
    : v.precioUnitario == null
    ? { icon: <AlertTriangle size={12} className="text-[#F59E0B]" />, cls: "bg-[#FFFBEB]", label: "sin precio" }
    : { icon: <CheckCircle2 size={12} className="text-[#10B981]" />, cls: "", label: "" };

  return (
    <tr className={`border-t border-[#F1F5F9] ${status.cls}`}>
      <td className="px-2 py-1" title={status.label}>{status.icon}</td>
      <td className="px-2 py-1 font-mono">{v.fechaDescarga ?? "—"}</td>
      <td className="px-2 py-1"><ChoferCell v={v} /></td>
      <td className="px-2 py-1 font-mono text-[10px]">{v.camion.status === "ok" ? v.camion.patente : "—"}</td>
      <td className="px-2 py-1">{v.origen ?? "—"}</td>
      <td className="px-2 py-1">{v.destino ?? "—"}</td>
      <td className="px-2 py-1 text-right font-mono">{v.netoTn}</td>
      <td className="px-2 py-1 text-right font-mono">{money(v.importe)}</td>
      <td className="px-2 py-1 font-mono text-[10px]">
        {v.remito ?? "—"}
        {status.label && <span className="ml-1 text-muted-foreground italic">· {status.label}</span>}
      </td>
    </tr>
  );
}

// Chofer clickeable: abre el legajo en otra pestaña. Si está dado de baja, link
// al legajo (para reactivar); si no está en el sistema, link a /choferes (alta).
function ChoferCell({ v }: { v: YpfViajePreview }) {
  const ch = v.chofer;
  if (ch.status === "ok") {
    return (
      <a href={`/choferes/${ch.id}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
        {ch.apellido}, {ch.nombre}
      </a>
    );
  }
  if (ch.status === "inactivo") {
    return (
      <a
        href={`/choferes/${ch.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[#92400E] hover:underline"
        title={`Chofer en estado "${ch.estado}". Abrí el legajo para reactivarlo.`}
      >
        {ch.apellido}, {ch.nombre} <span className="text-[10px]">(dado de baja)</span>
      </a>
    );
  }
  return (
    <a
      href="/choferes"
      target="_blank"
      rel="noopener noreferrer"
      className="text-red-600 hover:underline"
      title="El CUIL no figura en ningún chofer del sistema. Abrí Choferes para darlo de alta."
    >
      {v.choferNombre} <span className="text-[10px]">({v.choferCuil}) · no está en el sistema</span>
    </a>
  );
}
