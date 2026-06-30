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
  type ConfirmYpfState,
  type DmRowPreview,
} from "../import-ypf/actions";

type Step = "select" | "preview" | "done";

const money = (n: number | null | undefined) =>
  n == null ? "—" : "$" + Math.round(n).toLocaleString("es-AR");

type ImportYpfModalProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
};

export default function ImportYpfModal({
  open: openProp,
  onOpenChange,
  showTrigger = true,
}: ImportYpfModalProps = {}) {
  const [openInternal, setOpenInternal] = useState(false);
  const open = openProp ?? openInternal;
  const setOpen = (v: boolean) => {
    if (openProp === undefined) setOpenInternal(v);
    onOpenChange?.(v);
  };
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
      {showTrigger && (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <FileText size={14} />
          Importar DM de YPF
        </Button>
      )}
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
                ? "Vista previa — DM de YPF"
                : step === "done"
                ? "Viajes completados"
                : "Importar DM de YPF"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {step === "select" && (
                <>Subí el PDF del DM (&quot;DM Joaquín Directa&quot;). El sistema cruza cada renglón por <strong>nº de remito</strong> contra los viajes ya cargados y completa el tonelaje y el importe (neto × precio del destino). Los remitos que no estén cargados se listan para reclamar.</>
              )}
              {step === "preview" && preview && (
                <>
                  {preview.quincenaDesde} → {preview.quincenaHasta} ·{" "}
                  <span className="text-[#047857] font-semibold">{s?.coinciden ?? 0} a completar</span>
                  {(s?.noCargados ?? 0) > 0 && <> · <span className="text-red-600 font-semibold">{s?.noCargados} sin cargar (reclamar)</span></>}
                  {(s?.yaConValor ?? 0) > 0 && <> · <span className="text-muted-foreground">{s?.yaConValor} ya con valor</span></>}
                  {" "}· {money(s?.totalImporteACompletar)} a aplicar
                </>
              )}
              {step === "done" && result?.result && (
                <>
                  <span className="text-[#047857] font-semibold">{result.result.completados} viajes completados</span>
                  {result.result.noCargados > 0 && (
                    <> · <span className="text-red-600 font-semibold">{result.result.noCargados} a reclamar</span></>
                  )}
                  {result.result.yaTenian > 0 && <> · {result.result.yaTenian} ya tenían valor</>}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {step === "select" && (
            <form onSubmit={handlePreview} className="space-y-4 py-2">
              <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground">Cómo funciona:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Cruza cada viaje del DM por <strong>nº de remito</strong> con los viajes ya cargados.</li>
                  <li>A los que coinciden les completa <strong>toneladas + importe</strong> (neto × precio del destino) y los marca facturados.</li>
                  <li>Los remitos del DM que <strong>no estén cargados</strong> se marcan en rojo para reclamar (no se crean solos).</li>
                  <li>El PDF firmado queda archivado en Compliance → YPF.</li>
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
                  {loading ? "Analizando..." : "Analizar DM"}
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
                  <span className="font-semibold text-foreground">Precios por destino:</span>{" "}
                  {preview.tarifas!.map((t) => `${t.destino}: ${money(t.precioUnitario)}/tn`).join("  ·  ")}
                </div>
              )}
              <div className="overflow-auto flex-1 min-h-0 border border-border rounded-md">
                <table className="w-full text-xs border-separate border-spacing-0">
                  <thead className="sticky top-0 z-10">
                    <tr className="text-left text-muted-foreground text-[10px] uppercase tracking-wide bg-card">
                      <th className="px-2 py-1.5 border-b border-border bg-card"></th>
                      <th className="px-2 py-1.5 border-b border-border bg-card">Fecha</th>
                      <th className="px-2 py-1.5 border-b border-border bg-card">Remito</th>
                      <th className="px-2 py-1.5 border-b border-border bg-card">Destino</th>
                      <th className="px-2 py-1.5 border-b border-border bg-card">Chofer (DM)</th>
                      <th className="px-2 py-1.5 border-b border-border bg-card">Viaje</th>
                      <th className="px-2 py-1.5 border-b border-border bg-card text-right">Neto tn</th>
                      <th className="px-2 py-1.5 border-b border-border bg-card text-right">Importe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows!.map((r) => (
                      <DmRow key={r.idx} r={r} />
                    ))}
                  </tbody>
                </table>
              </div>
              {error && <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg shrink-0">{error}</div>}
              <DialogFooter className="pt-3 border-t border-[#F1F5F9] gap-2 shrink-0">
                <Button type="button" variant="outline" onClick={reset} disabled={loading}>Volver</Button>
                <Button type="button" variant="brand" onClick={handleConfirm} disabled={loading || (s?.coinciden ?? 0) === 0}>
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {loading ? "Completando..." : `Completar ${s?.coinciden ?? 0} viajes`}
                </Button>
              </DialogFooter>
            </div>
          )}

          {step === "done" && result?.result && (
            <div className="space-y-3 py-2">
              <div className="bg-[#F0F9FF] border border-[#BAE6FD] text-[#075985] text-sm rounded-lg p-3 space-y-1">
                <div><strong>{result.result.completados}</strong> viajes completados (tonelaje + importe + facturado)</div>
                {result.result.noCargados > 0 && (
                  <div className="text-red-600">
                    <strong>{result.result.noCargados}</strong> remitos del DM sin viaje cargado — <strong>a reclamar</strong>. Cargá esos viajes y volvé a importar el DM para completarlos.
                  </div>
                )}
                {result.result.yaTenian > 0 && (
                  <div className="text-muted-foreground"><strong>{result.result.yaTenian}</strong> ya tenían valor (no se tocaron)</div>
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

function DmRow({ r }: { r: DmRowPreview }) {
  const meta: Record<DmRowPreview["status"], { icon: React.ReactNode; cls: string; label: string }> = {
    coincide: { icon: <CheckCircle2 size={12} className="text-[#10B981]" />, cls: "", label: "" },
    ya_con_valor: { icon: <span className="w-2 h-2 rounded-full bg-muted-foreground/30 inline-block" />, cls: "text-muted-foreground", label: "ya tenía valor" },
    no_cargado: { icon: <XCircle size={12} className="text-red-500" />, cls: "bg-red-50/60", label: "falta cargar · reclamar" },
    sin_remito: { icon: <AlertTriangle size={12} className="text-[#F59E0B]" />, cls: "bg-[#FFFBEB]", label: "sin remito en el DM" },
    sin_precio: { icon: <AlertTriangle size={12} className="text-[#F59E0B]" />, cls: "bg-[#FFFBEB]", label: "sin precio" },
  };
  const st = meta[r.status];
  const resalta = r.status === "coincide";
  const reclama = r.status === "no_cargado";

  return (
    <tr className={`border-t border-[#F1F5F9] ${st.cls}`}>
      <td className="px-2 py-1" title={st.label}>{st.icon}</td>
      <td className="px-2 py-1 font-mono">{r.fecha ?? "—"}</td>
      <td className={`px-2 py-1 font-mono ${resalta || reclama ? "font-bold" : ""} ${reclama ? "text-red-600" : ""}`}>
        {r.remito ?? "—"}
      </td>
      <td className="px-2 py-1">{r.destino ?? "—"}</td>
      <td className="px-2 py-1">{r.choferDm || "—"}</td>
      <td className="px-2 py-1 font-mono text-[10px]">
        {r.viaje ? (
          <a href={`/viajes`} className="text-primary hover:underline" title={r.viaje.chofer ?? undefined}>
            {r.viaje.codigo}
          </a>
        ) : reclama ? (
          <span className="text-red-600 italic">falta cargar</span>
        ) : (
          "—"
        )}
        {st.label && r.status !== "no_cargado" && <span className="ml-1 text-muted-foreground italic">· {st.label}</span>}
      </td>
      <td className="px-2 py-1 text-right font-mono">{r.netoTn}</td>
      <td className={`px-2 py-1 text-right font-mono ${resalta ? "font-bold text-[#047857]" : ""}`}>{money(r.importe)}</td>
    </tr>
  );
}
