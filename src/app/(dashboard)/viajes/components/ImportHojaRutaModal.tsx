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
import {
  Upload,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
  HelpCircle,
} from "lucide-react";
import {
  previewHojaRutaImportAction,
  confirmHojaRutaImportAction,
  type HojaRutaPreviewState,
  type ConfirmHojaRutaState,
  type SheetPreview,
  type AsignacionSheet,
} from "../import-hoja-ruta/actions";

type Step = "select" | "preview" | "done";

const money = (n: number | null | undefined) =>
  n == null ? "—" : "$" + Math.round(n).toLocaleString("es-AR");

const num = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("es-AR");

export default function ImportHojaRutaModal() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("select");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<NonNullable<HojaRutaPreviewState> | null>(null);
  const [asignaciones, setAsignaciones] = useState<AsignacionSheet[]>([]);
  const [result, setResult] = useState<NonNullable<ConfirmHojaRutaState> | null>(null);
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
      const res = await previewHojaRutaImportAction(fd);
      if (!res || res.error || !res.ok) {
        setError(res?.error ?? "Error al analizar el Excel.");
        return;
      }
      setPreview(res);
      setAsignaciones(res.asignaciones ?? []);
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
      const res = await confirmHojaRutaImportAction(fd);
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
    setAsignaciones([]);
    setResult(null);
    fileObjRef.current = null;
    if (fileRef.current) fileRef.current.value = "";
  };

  const s = preview?.summary;
  const sheetsConError = preview?.sheets?.filter((x) => x.chofer.status !== "ok") ?? [];

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <FileSpreadsheet size={14} />
        Importar HOJA DE RUTA
      </Button>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) reset();
        }}
      >
        <DialogContent className="sm:max-w-[820px] max-h-[88vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-foreground text-xl flex items-center gap-2">
              <FileSpreadsheet size={18} className="text-primary" />
              Importar HOJA DE RUTA (Excel)
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {step === "select" && (
                <>
                  Subí el .xlsx (&quot;HOJA DE RUTA completa&quot;). Cada sheet es un chofer.
                  El sistema cruza por apellido, dedup contra los viajes ya cargados
                  y carga los que tengan datos válidos.
                </>
              )}
              {step === "preview" && preview && (
                <>
                  <span className="text-[#047857] font-semibold">{s?.totalImportables ?? 0} viajes a importar</span>
                  {(s?.totalDuplicados ?? 0) > 0 && (
                    <> · <span className="text-muted-foreground">{s?.totalDuplicados} duplicados</span></>
                  )}
                  {sheetsConError.length > 0 && (
                    <> · <span className="text-red-600 font-semibold">{sheetsConError.length} sheets sin chofer</span></>
                  )}
                  {" "}· {money(s?.totalImporte)} total
                </>
              )}
              {step === "done" && result?.imported && (
                <>
                  {result.imported.viajes} viajes creados
                  {result.imported.pendientesFacturar > 0 && (
                    <> · <span className="text-[#92400E] font-semibold">{result.imported.pendientesFacturar} esperando remito</span></>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {/* ─────────── STEP 1: select file ─────────── */}
          {step === "select" && (
            <form onSubmit={handlePreview} className="space-y-4 py-2">
              <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground inline-flex items-center gap-1.5">
                  <HelpCircle size={12} />
                  Cómo funciona
                </p>
                <ul className="list-disc list-inside space-y-0.5 mt-1">
                  <li>Cada sheet del Excel = un chofer (cruce por apellido)</li>
                  <li>Estructura esperada: DIA · SALE DE · LLEGA A · KM · Tn 29/35/37,5 · Nº REMITO · MATERIAL · KM VACÍOS · $</li>
                  <li>Viajes sin <code>$</code> se cargan con monto NULL = &quot;esperando remito&quot;</li>
                  <li>Dedup por (chofer + fecha + remito): no se duplican viajes ya cargados por el importador YPF</li>
                  <li>Sheets ignorados: TOTALES, HOJA DE GASTOS, FISCHER, PABLO FISCHER, TOTAL, Hoja1</li>
                </ul>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                className="w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-[#E1F5FE] file:text-primary file:font-semibold hover:file:bg-[#B3E5FC]"
                required
              />
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">{error}</div>
              )}
              <DialogFooter className="pt-3 border-t border-border gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="submit" variant="brand" disabled={loading}>
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {loading ? "Analizando…" : "Analizar archivo"}
                </Button>
              </DialogFooter>
            </form>
          )}

          {/* ─────────── STEP 2: preview ─────────── */}
          {step === "preview" && preview && (
            <div className="flex flex-col flex-1 min-h-0 gap-3 py-2">
              {/* Resumen agregado */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <Stat label="Sheets" value={`${s?.sheetsOk ?? 0} / ${s?.totalSheets ?? 0}`} tone="info" />
                <Stat label="Viajes a importar" value={`${s?.totalImportables ?? 0}`} tone="success" />
                <Stat label="Duplicados" value={`${s?.totalDuplicados ?? 0}`} tone="neutral" />
                <Stat label="Total importe" value={money(s?.totalImporte)} tone="info" />
              </div>

              {preview.warnings && preview.warnings.length > 0 && (
                <div className="rounded-md border border-[#FCD34D] bg-[#FFFBEB] text-[#92400E] text-xs px-3 py-2">
                  {preview.warnings.slice(0, 3).map((w, i) => <div key={i}>· {w}</div>)}
                </div>
              )}

              {/* Listado de sheets */}
              <div className="overflow-y-auto flex-1 min-h-0 border border-border rounded-md">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted/60 border-b border-border">
                    <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      <th className="text-left px-3 py-2 w-8"></th>
                      <th className="text-left px-3 py-2">Sheet → Chofer</th>
                      <th className="text-right px-3 py-2">Viajes</th>
                      <th className="text-right px-3 py-2">Vacíos</th>
                      <th className="text-right px-3 py-2">Pend.</th>
                      <th className="text-right px-3 py-2">Dup.</th>
                      <th className="text-right px-3 py-2">Importe</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {preview.sheets?.map((sh) => (
                      <SheetRow key={sh.sheetName} sheet={sh} />
                    ))}
                  </tbody>
                </table>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg shrink-0">{error}</div>
              )}

              <DialogFooter className="pt-3 border-t border-border gap-2 shrink-0">
                <Button type="button" variant="outline" onClick={reset} disabled={loading}>Volver</Button>
                <Button
                  type="button"
                  variant="brand"
                  onClick={handleConfirm}
                  disabled={loading || (s?.totalImportables ?? 0) === 0}
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {loading ? "Importando…" : `Confirmar ${s?.totalImportables ?? 0} viajes`}
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* ─────────── STEP 3: done ─────────── */}
          {step === "done" && result && (
            <div className="space-y-3 py-2">
              <div className="bg-[#F0F9FF] border border-[#BAE6FD] text-[#075985] text-sm rounded-lg p-4 space-y-1">
                <div className="flex items-center gap-2 text-base font-bold">
                  <CheckCircle2 size={18} className="text-[#10B981]" />
                  Importación completa
                </div>
                <div><strong>{result.imported?.viajes ?? 0}</strong> viajes insertados desde <strong>{result.imported?.sheetsConfirmados ?? 0}</strong> sheets</div>
                {(result.imported?.pendientesFacturar ?? 0) > 0 && (
                  <div className="text-[#92400E]">
                    <strong>{result.imported?.pendientesFacturar}</strong> esperando remito (monto NULL).
                    Aparecen como &quot;pendientes de facturar&quot; en /viajes.
                  </div>
                )}
                {(result.imported?.duplicados ?? 0) > 0 && (
                  <div><strong>{result.imported?.duplicados}</strong> duplicados (ya estaban cargados)</div>
                )}
                {(result.imported?.omitidos ?? 0) > 0 && (
                  <div><strong>{result.imported?.omitidos}</strong> omitidos (sheets sin chofer matcheado)</div>
                )}
                {(result.imported?.puntosCreados ?? 0) > 0 && (
                  <div><strong>{result.imported?.puntosCreados}</strong> puntos de ruta nuevos creados</div>
                )}
              </div>
              <DialogFooter className="pt-3 border-t border-border gap-2">
                <Button type="button" variant="brand" onClick={() => setOpen(false)}>Cerrar</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "success" | "info" | "neutral";
}) {
  const cls = tone === "success"
    ? "bg-[#ECFDF5] border-[#A7F3D0] text-[#065F46]"
    : tone === "info"
    ? "bg-[#F0F9FF] border-[#BAE6FD] text-[#075985]"
    : "bg-muted/40 border-border text-muted-foreground";
  return (
    <div className={`border rounded-md px-3 py-2 ${cls}`}>
      <p className="text-[10px] uppercase tracking-widest font-bold opacity-80">{label}</p>
      <p className="text-sm font-bold mt-0.5">{value}</p>
    </div>
  );
}

function SheetRow({ sheet }: { sheet: SheetPreview }) {
  const isOk = sheet.chofer.status === "ok";
  const isMissing = sheet.chofer.status === "missing";
  const isAmbig = sheet.chofer.status === "ambiguo";
  const importables = sheet.total - sheet.yaImportados;

  return (
    <tr className={isMissing ? "bg-red-50/40" : isAmbig ? "bg-amber-50/40" : ""}>
      <td className="px-3 py-2 align-top">
        {isOk ? (
          <CheckCircle2 size={13} className="text-[#10B981]" />
        ) : isAmbig ? (
          <AlertTriangle size={13} className="text-[#F59E0B]" />
        ) : (
          <XCircle size={13} className="text-red-500" />
        )}
      </td>
      <td className="px-3 py-2 align-top">
        <div className="font-mono font-semibold text-foreground">{sheet.sheetName.trim() || "(sin nombre)"}</div>
        {sheet.chofer.status === "ok" && (
          <div className="text-muted-foreground">→ {sheet.chofer.apellido}, {sheet.chofer.nombre}</div>
        )}
        {sheet.chofer.status === "ambiguo" && (
          <div className="text-[#92400E]">→ ambiguo · {sheet.chofer.candidatos.map((c) => c.label).join(" / ")}</div>
        )}
        {sheet.chofer.status === "missing" && (
          <div className="text-red-600">→ no hay chofer con ese apellido en la DB</div>
        )}
        {sheet.patentes.length > 0 && (
          <div className="text-[10px] text-muted-foreground/70 mt-0.5">
            Patentes: <span className="font-mono">{sheet.patentes.join(" · ")}</span>
          </div>
        )}
        {sheet.warnings.map((w, i) => (
          <div key={i} className="text-[10px] text-[#92400E] italic">⚠ {w}</div>
        ))}
      </td>
      <td className="px-3 py-2 text-right align-top font-mono">
        <span className="font-semibold">{importables}</span>
        <span className="text-muted-foreground/60"> / {sheet.total}</span>
      </td>
      <td className="px-3 py-2 text-right align-top font-mono text-muted-foreground">{num(sheet.vacios)}</td>
      <td className="px-3 py-2 text-right align-top font-mono">
        {sheet.pendientesFacturar > 0 ? (
          <span className="text-[#92400E] font-semibold">{sheet.pendientesFacturar}</span>
        ) : (
          <span className="text-muted-foreground/60">0</span>
        )}
      </td>
      <td className="px-3 py-2 text-right align-top font-mono text-muted-foreground">{num(sheet.yaImportados)}</td>
      <td className="px-3 py-2 text-right align-top font-mono">{money(sheet.sumaImporte)}</td>
    </tr>
  );
}
